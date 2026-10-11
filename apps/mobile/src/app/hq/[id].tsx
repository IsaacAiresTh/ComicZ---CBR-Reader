import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LibraryStatus } from '@comicz/shared';

import { ActionSheet, type SheetAction } from '@/components/ActionSheet';
import { CharacterText } from '@/components/CharacterText';
import { CollectionPicker } from '@/components/CollectionPicker';
import { QueryError } from '@/components/QueryError';
import { Badge, Body, Button, Eyebrow, Loading, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  cancelDownload,
  coverUri,
  formatBytes,
  removeDownload,
  startDownload,
  useDownloads,
} from '@/lib/downloads';
import { comicLabel, fileStatusLabel, percent, plural } from '@/lib/format';
import { useComic, useLibraryActions } from '@/lib/queries';

export default function ComicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useComic(id);
  const library = useLibraryActions();
  const { comics: downloaded, active } = useDownloads();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const comic = query.data;
  const readable = comic.file?.status === 'READY';
  const progress = comic.progress;
  const started = Boolean(progress && progress.currentPage > 1 && !progress.completed);
  const local = downloaded[comic.id];
  const downloading = active[comic.id];
  const busy =
    library.add.isPending ||
    library.remove.isPending ||
    library.update.isPending ||
    library.addSeries.isPending;

  const run = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) =>
      Alert.alert('Não deu para salvar', error instanceof Error ? error.message : undefined),
    );

  // Atalho para quem procura a saga inteira aqui, e não na página da saga.
  const addSeries = (seriesId: string) =>
    void run(
      library.addSeries
        .mutateAsync(seriesId)
        .then((result) =>
          setMessage(
            result.added === 0
              ? 'A saga inteira já estava na biblioteca'
              : result.alreadyInLibrary > 0
                ? `${result.added} adicionadas · ${result.alreadyInLibrary} já estavam`
                : plural(result.added, 'edição adicionada', 'edições adicionadas'),
          ),
        ),
    );

  const pageCount = comic.file?.pageCount ?? progress?.pageCount ?? null;
  const year = comic.publicationDate ? new Date(comic.publicationDate).getFullYear() : null;
  const meta = [
    comic.publisher?.name,
    year,
    pageCount ? plural(pageCount, 'página', 'páginas') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const readLabel =
    readable || local
      ? started
        ? `Continuar · página ${progress!.currentPage}`
        : progress?.completed
          ? 'Ler de novo'
          : 'Ler agora'
      : comic.file
        ? fileStatusLabel(comic.file.status)
        : 'Sem arquivo';

  const downloadLabel = local
    ? `Baixada · ${formatBytes(local.sizeBytes)}`
    : downloading?.error
      ? 'Falhou · tentar de novo'
      : downloading?.queued
        ? 'Na fila · tirar da fila'
        : downloading
          ? downloading.total
            ? `Baixando ${percent(downloading.done, downloading.total)}% · cancelar`
            : 'Preparando · cancelar'
          : 'Baixar para ler sem internet';

  const onDownload = () => {
    if (local) {
      Alert.alert('Remover download?', 'Ela deixa de estar disponível sem internet.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => removeDownload(comic.id) },
      ]);
    } else if (downloading && !downloading.error) {
      cancelDownload(comic.id);
    } else {
      void startDownload(comic.id, comic.coverUrl);
    }
  };

  const sheetActions: SheetAction[] = [
    {
      label: comic.libraryStatus === 'READ' ? 'Marcar como não lida' : 'Marcar como lida',
      onPress: () =>
        void run(
          library.update.mutateAsync({
            comicId: comic.id,
            status: (comic.libraryStatus === 'READ' ? 'READING' : 'READ') as LibraryStatus,
          }),
        ),
    },
    ...(comic.series
      ? [{ label: 'Guardar a saga inteira', onPress: () => addSeries(comic.series!.id) }]
      : []),
    { label: 'Guardar em pasta', onPress: () => setPickerOpen(true) },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: comicLabel(comic),
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Mais ações"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.ink100} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <MediaImage
            url={comic.coverUrl}
            localUri={local?.hasCover ? coverUri(comic.id) : null}
            style={styles.cover}
          />
          <View style={styles.heroText}>
            {comic.series ? (
              <Pressable
                hitSlop={6}
                onPress={() =>
                  router.push({ pathname: '/saga/[id]', params: { id: comic.series!.id } })
                }
              >
                <Text style={styles.series} numberOfLines={2}>
                  {comic.series.name} ›
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.title}>{comicLabel(comic)}</Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {comic.file && !readable ? (
              <Badge
                label={fileStatusLabel(comic.file.status)}
                tone={comic.file.status === 'FAILED' ? 'danger' : 'warning'}
              />
            ) : null}
            {progress && progress.pageCount > 0 ? (
              <View style={styles.progress}>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    value={percent(progress.currentPage, progress.pageCount)}
                    color={progress.completed ? Colors.success : Colors.brand}
                  />
                </View>
                <Text style={styles.small}>
                  {progress.completed ? 'lida' : `p. ${progress.currentPage}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Button
            label={readLabel}
            disabled={!readable && !local}
            onPress={() => router.push({ pathname: '/ler/[id]', params: { id: comic.id } })}
          />
          {readable || local ? (
            <Button
              variant="secondary"
              label={downloadLabel}
              icon={
                <Ionicons
                  name={
                    local
                      ? 'checkmark-circle'
                      : downloading?.error
                        ? 'refresh'
                        : downloading
                          ? 'close'
                          : 'arrow-down'
                  }
                  size={18}
                  color={local ? Colors.success : Colors.ink100}
                />
              }
              onPress={onDownload}
            />
          ) : null}
        </View>

        <View style={styles.actions}>
          <Action
            label={comic.inLibrary ? 'Na biblioteca ✓' : '+ Biblioteca'}
            active={!!comic.inLibrary}
            disabled={busy}
            onPress={() =>
              void run(
                comic.inLibrary
                  ? library.remove.mutateAsync(comic.id)
                  : library.add.mutateAsync(comic.id),
              )
            }
          />
          <Action
            label={comic.favorite ? '★ Favorita' : '☆ Favoritar'}
            active={!!comic.favorite}
            disabled={busy}
            onPress={() =>
              void run(library.update.mutateAsync({ comicId: comic.id, favorite: !comic.favorite }))
            }
          />
          {comic.libraryStatus === 'READ' ? <Action label="Lida ✓" active disabled /> : null}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {comic.file?.status === 'FAILED' && comic.file.errorMessage ? (
          <Text style={styles.error}>Falha no processamento: {comic.file.errorMessage}</Text>
        ) : null}

        {comic.description ? (
          <CharacterText
            texto={comic.description}
            style={styles.description}
            linkColor={Colors.brandLight}
          />
        ) : null}

        {comic.characters.length > 0 ? (
          <View style={styles.metaBox}>
            <Eyebrow>Nesta edição</Eyebrow>
            <CharacterText
              texto={comic.characters.join(', ')}
              style={styles.metaText}
              linkColor={Colors.brandLight}
            />
          </View>
        ) : null}
        {comic.creators.length > 0 ? (
          <Meta label="Autores" value={comic.creators.map((creator) => creator.name).join(', ')} />
        ) : null}
        {comic.tags.length > 0 ? <Meta label="Tags" value={comic.tags.join(', ')} /> : null}
      </ScrollView>

      <ActionSheet
        visible={sheetOpen}
        title={comicLabel(comic).toUpperCase()}
        actions={sheetActions}
        onClose={() => setSheetOpen(false)}
      />
      <CollectionPicker
        target={{ kind: 'comic', id: comic.id }}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onDone={setMessage}
      />
    </>
  );
}

function Action({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        active && styles.actionActive,
        pressed && { opacity: 0.6 },
        disabled && !active && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.actionLabel, active && { color: Colors.brandLight }]}>{label}</Text>
    </Pressable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Eyebrow>{label}</Eyebrow>
      <Body style={{ color: Colors.ink300 }}>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.five },
  hero: { flexDirection: 'row', gap: 16 },
  cover: {
    width: 124,
    height: 186,
    borderRadius: 8,
    boxShadow: `4px 4px 0 0 ${Colors.brand}`,
  },
  heroText: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  series: { color: Colors.brandLight, fontSize: 13, fontWeight: '700' },
  title: {
    color: Colors.ink100,
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  meta: { color: Colors.ink300, fontSize: 13 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaBox: { gap: 4 },
  metaText: { color: Colors.ink300, fontSize: 15, lineHeight: 22 },
  small: { color: Colors.ink400, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  actionActive: { borderColor: Colors.brand },
  actionLabel: { color: Colors.ink200, fontSize: 14, fontWeight: '600' },
  message: { color: '#6ee7b7', fontSize: 14 },
  error: { color: Colors.accent, fontSize: 14 },
  description: { color: Colors.ink300, fontSize: 15, lineHeight: 23 },
});

export { ErrorBoundary } from '@/components/RouteError';
