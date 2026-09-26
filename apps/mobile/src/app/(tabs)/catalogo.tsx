import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { CatalogEntry, CatalogResult } from '@comicz/shared';

import { AlphabetRow } from '@/components/AlphabetRow';
import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { SeriesRow } from '@/components/SeriesRow';
import { Chip, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { usePublishers } from '@/lib/queries';

const PER_PAGE = 30;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * O catálogo do site: busca, editora, ordem e a fila do alfabeto, sobre a
 * lista agrupada por título (uma saga = uma linha). A contagem por letra vem
 * da API junto com a página, já considerando a busca e a editora.
 *
 * Os filtros ficam sempre na tela, e a lista anterior continua visível
 * enquanto a nova chega — tocar numa letra não pisca a tela inteira.
 */
export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const [sort, setSort] = useState<'recent' | 'title'>('recent');
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const publishers = usePublishers();
  // Editora sem nenhuma HQ (a Panini, hoje) seria uma pílula que sempre leva ao vazio.
  const publisherOptions = (publishers.data ?? []).filter(
    (publisher) => publisher._count.comics > 0,
  );

  const query = useInfiniteQuery({
    queryKey: ['catalog', { q, sort, publisherId, letter }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        perPage: String(PER_PAGE),
        sort,
      });
      if (q) params.set('q', q);
      if (publisherId) params.set('publisherId', publisherId);
      if (letter) params.set('letter', letter);
      return api<CatalogResult>(`/comics/catalog?${params}`);
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const first = query.data?.pages[0];
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Boolean(q || publisherId || letter);
  const clearAll = () => {
    setSearch('');
    setPublisherId(null);
    setLetter(null);
  };

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        placeholder="Buscar por título, série ou personagem"
        placeholderTextColor={Colors.ink500}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          // Busca nova sobre a lista inteira, como no site: a letra sai.
          if (value) setLetter(null);
        }}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      <FlatList
        data={query.isSuccess ? entries : []}
        keyExtractor={entryKey}
        renderItem={({ item }) => <CatalogItem entry={item} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={query.isRefetching && !query.isFetchingNextPage && !query.isPlaceholderData}
        onRefresh={() => void query.refetch()}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.filters}>
            {publisherOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                keyboardShouldPersistTaps="handled"
              >
                <Chip
                  label="Todas as editoras"
                  active={publisherId === null}
                  onPress={() => setPublisherId(null)}
                />
                {publisherOptions.map((publisher) => (
                  <Chip
                    key={publisher.id}
                    label={publisher.name}
                    active={publisherId === publisher.id}
                    onPress={() =>
                      setPublisherId(publisherId === publisher.id ? null : publisher.id)
                    }
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.chips, styles.sortRow]}>
              <Chip
                label="Mais recentes"
                active={sort === 'recent'}
                onPress={() => setSort('recent')}
              />
              <Chip label="Título A–Z" active={sort === 'title'} onPress={() => setSort('title')} />
            </View>

            <AlphabetRow counts={first?.letters ?? {}} selected={letter} onSelect={setLetter} />

            <View style={styles.summary}>
              <Text style={styles.count}>
                {first
                  ? `${plural(first.total, 'título', 'títulos')} — abra um para ver as edições`
                  : ' '}
              </Text>
              {query.isFetching && query.isPlaceholderData ? (
                <ActivityIndicator size="small" color={Colors.brand} />
              ) : filtered ? (
                <Pressable hitSlop={8} onPress={clearAll}>
                  <Text style={styles.clear}>limpar filtros</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              title="Nada encontrado"
              message="Tente outro termo de busca ou remova os filtros aplicados."
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

function entryKey(entry: CatalogEntry): string {
  return entry.kind === 'series' ? `s-${entry.series.id}` : `c-${entry.comic.id}`;
}

function CatalogItem({ entry }: { entry: CatalogEntry }) {
  if (entry.kind === 'comic') return <ComicRow comic={entry.comic} />;
  const { series } = entry;
  const detail = [
    plural(series.issueCount, 'edição', 'edições'),
    series.publisher?.name,
    series.startYear,
  ]
    .filter(Boolean)
    .join(' · ');
  return <SeriesRow id={series.id} name={series.name} coverUrl={series.coverUrl} detail={detail} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  search: {
    margin: Spacing.three,
    marginBottom: Spacing.two,
    backgroundColor: Colors.ink800,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    color: Colors.ink100,
    fontSize: 15,
  },
  filters: { gap: Spacing.two, paddingBottom: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three },
  sortRow: { marginBottom: Spacing.one },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 20,
  },
  count: { flex: 1, color: Colors.ink500, fontSize: 12 },
  clear: { color: Colors.brandLight, fontSize: 13 },
});
