import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DownloadButton } from '@/components/ComicRow';
import { Button, EmptyState, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { comicLabel, percent, plural } from '@/lib/format';
import {
  cancelAllDownloads,
  coverUri,
  formatBytes,
  freeDiskSpace,
  getDownloaded,
  removeDownload,
  useDownloads,
  type DownloadedComic,
} from '@/lib/downloads';
import { getLocalProgress } from '@/lib/progress';

function isFinished(comic: DownloadedComic): boolean {
  const progress = getLocalProgress(comic.comicId);
  return Boolean(progress && progress.currentPage >= comic.pageCount);
}

function open(comic: DownloadedComic) {
  if (!getDownloaded(comic.comicId)) {
    Alert.alert('Download indisponível', 'Esta HQ foi removida do aparelho.');
    return;
  }
  router.push({ pathname: '/ler/[id]', params: { id: comic.comicId } });
}

interface Group {
  key: string;
  name: string;
  comics: DownloadedComic[];
  bytes: number;
}

/**
 * Tudo que está no aparelho. Não chama a API: é o que funciona no avião, e por
 * isso aparece também fora da conta (tela `offline`). Em cima, quanto ocupa e
 * o que está baixando; depois a HQ para continuar; depois tudo, por saga.
 */
export function DownloadsList() {
  const { comics, active } = useDownloads();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const saved = Object.values(comics).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
  const total = saved.reduce((sum, comic) => sum + comic.sizeBytes, 0);
  const finished = saved.filter(isFinished);
  const finishedBytes = finished.reduce((sum, comic) => sum + comic.sizeBytes, 0);
  const free = freeDiskSpace();

  const working = Object.entries(active).filter(([id, item]) => !comics[id] && !item.error);
  const failed = Object.entries(active).filter(([id, item]) => !comics[id] && item.error);
  const running = working.find(([, item]) => !item.queued);

  // A HQ para ler agora: a mais recente com leitura começada e não terminada.
  const resume = saved
    .map((comic) => ({ comic, progress: getLocalProgress(comic.comicId) }))
    .filter(({ comic, progress }) => progress && progress.currentPage < comic.pageCount)
    .sort((a, b) => b.progress!.updatedAt.localeCompare(a.progress!.updatedAt))[0];

  const groups: Group[] = [];
  for (const comic of saved) {
    const key = comic.seriesId ?? comic.seriesName ?? `avulsa-${comic.comicId}`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, name: comic.seriesName ?? comicLabel(comic), comics: [], bytes: 0 };
      groups.push(group);
    }
    group.comics.push(comic);
    group.bytes += comic.sizeBytes;
  }
  for (const group of groups)
    group.comics.sort((a, b) => (a.issueNumber ?? 0) - (b.issueNumber ?? 0));

  if (saved.length === 0 && working.length === 0 && failed.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Nada baixado ainda"
          message="Na página de uma HQ ou de uma saga, toque em baixar para ler sem internet."
        />
      </View>
    );
  }

  const freeUp = () =>
    Alert.alert(
      'Liberar espaço?',
      `Remove do celular as ${plural(finished.length, 'HQ já lida', 'HQs já lidas')} (${formatBytes(finishedBytes)}). Elas continuam no site.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => finished.forEach((comic) => removeDownload(comic.comicId)),
        },
      ],
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.storageRow}>
          <Text style={styles.storageMain}>
            <Text style={styles.storageBig}>{formatBytes(total)}</Text> neste celular
          </Text>
          {free != null ? <Text style={styles.muted}>{formatBytes(free)} livres</Text> : null}
        </View>
        {free != null ? (
          <ProgressBar value={Math.min(100, (total / (total + free)) * 100)} />
        ) : null}
        {finished.length > 0 ? (
          <View style={styles.storageRow}>
            <Text style={[styles.muted, { flex: 1 }]}>
              {plural(finished.length, 'já lida ocupa', 'já lidas ocupam')}{' '}
              {formatBytes(finishedBytes)}
            </Text>
            <Pressable hitSlop={10} onPress={freeUp}>
              <Text style={styles.link}>Liberar espaço</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {working.length > 0 ? (
        <View style={[styles.card, styles.activeCard]}>
          <View style={styles.storageRow}>
            <Text style={styles.activeTitle} numberOfLines={1}>
              {running && running[1].total
                ? `Baixando · ${running[1].done} de ${running[1].total} páginas`
                : 'Preparando o download…'}
            </Text>
            {running && running[1].total ? (
              <Text style={styles.link}>{percent(running[1].done, running[1].total)}%</Text>
            ) : null}
          </View>
          {running && running[1].total ? (
            <ProgressBar value={percent(running[1].done, running[1].total)} />
          ) : null}
          <View style={styles.storageRow}>
            <Text style={[styles.muted, { flex: 1 }]}>
              {working.length > 1
                ? `mais ${plural(working.length - 1, 'HQ na fila', 'HQs na fila')}`
                : 'última da fila'}
            </Text>
            <Pressable hitSlop={10} onPress={cancelAllDownloads}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {failed.map(([id, item]) => (
        <View key={id} style={[styles.card, styles.failedCard]}>
          <Text style={[styles.muted, { flex: 1 }]} numberOfLines={2}>
            Falha no download: {item.error}
          </Text>
          <DownloadButton
            comicId={id}
            coverUrl={null}
            downloaded={false}
            active={item}
            label="Esta HQ"
          />
        </View>
      ))}

      {resume ? (
        <>
          <Text style={styles.section}>CONTINUE SEM INTERNET</Text>
          <Pressable
            style={({ pressed }) => [styles.resume, pressed && { opacity: 0.8 }]}
            onPress={() => open(resume.comic)}
          >
            <MediaImage
              url={null}
              localUri={resume.comic.hasCover ? coverUri(resume.comic.comicId) : null}
              style={styles.resumeCover}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.title} numberOfLines={2}>
                {comicLabel(resume.comic)}
              </Text>
              <ProgressBar value={percent(resume.progress!.currentPage, resume.comic.pageCount)} />
              <Text style={styles.muted}>
                página {resume.progress!.currentPage} de {resume.comic.pageCount}
              </Text>
            </View>
            <Button
              label="Ler"
              onPress={() => open(resume.comic)}
              style={{ paddingHorizontal: 18 }}
            />
          </Pressable>
        </>
      ) : null}

      {groups.length > 0 ? <Text style={styles.section}>POR SAGA</Text> : null}
      {groups.map((group) => {
        const expanded = openGroup === group.key || groups.length === 1;
        const first = group.comics[0]!;
        const read = group.comics.filter(isFinished).length;
        return (
          <View key={group.key} style={styles.group}>
            <Pressable
              style={styles.groupHead}
              onPress={() => setOpenGroup(expanded ? null : group.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <MediaImage
                url={null}
                localUri={first.hasCover ? coverUri(first.comicId) : null}
                style={styles.groupCover}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {group.name}
                </Text>
                <Text style={styles.muted}>
                  {plural(group.comics.length, 'edição', 'edições')} · {formatBytes(group.bytes)}
                  {read > 0 ? ` · ${read} lidas` : ''}
                </Text>
              </View>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.ink400}
              />
            </Pressable>
            {expanded
              ? group.comics.map((comic) => <DownloadedRow key={comic.comicId} comic={comic} />)
              : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function DownloadedRow({ comic }: { comic: DownloadedComic }) {
  const progress = getLocalProgress(comic.comicId);
  const label = comicLabel(comic);
  const done = progress && progress.currentPage >= comic.pageCount;
  const detail = [
    done
      ? 'lida'
      : progress
        ? `página ${progress.currentPage} de ${comic.pageCount}`
        : `${comic.pageCount} páginas`,
    formatBytes(comic.sizeBytes),
  ].join(' · ');

  return (
    <Pressable
      onPress={() => open(comic)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.muted, done ? { color: Colors.success } : null]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <DownloadButton comicId={comic.comicId} coverUrl={null} downloaded label={label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  content: { padding: Spacing.three, gap: 12, paddingBottom: Spacing.five },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  activeCard: { borderColor: 'rgba(245, 179, 1, 0.35)' },
  failedCard: { flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(224, 49, 49, 0.4)' },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  storageMain: { color: Colors.ink300, fontSize: 14 },
  storageBig: { color: Colors.ink100, fontSize: 20, fontWeight: '800' },
  activeTitle: { flex: 1, color: Colors.ink100, fontSize: 14, fontWeight: '700' },
  muted: { color: Colors.ink400, fontSize: 13 },
  link: { color: Colors.brandLight, fontSize: 13, fontWeight: '700' },
  section: {
    color: Colors.ink400,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginTop: Spacing.two,
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.35)',
    backgroundColor: '#13110a',
  },
  resumeCover: { width: 56, height: 84, borderRadius: 6 },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
    overflow: 'hidden',
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  groupCover: { width: 44, height: 66, borderRadius: 5 },
  title: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.ink700,
  },
  rowTitle: { color: Colors.ink100, fontSize: 14, fontWeight: '600' },
});
