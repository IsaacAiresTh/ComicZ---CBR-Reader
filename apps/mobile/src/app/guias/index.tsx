import { View } from 'react-native';
import { router, Stack } from 'expo-router';

import { CoverGrid } from '@/components/CoverGrid';
import { QueryError } from '@/components/QueryError';
import { Body, EmptyState, Loading } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useGuides } from '@/lib/queries';

export default function GuidesScreen() {
  const query = useGuides();

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  // Evento tem lista própria; listar nos dois lugares só duplicaria a mesma saga.
  const guides = query.data.filter((guide) => guide.kind !== 'EVENT');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.ink900 }}>
      <Stack.Screen options={{ title: 'Guias de leitura' }} />
      <CoverGrid
        header={
          <Body muted style={{ fontSize: 14 }}>
            Cada guia é uma ordem de leitura pensada para quem está começando. Siga do começo ao fim
            sem precisar pesquisar cronologia.
          </Body>
        }
        empty={
          <EmptyState
            title="Nenhum guia ainda"
            message="Assim que um guia for publicado ele aparece aqui."
          />
        }
        items={guides.map((guide) => ({
          key: guide.id,
          title: guide.title,
          subtitle: [plural(guide.itemCount, 'HQ', 'HQs'), guide.published ? null : 'rascunho']
            .filter(Boolean)
            .join(' · '),
          coverUrl: guide.coverUrl,
          onPress: () => router.push({ pathname: '/guias/[slug]', params: { slug: guide.slug } }),
        }))}
      />
    </View>
  );
}

export { ErrorBoundary } from '@/components/RouteError';
