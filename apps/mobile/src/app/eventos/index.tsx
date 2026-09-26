import { View } from 'react-native';
import { router, Stack } from 'expo-router';

import { CoverGrid } from '@/components/CoverGrid';
import { QueryError } from '@/components/QueryError';
import { Body, EmptyState, Loading } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useGuides } from '@/lib/queries';

export default function EventsScreen() {
  const query = useGuides();

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const events = query.data.filter((guide) => guide.kind === 'EVENT');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.ink900 }}>
      <Stack.Screen options={{ title: 'Grandes sagas' }} />
      <CoverGrid
        header={
          <Body muted style={{ fontSize: 14 }}>
            Os eventos que atravessam várias revistas, com a trilha cronológica inteira em ordem de
            leitura — prólogos, tie-ins e epílogos no lugar certo.
          </Body>
        }
        empty={<EmptyState title="Nenhum evento ainda" />}
        items={events.map((event) => ({
          key: event.id,
          title: event.title,
          subtitle: [
            plural(event.itemCount, 'edição', 'edições'),
            event.published ? null : 'rascunho',
          ]
            .filter(Boolean)
            .join(' · '),
          coverUrl: event.coverUrl,
          onPress: () => router.push({ pathname: '/eventos/[slug]', params: { slug: event.slug } }),
        }))}
      />
    </View>
  );
}

export { ErrorBoundary } from '@/components/RouteError';
