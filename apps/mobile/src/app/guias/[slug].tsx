import { useEffect } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CharacterText } from '@/components/CharacterText';
import { nextItem } from '@/components/EventTrail';
import { QueryError } from '@/components/QueryError';
import { TrailStop } from '@/components/ReadingTrail';
import { Badge, Button, Loading } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { enqueueDownloads, useDownloads } from '@/lib/downloads';
import { plural } from '@/lib/format';
import { useAddManyToLibrary, useGuide } from '@/lib/queries';

export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useGuide(slug);
  const { comics: downloaded, active } = useDownloads();
  const addMany = useAddManyToLibrary();

  // Link antigo para uma saga que virou evento continua valendo.
  const isEvent = query.data?.kind === 'EVENT';
  useEffect(() => {
    if (isEvent) router.replace({ pathname: '/eventos/[slug]', params: { slug } });
  }, [isEvent, slug]);

  if (query.isPending || isEvent) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const guide = query.data;
  const readCount = guide.readCount ?? 0;
  const current = readCount < guide.itemCount ? nextItem(guide.items) : null;
  const toDownload = guide.items.filter(
    (item) =>
      item.comic.file?.status === 'READY' &&
      !item.comic.progress?.completed &&
      !downloaded[item.comic.id] &&
      !active[item.comic.id],
  );
  const notSaved = guide.items.filter((item) => !item.comic.inLibrary);

  return (
    <>
      <Stack.Screen options={{ title: guide.title }} />
      <FlatList
        style={styles.screen}
        data={guide.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: Spacing.five }}
        ListHeaderComponent={
          <View style={styles.header}>
            {!guide.published ? <Badge label="rascunho" tone="warning" /> : null}
            <Text style={styles.title}>{guide.title}</Text>
            {guide.summary ? (
              <CharacterText
                texto={guide.summary}
                style={styles.summary}
                linkColor={Colors.brandLight}
              />
            ) : null}
            {guide.description ? (
              <CharacterText
                texto={guide.description}
                style={styles.description}
                linkColor={Colors.brandLight}
              />
            ) : null}
            <View style={styles.progress}>
              <View style={styles.segments}>
                {guide.items.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.segment,
                      item.comic.progress?.completed && { backgroundColor: Colors.success },
                      item.id === current?.id && { backgroundColor: Colors.brand },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.small}>
                <Text style={{ color: Colors.ink100, fontWeight: '800' }}>{readCount}</Text> de{' '}
                {guide.itemCount}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Este guia ainda não tem HQs.</Text>}
        renderItem={({ item, index }) => (
          <TrailStop
            item={item}
            current={item.id === current?.id}
            first={index === 0}
            last={index === guide.items.length - 1}
          />
        )}
      />
      {toDownload.length > 0 || notSaved.length > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          {toDownload.length > 0 ? (
            <Button
              variant="secondary"
              label={`Baixar ${plural(toDownload.length, 'que falta', 'que faltam')}`}
              style={{ flex: 1 }}
              onPress={() =>
                enqueueDownloads(
                  toDownload.map((item) => ({
                    comicId: item.comic.id,
                    coverUrl: item.comic.coverUrl,
                  })),
                )
              }
            />
          ) : null}
          {notSaved.length > 0 ? (
            <Button
              variant="secondary"
              label="Guardar na biblioteca"
              loading={addMany.isPending}
              style={{ flex: 1 }}
              onPress={() =>
                addMany
                  .mutateAsync(notSaved.map((item) => item.comic.id))
                  .catch((error: unknown) =>
                    Alert.alert(
                      'Não deu para salvar',
                      error instanceof Error ? error.message : undefined,
                    ),
                  )
              }
            />
          ) : null}
        </SafeAreaView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  header: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ink800,
    marginBottom: Spacing.two,
  },
  title: {
    color: Colors.ink100,
    fontFamily: Fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.two },
  segments: { flex: 1, flexDirection: 'row', gap: 3, height: 8 },
  segment: { flex: 1, borderRadius: 3, backgroundColor: Colors.ink700 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  summary: { color: Colors.ink300, fontSize: 16, lineHeight: 23 },
  description: { color: Colors.ink400, fontSize: 14, lineHeight: 21 },
  small: { color: Colors.ink400, fontSize: 12 },
  empty: { color: Colors.ink500, textAlign: 'center', padding: Spacing.four },
});

export { ErrorBoundary } from '@/components/RouteError';
