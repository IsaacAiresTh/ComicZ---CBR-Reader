import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { QueryError } from '@/components/QueryError';
import { catalogShelfItem, Shelf, type ShelfItem } from '@/components/Shelf';
import { Body, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { comicLabel, percent, plural } from '@/lib/format';
import { useContinueReading, useGuides, useRecent, useUserStats } from '@/lib/queries';

/** Mesma home do site: números, continue lendo, guias e o que chegou por último. */
export default function HomeScreen() {
  const { user } = useAuth();
  const stats = useUserStats();
  const continueReading = useContinueReading();
  const guides = useGuides();
  const recent = useRecent();

  const queries = [stats, continueReading, guides, recent];
  const refreshing = queries.some((query) => query.isRefetching);
  const refresh = () => queries.forEach((query) => void query.refetch());

  if (queries.every((query) => query.isPending)) return <Loading />;
  if (recent.isError && guides.isError)
    return <QueryError error={recent.error} onRetry={refresh} />;

  const reading: ShelfItem[] = (continueReading.data ?? []).map((comic) => ({
    key: comic.id,
    title: comicLabel(comic),
    subtitle: comic.series?.name,
    coverUrl: comic.coverUrl,
    progress: comic.progress ? percent(comic.progress.currentPage, comic.progress.pageCount) : null,
    // Continuar é o que se quer daqui: direto para o leitor.
    onPress: () => router.push({ pathname: '/ler/[id]', params: { id: comic.id } }),
  }));

  const guideItems: ShelfItem[] = (guides.data ?? [])
    .filter((guide) => guide.published && guide.kind !== 'EVENT')
    .slice(0, 10)
    .map((guide) => ({
      key: guide.id,
      title: guide.title,
      subtitle: plural(guide.itemCount, 'HQ', 'HQs'),
      coverUrl: guide.coverUrl,
      onPress: () => router.push({ pathname: '/guias/[slug]', params: { slug: guide.slug } }),
    }));

  const recentItems: ShelfItem[] = (recent.data?.items ?? []).map(catalogShelfItem);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: Spacing.five }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.hello}>Olá, {user?.username}</Text>
        <Body muted style={{ fontSize: 14 }}>
          Não sabe por onde começar? Escolha um guia de leitura e siga a ordem.
        </Body>
      </View>

      {stats.data ? (
        <View style={styles.stats}>
          {[
            { label: 'HQs salvas', value: stats.data.inLibrary },
            { label: 'Lendo agora', value: stats.data.reading },
            { label: 'Concluídas', value: stats.data.finished },
            { label: 'Favoritas', value: stats.data.favorites },
          ].map((card) => (
            <Pressable
              key={card.label}
              style={styles.stat}
              onPress={() => router.navigate('/biblioteca')}
            >
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Shelf title="Continue lendo" items={reading} />
      <Shelf
        title="Guias de leitura"
        items={guideItems}
        actionLabel="ver todos"
        onAction={() => router.push('/guias')}
      />
      <Shelf
        title="Adicionadas recentemente"
        items={recentItems}
        actionLabel="ver catálogo"
        onAction={() => router.navigate('/catalogo')}
      />

      {recentItems.length === 0 && guideItems.length === 0 && !recent.isPending ? (
        <EmptyState
          title="O catálogo está vazio"
          message="Assim que HQs forem enviadas pelo site, elas aparecem aqui."
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: 4 },
  hello: { color: Colors.ink100, fontSize: 24, fontWeight: '800' },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    backgroundColor: Colors.ink850,
  },
  statValue: { color: Colors.ink100, fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.ink400, fontSize: 12, marginTop: 2 },
});
