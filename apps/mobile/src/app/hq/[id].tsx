import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { LibraryStatus } from '@comicz/shared';

import { CharacterText } from '@/components/CharacterText';
import { CollectionPicker } from '@/components/CollectionPicker';
import { QueryError } from '@/components/QueryError';
import { Badge, Body, Button, Eyebrow, Loading, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  cancelDownload,
  coverUri,
  formatBytes,
  removeDownload,
  startDownload,
  useDownloads,
} from '@/lib/downloads';
import { comicLabel, fileStatusLabel, percent } from '@/lib/format';
import { useComic, useLibraryActions } from '@/lib/queries';

export default function ComicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useComic(id);
  const library = useLibraryActions();
  const { comics: downloaded, active } = useDownloads();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const comic = query.data;
  const readable = comic.file?.status === 'READY';
  const progress = comic.progress;
  const started = Boolean(progress && progress.currentPage > 1 && !progress.completed);
  const local = downloaded[comic.id];
  const downloading = active[comic.id];
  const busy = library.add.isPending || library.remove.isPending || library.update.isPending;

  const run = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) =>
      Alert.alert('Não deu para salvar', error instanceof Error ? error.message : undefined),
    );

  return (
    <>
      <Stack.Screen options={{ title: comicLabel(comic) }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <MediaImage
          url={comic.coverUrl}
          localUri={local?.hasCover ? coverUri(comic.id) : null}
          style={styles.cover}
        />

        <View style={{ gap: Spacing.two }}>
          {comic.series ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/saga/[id]', params: { id: comic.series!.id } })
              }
            >
              <Text style={styles.series}>{comic.series.name}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{comicLabel(comic)}</Text>
          <View style={styles.badges}>
            {comic.publisher ? <Badge label={comic.publisher.name} /> : null}
            {comic.publicationDate ? (
              <Badge label={String(new Date(comic.publicationDate).getFullYear())} />
            ) : null}
            {comic.file ? (
              <Badge
                label={fileStatusLabel(comic.file.status)}
                tone={readable ? 'success' : comic.file.status === 'FAILED' ? 'danger' : 'warning'}
              />
            ) : null}
            {comic.file?.pageCount ? <Badge label={`${comic.file.pageCount} páginas`} /> : null}
            {local ? (
              <Badge label={`Baixada · ${formatBytes(local.sizeBytes)}`} tone="brand" />
            ) : null}
          </View>
        </View>

        {progress && progress.pageCount > 0 ? (
          <View style={{ gap: 6 }}>
            <View style={styles.progressLabels}>
              <Text style={styles.small}>
                {progress.completed
                  ? 'Leitura concluída'
                  : `Página ${progress.currentPage} de ${progress.pageCount}`}
              </Text>
              <Text style={styles.small}>{percent(progress.currentPage, progress.pageCount)}%</Text>
            </View>
            <ProgressBar value={percent(progress.currentPage, progress.pageCount)} />
          </View>
        ) : null}

        <View style={{ gap: Spacing.two }}>
          <Button
            label={
              readable || local
                ? started
                  ? 'Continuar leitura'
                  : progress?.completed
                    ? 'Ler de novo'
                    : 'Ler agora'
                : comic.file
                  ? fileStatusLabel(comic.file.status)
                  : 'Sem arquivo'
            }
            disabled={!readable && !local}
            onPress={() => router.push({ pathname: '/ler/[id]', params: { id: comic.id } })}
          />
          {readable || local ? (
            <Button
              variant="ghost"
              label={
                local
                  ? 'Remover download'
                  : downloading?.error
                    ? 'Tentar baixar de novo'
                    : downloading
                      ? downloading.total
                        ? `Baixando ${percent(downloading.done, downloading.total)}% · cancelar`
                        : 'Preparando download · cancelar'
                      : 'Baixar para ler offline'
              }
              onPress={() => {
                if (local) {
                  Alert.alert('Remover download?', 'Ela deixa de estar disponível offline.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Remover',
                      style: 'destructive',
                      onPress: () => removeDownload(comic.id),
                    },
                  ]);
                } else if (downloading && !downloading.error) {
                  cancelDownload(comic.id);
                } else {
                  void startDownload(comic.id, comic.coverUrl);
                }
              }}
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
          <Action
            label={comic.libraryStatus === 'READ' ? 'Lida ✓' : 'Marcar lida'}
            active={comic.libraryStatus === 'READ'}
            disabled={busy}
            onPress={() =>
              void run(
                library.update.mutateAsync({
                  comicId: comic.id,
                  status: (comic.libraryStatus === 'READ' ? 'READING' : 'READ') as LibraryStatus,
                }),
              )
            }
          />
          <Action label="Guardar em pasta" onPress={() => setPickerOpen(true)} />
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

        {comic.creators.length > 0 ? (
          <Meta label="Autores" value={comic.creators.map((creator) => creator.name).join(', ')} />
        ) : null}
        {comic.characters.length > 0 ? (
          <Meta label="Personagens" value={comic.characters.join(', ')} />
        ) : null}
        {comic.tags.length > 0 ? <Meta label="Tags" value={comic.tags.join(', ')} /> : null}
      </ScrollView>

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
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        active && styles.actionActive,
        (pressed || disabled) && { opacity: 0.6 },
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
  cover: { width: 200, height: 300, borderRadius: 12, alignSelf: 'center' },
  series: { color: Colors.brandLight, fontSize: 14 },
  title: { color: Colors.ink100, fontSize: 26, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
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
