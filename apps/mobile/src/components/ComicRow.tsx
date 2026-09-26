import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComicSummary } from '@comicz/shared';

import { Colors, Spacing } from '@/constants/theme';
import {
  cancelDownload,
  coverUri,
  removeDownload,
  startDownload,
  useDownloads,
} from '@/lib/downloads';
import { comicLabel, fileStatusLabel } from '@/lib/format';
import { Badge, MediaImage } from './ui';

/**
 * Uma edição com capa, título, progresso e o botão de download. Tocar abre a
 * página da HQ, como no site; o leitor sai de lá.
 *
 * Nos guias e eventos a linha ganha a posição na ordem de leitura, a nota do
 * curador e o selo de opcional.
 */
export function ComicRow({
  comic,
  showSeries = true,
  position,
  note,
  optional,
  accent = Colors.brand,
}: {
  comic: ComicSummary;
  showSeries?: boolean;
  position?: number;
  note?: string | null;
  optional?: boolean;
  accent?: string;
}) {
  const { comics, active } = useDownloads();
  const downloaded = comics[comic.id];
  const ready = comic.file?.status === 'READY';
  const progress = comic.progress;
  const done = progress?.completed;

  const subtitle = [
    showSeries ? comic.series?.name : null,
    progress && progress.pageCount > 0
      ? done
        ? 'Lida'
        : `Página ${progress.currentPage} de ${progress.pageCount}`
      : null,
    !ready ? fileStatusLabel(comic.file?.status) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/hq/[id]', params: { id: comic.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      {position != null ? (
        <View
          style={[
            styles.position,
            done && { backgroundColor: 'rgba(52, 211, 153, 0.18)' },
            !done && !optional && { borderColor: accent, borderWidth: 1 },
          ]}
        >
          {done ? (
            <Ionicons name="checkmark" size={16} color="#6ee7b7" />
          ) : (
            <Text style={styles.positionText}>{position}</Text>
          )}
        </View>
      ) : null}
      <MediaImage
        url={comic.coverUrl}
        localUri={downloaded?.hasCover ? coverUri(comic.id) : null}
        style={styles.cover}
      />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {comicLabel(comic)}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {optional ? <Badge label="opcional" /> : null}
        {note ? (
          <Text style={styles.note} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      {ready || downloaded ? (
        <DownloadButton
          comicId={comic.id}
          coverUrl={comic.coverUrl}
          downloaded={!!downloaded}
          active={active[comic.id]}
          label={comicLabel(comic)}
        />
      ) : null}
    </Pressable>
  );
}

export function DownloadButton({
  comicId,
  coverUrl,
  downloaded,
  active,
  label,
}: {
  comicId: string;
  coverUrl: string | null;
  downloaded: boolean;
  active?: { done: number; total: number; error?: string };
  label: string;
}) {
  if (downloaded) {
    return (
      <Pressable
        hitSlop={10}
        accessibilityLabel="Remover download"
        onPress={() =>
          Alert.alert('Remover download?', `${label} deixa de estar disponível offline.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Remover', style: 'destructive', onPress: () => removeDownload(comicId) },
          ])
        }
        style={styles.action}
      >
        <Ionicons name="checkmark-circle" size={26} color={Colors.brand} />
      </Pressable>
    );
  }

  if (active?.error) {
    return (
      <Pressable
        hitSlop={10}
        accessibilityLabel="Tentar baixar de novo"
        onPress={() => void startDownload(comicId, coverUrl)}
        onLongPress={() => Alert.alert('Falha no download', active.error)}
        style={styles.action}
      >
        <Ionicons name="refresh-circle" size={26} color={Colors.accent} />
      </Pressable>
    );
  }

  if (active) {
    const percent = active.total ? Math.round((active.done / active.total) * 100) : 0;
    return (
      <Pressable
        hitSlop={10}
        accessibilityLabel="Cancelar download"
        onPress={() => cancelDownload(comicId)}
        style={styles.action}
      >
        {active.total ? (
          <Text style={styles.percent}>{percent}%</Text>
        ) : (
          <ActivityIndicator color={Colors.brand} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      hitSlop={10}
      accessibilityLabel="Baixar para ler offline"
      onPress={() => void startDownload(comicId, coverUrl)}
      style={styles.action}
    >
      <Ionicons name="arrow-down-circle-outline" size={26} color={Colors.ink300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cover: {
    width: 54,
    height: 82,
    borderRadius: 6,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  position: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink800,
  },
  positionText: { color: Colors.ink300, fontSize: 13, fontWeight: '700' },
  note: { color: Colors.ink400, fontSize: 13 },
  title: {
    color: Colors.ink100,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.ink400,
    fontSize: 13,
  },
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    color: Colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
});
