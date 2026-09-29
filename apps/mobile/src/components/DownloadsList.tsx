import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { DownloadButton } from '@/components/ComicRow';
import { Body, EmptyState, MediaImage } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { comicLabel } from '@/lib/format';
import {
  coverUri,
  formatBytes,
  getDownloaded,
  useDownloads,
  type DownloadedComic,
} from '@/lib/downloads';
import { getLocalProgress } from '@/lib/progress';

/**
 * Tudo que está no aparelho. Não chama a API: é o que funciona no avião, e por
 * isso aparece também fora da conta (tela `offline`), quando a sessão expirou.
 * Downloads em andamento aparecem no topo.
 */
export function DownloadsList() {
  const { comics, active } = useDownloads();
  const inProgress = Object.entries(active).filter(([id]) => !comics[id]);
  const saved = Object.values(comics).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
  const total = saved.reduce((sum, comic) => sum + comic.sizeBytes, 0);

  return (
    <View style={styles.screen}>
      <FlatList
        data={saved}
        keyExtractor={(comic) => comic.comicId}
        renderItem={({ item }) => <DownloadedRow comic={item} />}
        contentContainerStyle={
          saved.length === 0 && inProgress.length === 0 ? { flex: 1 } : undefined
        }
        ListHeaderComponent={
          <>
            {inProgress.map(([id, progress]) => (
              <View key={id} style={styles.pending}>
                <Body style={{ flex: 1 }}>
                  {progress.error
                    ? 'Falha no download'
                    : progress.total
                      ? `Baixando… ${progress.done} de ${progress.total} páginas`
                      : 'Preparando download…'}
                </Body>
                <DownloadButton
                  comicId={id}
                  coverUrl={null}
                  downloaded={false}
                  active={progress}
                  label="Esta HQ"
                />
              </View>
            ))}
            {saved.length > 0 ? (
              <Body muted style={styles.summary}>
                {saved.length} {saved.length === 1 ? 'HQ' : 'HQs'} · {formatBytes(total)} no
                aparelho
              </Body>
            ) : null}
          </>
        }
        ListEmptyComponent={
          inProgress.length === 0 ? (
            <EmptyState
              title="Nada baixado ainda"
              message="Toque na seta ao lado de uma HQ para ler sem internet."
            />
          ) : null
        }
      />
    </View>
  );
}

function DownloadedRow({ comic }: { comic: DownloadedComic }) {
  const progress = getLocalProgress(comic.comicId);
  const label = comicLabel(comic);
  const detail = [
    comic.seriesName,
    progress
      ? `Página ${progress.currentPage} de ${comic.pageCount}`
      : `${comic.pageCount} páginas`,
    formatBytes(comic.sizeBytes),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => {
        if (!getDownloaded(comic.comicId)) {
          Alert.alert('Download indisponível', 'Esta HQ foi removida do aparelho.');
          return;
        }
        router.push({ pathname: '/ler/[id]', params: { id: comic.comicId } });
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <MediaImage
        url={null}
        localUri={comic.hasCover ? coverUri(comic.comicId) : null}
        style={styles.cover}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <DownloadButton comicId={comic.comicId} coverUrl={null} downloaded label={label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  summary: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 13 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: 10,
    backgroundColor: Colors.ink800,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cover: { width: 54, height: 82, borderRadius: 6 },
  title: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  subtitle: { color: Colors.ink400, fontSize: 13 },
});
