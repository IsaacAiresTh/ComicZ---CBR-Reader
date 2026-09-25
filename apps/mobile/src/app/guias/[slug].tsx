import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { CharacterText } from '@/components/CharacterText';
import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { Badge, Loading, ProgressBar } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { percent } from '@/lib/format';
import { useGuide } from '@/lib/queries';

export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useGuide(slug);

  // Link antigo para uma saga que virou evento continua valendo.
  const isEvent = query.data?.kind === 'EVENT';
  useEffect(() => {
    if (isEvent) router.replace({ pathname: '/eventos/[slug]', params: { slug } });
  }, [isEvent, slug]);

  if (query.isPending || isEvent) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const guide = query.data;
  const readCount = guide.readCount ?? 0;
  const progress = percent(readCount, guide.itemCount);

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
            <View style={{ gap: 6, marginTop: Spacing.two }}>
              <View style={styles.progressLabels}>
                <Text style={styles.small}>
                  {readCount} de {guide.itemCount} lidas
                </Text>
                <Text style={styles.small}>{progress}%</Text>
              </View>
              <ProgressBar value={progress} />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Este guia ainda não tem HQs.</Text>}
        renderItem={({ item }) => (
          <ComicRow
            comic={item.comic}
            position={item.position}
            note={item.note}
            optional={item.optional}
          />
        )}
      />
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
  title: { color: Colors.ink100, fontSize: 26, fontWeight: '800' },
  summary: { color: Colors.ink300, fontSize: 16, lineHeight: 23 },
  description: { color: Colors.ink400, fontSize: 14, lineHeight: 21 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { color: Colors.ink400, fontSize: 12 },
  empty: { color: Colors.ink500, textAlign: 'center', padding: Spacing.four },
});
