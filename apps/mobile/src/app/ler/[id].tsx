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
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { ReaderNextComic, ReaderPayload } from '@comicz/shared';

import { comicLabel } from '@/lib/format';
import { QueryError } from '@/components/QueryError';
import { Button, Loading, MediaImage } from '@/components/ui';
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
  seriesId: string | null;
  /** A edição seguinte da saga, para o fim da HQ. */
  next: ReaderNextComic | null;
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
      seriesId: downloaded.seriesId ?? null,
      // Sem rede, só vale oferecer a próxima se ela também estiver baixada.
      next: downloaded.next && getDownloaded(downloaded.next.id) ? downloaded.next : null,
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
    seriesId: payload.comic.seriesId ?? null,
    next: payload.next ?? null,
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
  const [endDismissed, setEndDismissed] = useState(false);
  const pageCountRef = useRef(pageCount);

  // A tela não apaga no meio de uma página.
  useKeepAwake();

  // O resto do app é retrato; aqui uma página dupla pede o celular deitado.
  useEffect(() => {
    void ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
        () => {},
      );
    };
  }, []);

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
        // Saiu do fim: da próxima vez que chegar lá, o cartão volta.
        if (first.index + 1 < pageCountRef.current) setEndDismissed(false);
      }
    },
    [],
  );

  const goTo = (page: number) => {
    const target = Math.min(Math.max(page, 1), pageCount);
    const list = mode === 'single' ? single.current : continuous.current;
    list?.scrollToIndex({ index: target - 1, animated: mode === 'single' });
  };

  // Ao girar, a largura muda e a lista horizontal fica no deslocamento antigo:
  // volta para a página em que estava.
  const lastWidth = useRef(width);
  useEffect(() => {
    if (lastWidth.current === width) return;
    lastWidth.current = width;
    const list = mode === 'single' ? single.current : continuous.current;
    requestAnimationFrame(() =>
      list?.scrollToIndex({ index: currentRef.current - 1, animated: false }),
    );
  }, [width, mode]);

  const atEnd = pageCount > 0 && current >= pageCount;
  const showEnd = atEnd && !endDismissed;

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
          // A última página pode ser curta demais para virar "a primeira visível".
          onEndReached={() => setCurrent(pageCount)}
          onEndReachedThreshold={0.05}
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
          {!showEnd ? (
            <SafeAreaView edges={['bottom']} style={[styles.bar, styles.bottom]}>
              <Pressable
                hitSlop={12}
                onPress={() => goTo(current - 1)}
                disabled={current <= 1}
                accessibilityLabel="Página anterior"
              >
                <Ionicons
                  name="chevron-back"
                  size={26}
                  color={current <= 1 ? Colors.ink600 : Colors.ink100}
                />
              </Pressable>
              <PageSlider current={current} count={pageCount} onChange={goTo} />
              <Pressable
                hitSlop={12}
                onPress={() => goTo(current + 1)}
                disabled={current >= pageCount}
                accessibilityLabel="Próxima página"
              >
                <Ionicons
                  name="chevron-forward"
                  size={26}
                  color={current >= pageCount ? Colors.ink600 : Colors.ink100}
                />
              </Pressable>
            </SafeAreaView>
          ) : null}
        </>
      ) : null}

      {showEnd ? (
        <EndOfComic
          title={data.title}
          next={data.next}
          seriesId={data.seriesId}
          onClose={() => setEndDismissed(true)}
        />
      ) : null}
    </View>
  );
}

/**
 * A barra de páginas: arrastar mostra o número da página de destino e só
 * vira ao soltar — virar a cada pixel carregaria vinte páginas no caminho.
 */
function PageSlider({
  current,
  count,
  onChange,
}: {
  current: number;
  count: number;
  onChange: (page: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const trackLeft = useRef(0);

  const pageAt = (pageX: number) => {
    if (trackWidth <= 0 || count <= 1) return 1;
    const ratio = Math.min(Math.max((pageX - trackLeft.current) / trackWidth, 0), 1);
    return Math.round(ratio * (count - 1)) + 1;
  };
  const update = (page: number) => {
    dragRef.current = page;
    setDragging(page);
  };

  const shown = dragging ?? current;
  const ratio = count > 1 ? (shown - 1) / (count - 1) : 1;

  return (
    <View style={styles.sliderWrap}>
      <View
        style={styles.sliderTouch}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          // A posição da trilha na tela, tirada do próprio toque: vale também
          // depois de girar o celular, sem medir nada.
          trackLeft.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
          update(pageAt(event.nativeEvent.pageX));
        }}
        onResponderMove={(event) => update(pageAt(event.nativeEvent.pageX))}
        onResponderRelease={() => {
          if (dragRef.current != null) onChange(dragRef.current);
          dragRef.current = null;
          setDragging(null);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Página"
        accessibilityValue={{ min: 1, max: count, now: current, text: `${current} de ${count}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onChange(current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
        }
      >
        <View pointerEvents="none" style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            { left: ratio * trackWidth - 9 },
            dragging != null && styles.sliderThumbActive,
          ]}
        />
      </View>
      <Text style={styles.counter}>
        {shown} / {count}
      </Text>
    </View>
  );
}

/**
 * O fim da HQ: em vez de parar na última página, oferece a seguinte da saga.
 * Fechar devolve a página; voltar uma página também (o cartão some sozinho).
 */
function EndOfComic({
  title,
  next,
  seriesId,
  onClose,
}: {
  title: string;
  next: ReaderNextComic | null;
  seriesId: string | null;
  onClose: () => void;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.endSheet}>
      <View style={styles.endHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.endEyebrow}>FIM DE</Text>
          <Text style={styles.endTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Fechar e ver a página">
          <Ionicons name="close" size={24} color={Colors.ink300} />
        </Pressable>
      </View>
      {next ? (
        <View style={styles.endNext}>
          <MediaImage url={next.coverUrl} style={styles.endCover} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.endNextLabel}>A SEGUIR</Text>
            <Text style={styles.endNextTitle} numberOfLines={2}>
              {comicLabel(next)}
            </Text>
            <Button
              label={next.issueNumber != null ? `Ler a #${next.issueNumber}` : 'Ler a próxima'}
              onPress={() => router.replace({ pathname: '/ler/[id]', params: { id: next.id } })}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.endNone}>
          {seriesId ? 'Esta é a última edição pronta desta saga.' : 'Você chegou ao fim.'}
        </Text>
      )}
      <View style={styles.endActions}>
        {seriesId ? (
          <Button
            variant="secondary"
            label="Ver a saga"
            style={{ flex: 1 }}
            onPress={() => router.replace({ pathname: '/saga/[id]', params: { id: seriesId } })}
          />
        ) : null}
        <Button
          variant="secondary"
          label="Sair"
          style={{ flex: 1 }}
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
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
  bottom: { bottom: 0 },
  title: { flex: 1, color: Colors.ink100, fontSize: 16, fontWeight: '700' },
  counter: {
    color: Colors.ink100,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  sliderWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTouch: { flex: 1, height: 40, justifyContent: 'center' },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink700,
    overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: Colors.brand },
  sliderThumb: {
    position: 'absolute',
    top: 11,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.brand,
    borderWidth: 3,
    borderColor: Colors.ink950,
  },
  sliderThumbActive: { transform: [{ scale: 1.25 }] },
  endSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 14,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  endHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  endEyebrow: { color: Colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  endTitle: { color: Colors.ink100, fontSize: 18, fontWeight: '800', marginTop: 2 },
  endNext: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.35)',
    backgroundColor: '#13110a',
  },
  endCover: { width: 72, height: 108, borderRadius: 6 },
  endNextLabel: { color: Colors.brandLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  endNextTitle: { color: Colors.ink100, fontSize: 16, fontWeight: '700' },
  endNone: { color: Colors.ink300, fontSize: 14 },
  endActions: { flexDirection: 'row', gap: 10 },
});

export { ErrorBoundary } from '@/components/RouteError';
