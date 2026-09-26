import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CollectionSummary, LibraryGroup, Paginated } from '@comicz/shared';

import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { LibrarySeriesRow } from '@/components/SeriesRow';
import { Button, Chip, EmptyState, Loading, MediaImage, SectionHeader } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { useCollectionActions, useCollections } from '@/lib/queries';

const TABS = [
  { key: 'all', label: 'Tudo' },
  { key: 'READING', label: 'Lendo' },
  { key: 'WANT_TO_READ', label: 'Quero ler' },
  { key: 'READ', label: 'Lidas' },
  { key: 'favorites', label: 'Favoritas' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * A biblioteca do site: pastas no topo, depois as sagas como coleção e as
 * HQs avulsas, filtradas pelo status. Ler uma HQ não a coloca aqui — a
 * biblioteca é o que a pessoa escolheu guardar.
 */
export default function LibraryScreen() {
  const [tab, setTab] = useState<TabKey>('all');

  const query = useInfiniteQuery({
    queryKey: ['library', tab],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), perPage: '30' });
      if (tab === 'favorites') params.set('favorite', 'true');
      else if (tab !== 'all') params.set('status', tab);
      return api<Paginated<LibraryGroup>>(`/library?${params}`);
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const groups = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total;

  return (
    <View style={styles.screen}>
      <FlatList
        data={query.isSuccess ? groups : []}
        keyExtractor={(group) =>
          group.kind === 'series' ? `s-${group.series.id}` : `c-${group.entry.comic.id}`
        }
        renderItem={({ item }) => <LibraryItem group={item} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <>
            <Collections />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {TABS.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  active={tab === item.key}
                  onPress={() => setTab(item.key)}
                />
              ))}
            </ScrollView>
            {total != null ? (
              <Text style={styles.count}>
                {plural(total, 'item', 'itens')} — sagas contam como uma coleção
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              title="Nada por aqui ainda"
              message="Adicione HQs pelo catálogo. Ler uma HQ não a coloca aqui: a biblioteca é o que você escolheu guardar."
              action={
                <Button label="Explorar catálogo" onPress={() => router.navigate('/catalogo')} />
              }
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator style={{ margin: 16 }} color={Colors.brand} />
          ) : null
        }
      />
    </View>
  );
}

function LibraryItem({ group }: { group: LibraryGroup }) {
  if (group.kind === 'comic') {
    return <ComicRow comic={{ ...group.entry.comic, progress: group.entry.progress }} />;
  }
  return <LibrarySeriesRow series={group.series} />;
}

// ------------------------------------------------------------ pastas

function Collections() {
  const { data: collections } = useCollections();
  const actions = useCollectionActions();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function create() {
    try {
      await actions.create.mutateAsync(name.trim());
      setName('');
      setCreating(false);
    } catch (error) {
      Alert.alert('Não consegui criar a pasta', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <View style={styles.collections}>
      <SectionHeader
        title="Minhas pastas"
        actionLabel={creating ? 'cancelar' : 'nova pasta'}
        onAction={() => setCreating((value) => !value)}
      />
      {creating ? (
        <View style={styles.create}>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="Ex.: Para reler"
            placeholderTextColor={Colors.ink500}
            style={styles.input}
            onSubmitEditing={() => name.trim() && void create()}
          />
          <Button
            label="Criar"
            disabled={!name.trim()}
            loading={actions.create.isPending}
            onPress={() => void create()}
          />
        </View>
      ) : null}
      {collections && collections.length > 0 ? (
        <FlatList
          horizontal
          data={collections}
          keyExtractor={(collection) => collection.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.three }}
          renderItem={({ item }) => <CollectionCard collection={item} />}
        />
      ) : !creating ? (
        <Text style={styles.noCollections}>
          Crie pastas para separar o que quiser reler, o que é de um personagem só, o que for.
        </Text>
      ) : null}
    </View>
  );
}

function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const covers = collection.previewCovers.slice(0, 4);
  return (
    <Pressable
      style={{ width: 96 }}
      onPress={() => router.push({ pathname: '/pasta/[id]', params: { id: collection.id } })}
    >
      <View style={styles.thumb}>
        {covers.length === 0 ? (
          <View style={[styles.thumbEmpty]}>
            <Text style={{ fontSize: 28 }}>📁</Text>
          </View>
        ) : (
          covers.map((cover) => (
            <MediaImage
              key={cover}
              url={cover}
              style={covers.length === 1 ? styles.thumbFull : styles.thumbQuarter}
            />
          ))
        )}
      </View>
      <Text style={styles.collectionName} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={styles.collectionCount}>{plural(collection.itemCount, 'item', 'itens')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  collections: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  create: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.ink800,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    color: Colors.ink100,
    fontSize: 15,
  },
  noCollections: { color: Colors.ink500, fontSize: 13, paddingHorizontal: Spacing.three },
  thumb: {
    width: 96,
    height: 128,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: Colors.ink850,
  },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbFull: { width: 96, height: 128 },
  thumbQuarter: { width: 47.5, height: 63.5 },
  collectionName: { color: Colors.ink100, fontSize: 13, fontWeight: '600', marginTop: 6 },
  collectionCount: { color: Colors.ink500, fontSize: 12 },
  chips: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  count: {
    color: Colors.ink500,
    fontSize: 12,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
});

export { ErrorBoundary } from '@/components/RouteError';
