import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { ReaderPayload } from '@comicz/shared';

import { comicLabel } from '@/lib/format';
import { QueryError } from '@/components/QueryError';
import { Loading, MediaImage } from '@/components/ui';
import { ZoomablePage } from '@/components/ZoomablePage';
import { Colors, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { getDownloaded, pageUri } from '@/lib/downloads';
import { getLocalProgress, resolveStartPage, saveProgress } from '@/lib/progress';

interface ReaderPage {
  index: number;
  url: string | null;
  localUri: string | null;
  width: number | null;
  height: number | null;
}

type ViewMode = 'single' | 'continuous';

/**
 * Modo escolhido na última leitura desta sessão. Quem lê webtoon em rolagem
 * contínua não quer reescolher a cada HQ.
 */
let lastMode: ViewMode = 'single';

interface ReaderData {
  title: string;
  pages: ReaderPage[];
  startPage: number;
  offline: boolean;
}

/**
 * Fora do componente de propósito: a FlatList não aceita trocar este objeto
 * depois de montada, e um literal no JSX é um objeto novo a cada render.
 */
const SINGLE_VIEWABILITY = { itemVisiblePercentThreshold: 60 };
const CONTINUOUS_VIEWABILITY = { itemVisiblePercentThreshold: 50 };

/** Salvar a cada página virada rápido demais só gera requisição descartada. */
const SAVE_DEBOUNCE_MS = 800;

/**
 * O leitor: página a página na horizontal (com zoom) ou rolagem contínua na
 * vertical — os dois modos do site.
 *
 * Abre da cópia baixada quando existe — sem rede e sem token. Senão, busca o
 * payload do leitor e carrega as páginas da API.
 */
async function loadReader(comicId: string): Promise<ReaderData> {
  const downloaded = getDownloaded(comicId);
  if (downloaded) {
    return {
      title: comicLabel(downloaded),
      pages: downloaded.pages.map((page) => ({
        ...page,
        url: null,
        localUri: pageUri(comicId, page.index),
      })),
      startPage: await resolveStartPage(comicId, 1),
      offline: true,
    };
  }

  const payload = await api<ReaderPayload>(`/comics/${comicId}/reader`);
  const local = getLocalProgress(comicId);
  return {
    title: comicLabel(payload.comic),
    pages: payload.pages.map((page) => ({ ...page, localUri: null })),
    // Uma leitura offline ainda não enviada é mais recente que a do servidor.
    startPage: local?.pending ? local.currentPage : payload.currentPage,
    offline: false,
  };
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // gcTime 0: reabrir o leitor recalcula a página inicial com o progresso novo.
  const query = useQuery({
    queryKey: ['reader', id],
    queryFn: () => loadReader(id),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  if (query.isError) {
    return (
      <SafeAreaView style={styles.screen}>
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }
  if (!query.data) {
    return (
      <View style={styles.screen}>
        <Loading />
      </View>
    );
  }
  return <Pages comicId={id} data={query.data} />;
}

function Pages({ comicId, data }: { comicId: string; data: ReaderData }) {
  const { width, height } = useWindowDimensions();
  const pageCount = data.pages.length;
  const initialIndex = Math.min(Math.max(data.startPage - 1, 0), Math.max(pageCount - 1, 0));
  const [current, setCurrent] = useState(initialIndex + 1);
  const [chrome, setChrome] = useState(true);
  const [mode, setMode] = useState<ViewMode>(lastMode);
  const single = useRef<FlatList<ReaderPage>>(null);
  const continuous = useRef<FlatList<ReaderPage>>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialIndex + 1);

  const persist = useCallback(
    (page: number) => {
      if (page === lastSaved.current) return;
      lastSaved.current = page;
      void saveProgress(comicId, page, pageCount);
    },
    [comicId, pageCount],
  );

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(current), SAVE_DEBOUNCE_MS);
  }, [current, persist]);

  // Ao sair do leitor, a página atual é gravada na hora, sem esperar o debounce.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      persist(currentRef.current);
    },
    [persist],
  );

  // A FlatList exige que este callback nunca mude de identidade.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setCurrent(first.index + 1);
      }
    },
    [],
  );

  const goTo = (page: number) => {
    const target = Math.min(Math.max(page, 1), pageCount);
    const list = mode === 'single' ? single.current : continuous.current;
    list?.scrollToIndex({ index: target - 1, animated: mode === 'single' });
  };

  const switchMode = () => {
    const next: ViewMode = mode === 'single' ? 'continuous' : 'single';
    lastMode = next;
    setMode(next);
  };

  /** Altura da página na rolagem contínua: largura da tela na proporção dela. */
  const pageHeight = (page: ReaderPage) =>
    page.width && page.height ? (width * page.height) / page.width : width * 1.5;

  return (
    <View style={styles.screen}>
      {mode === 'single' ? (
        <FlatList
          // Cada modo é uma lista própria: sem key, o React reaproveitaria a
          // mesma FlatList ao trocar de modo e mudaria a configuração dela
          // montada — o que ela recusa ("Changing viewabilityConfig on the fly").
          key="single"
          ref={single}
          data={data.pages}
          keyExtractor={(page) => String(page.index)}
          horizontal
          pagingEnabled
          // A virada por arrasto é do gesto da página (ZoomablePage): a rolagem
          // nativa brigava com a pinça e virava a página no meio do zoom.
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={current - 1}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          viewabilityConfig={SINGLE_VIEWABILITY}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item, index }) => (
            <ZoomablePage
              width={width}
              height={height}
              url={item.url}
              localUri={item.localUri}
              resetKey={index !== current - 1}
              canPrev={index > 0}
              canNext={index < pageCount - 1}
              onTurn={(direction) => goTo(currentRef.current + direction)}
              onTap={(x) => {
                // Bordas viram página, como no site; o meio mostra/esconde os controles.
                if (x < width * 0.25) goTo(currentRef.current - 1);
                else if (x > width * 0.75) goTo(currentRef.current + 1);
                else setChrome((visible) => !visible);
              }}
            />
          )}
        />
      ) : (
        <FlatList
          key="continuous"
          ref={continuous}
          data={data.pages}
          keyExtractor={(page) => String(page.index)}
          initialScrollIndex={current - 1}
          getItemLayout={(pages, index) => {
            let offset = 0;
            for (let i = 0; i < index; i++) offset += pageHeight(pages![i]!);
            return { length: pageHeight(pages![index]!), offset, index };
          }}
          windowSize={7}
          initialNumToRender={3}
          viewabilityConfig={CONTINUOUS_VIEWABILITY}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item }) => (
            <Pressable onPress={() => setChrome((visible) => !visible)}>
              <MediaImage
                url={item.url}
                localUri={item.localUri}
                contentFit="contain"
                style={{ width, height: pageHeight(item), backgroundColor: Colors.ink950 }}
              />
            </Pressable>
          )}
        />
      )}

      {chrome ? (
        <>
          <SafeAreaView edges={['top']} style={[styles.bar, styles.top]}>
            <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Voltar">
              <Ionicons name="chevron-back" size={26} color={Colors.ink100} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {data.title}
            </Text>
            {data.offline ? (
              <Ionicons name="cloud-done-outline" size={20} color={Colors.brand} />
            ) : null}
            <Pressable
              hitSlop={12}
              onPress={switchMode}
              accessibilityLabel={mode === 'single' ? 'Rolagem contínua' : 'Página única'}
            >
              <Ionicons
                name={mode === 'single' ? 'reorder-four-outline' : 'tablet-portrait-outline'}
                size={24}
                color={Colors.ink100}
              />
            </Pressable>
          </SafeAreaView>
          <SafeAreaView edges={['bottom']} style={[styles.bar, styles.bottom]}>
            <Pressable hitSlop={12} onPress={() => goTo(current - 1)} disabled={current <= 1}>
              <Ionicons
                name="chevron-back-circle"
                size={32}
                color={current <= 1 ? Colors.ink600 : Colors.ink100}
              />
            </Pressable>
            <Text style={styles.counter}>
              {current} / {pageCount}
            </Text>
            <Pressable
              hitSlop={12}
              onPress={() => goTo(current + 1)}
              disabled={current >= pageCount}
            >
              <Ionicons
                name="chevron-forward-circle"
                size={32}
                color={current >= pageCount ? Colors.ink600 : Colors.ink100}
              />
            </Pressable>
          </SafeAreaView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink950 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(7, 9, 13, 0.85)',
  },
  top: { top: 0 },
  bottom: { bottom: 0, justifyContent: 'center' },
  title: { flex: 1, color: Colors.ink100, fontSize: 16, fontWeight: '700' },
  counter: {
    color: Colors.ink100,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'center',
  },
});

export { ErrorBoundary } from '@/components/RouteError';
