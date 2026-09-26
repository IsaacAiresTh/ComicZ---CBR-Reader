import { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { nextItem, trailRows, TrailRowView } from '@/components/EventTrail';
import { QueryError } from '@/components/QueryError';
import { Button, Loading, ProgressBar } from '@/components/ui';
import { Colors, mix, Spacing } from '@/constants/theme';
import { percent, plural } from '@/lib/format';
import { useGuide } from '@/lib/queries';

/**
 * As edições de uma história do mapa — o "Ver edições" da folha. Mesma trilha
 * do site para o bloco escolhido, com atos e "só o essencial".
 */
export default function EventBlockScreen() {
  const { slug, bloco } = useLocalSearchParams<{ slug: string; bloco: string }>();
  const query = useGuide(slug);
  const [essentialOnly, setEssentialOnly] = useState(false);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const guide = query.data;
  const node = guide.nodes.find((candidate) => candidate.id === bloco);
  const accent = guide.accentColor ?? Colors.brand;
  const items = guide.items.filter((item) => item.nodeId === bloco);
  const optionalCount = items.filter((item) => item.optional).length;
  const next = nextItem(items);
  const read = node?.readCount ?? 0;
  const total = node?.itemCount ?? items.length;

  return (
    <>
      <Stack.Screen options={{ title: node?.label ?? guide.title }} />
      <FlatList
        style={styles.screen}
        data={trailRows(items, essentialOnly)}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingBottom: Spacing.five }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.event, { color: mix(accent, '#ffffff', 0.35) }]}>
              {guide.title}
            </Text>
            <Text style={styles.title}>{node?.label ?? 'História'}</Text>
            {node?.note ? <Text style={styles.note}>{node.note}</Text> : null}
            <View style={{ gap: 6 }}>
              <View style={styles.labels}>
                <Text style={styles.small}>
                  {plural(total, 'edição', 'edições')} · {read} {read === 1 ? 'lida' : 'lidas'}
                </Text>
                <Text style={styles.small}>{percent(read, total)}%</Text>
              </View>
              <ProgressBar value={percent(read, total)} color={accent} />
            </View>
            {next ? (
              <Button
                label={read === 0 ? 'Começar' : read >= total ? 'Reler' : 'Continuar'}
                onPress={() =>
                  router.push({ pathname: '/ler/[id]', params: { id: next.comic.id } })
                }
              />
            ) : null}
            {optionalCount > 0 ? (
              <View style={styles.toggle}>
                <Text style={styles.small}>
                  Só o essencial ({items.length - optionalCount} de {items.length})
                </Text>
                <Switch
                  value={essentialOnly}
                  onValueChange={setEssentialOnly}
                  trackColor={{ true: accent, false: Colors.ink700 }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Esta história ainda não tem edições.</Text>}
        renderItem={({ item }) => <TrailRowView row={item} accent={accent} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  header: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ink800,
    marginBottom: Spacing.two,
  },
  event: { fontSize: 12, fontWeight: '600' },
  title: { color: Colors.ink100, fontSize: 24, fontWeight: '800' },
  note: { color: Colors.ink300, fontSize: 14, lineHeight: 21 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { color: Colors.ink400, fontSize: 12 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { color: Colors.ink500, textAlign: 'center', padding: Spacing.four },
});

export { ErrorBoundary } from '@/components/RouteError';
