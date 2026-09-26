import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router';
import { initialLetter } from '@comicz/shared';

import { AlphabetRow } from '@/components/AlphabetRow';
import { CharacterAvatar } from '@/components/CharacterAvatar';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useCharacters } from '@/lib/queries';

type Order = 'edicoes' | 'alfabetica';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Mesma lista do site: busca por nome, apelido e tag (é onde mora o manto —
 * "Flash" acha todos os portadores), ordem por edições ou A–Z e a fila de
 * iniciais. A lista inteira já vem numa chamada, então filtrar é local.
 */
export default function CharactersScreen() {
  const query = useCharacters();
  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('edicoes');
  const { width } = useWindowDimensions();
  const columns = width > 600 ? 5 : 3;
  const size = Math.min(96, (width - Spacing.three * 2) / columns - 16);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const byLetter = useMemo(() => {
    const count: Record<string, number> = {};
    for (const character of all) {
      const key = initialLetter(character.name);
      count[key] = (count[key] ?? 0) + 1;
    }
    return count;
  }, [all]);

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    return all
      .filter((character) => {
        if (letter && initialLetter(character.name) !== letter) return false;
        return (
          !term ||
          [character.name, ...character.aliases, ...character.tags].some((field) =>
            normalize(field).includes(term),
          )
        );
      })
      .sort((a, b) =>
        order === 'alfabetica'
          ? a.name.localeCompare(b.name, 'pt-BR')
          : b.comicCount - a.comicCount || a.name.localeCompare(b.name, 'pt-BR'),
      );
  }, [all, search, letter, order]);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Personagens' }} />
      <FlatList
        data={visible}
        key={columns}
        numColumns={columns}
        keyExtractor={(character) => character.id}
        keyboardDismissMode="on-drag"
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: Spacing.three }}
        contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.five }}
        ListHeaderComponent={
          <View style={{ gap: Spacing.two, paddingTop: Spacing.three }}>
            <TextInput
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                if (value) setLetter(null);
              }}
              placeholder="Buscar por nome"
              placeholderTextColor={Colors.ink500}
              autoCorrect={false}
              style={styles.search}
            />
            <View style={styles.row}>
              <Chip
                label="Mais edições"
                active={order === 'edicoes'}
                onPress={() => setOrder('edicoes')}
              />
              <Chip
                label="A–Z"
                active={order === 'alfabetica'}
                onPress={() => setOrder('alfabetica')}
              />
              <Text style={styles.count}>
                {visible.length === all.length
                  ? `${all.length} personagens`
                  : `${visible.length} de ${all.length}`}
              </Text>
            </View>
            <AlphabetRow
              counts={byLetter}
              selected={letter}
              onSelect={(next) => {
                setLetter(next);
                if (next) setSearch('');
              }}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhum personagem aqui"
            message={search ? `Nada com “${search}” no nome.` : undefined}
          />
        }
        renderItem={({ item }) => (
          <CharacterAvatar
            name={item.name}
            imageUrl={item.portraitUrl}
            subtitle={
              item.comicCount === 0 ? 'sem edições' : plural(item.comicCount, 'edição', 'edições')
            }
            slug={item.slug}
            accent={item.accentColor}
            size={size}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  search: {
    marginHorizontal: Spacing.three,
    backgroundColor: Colors.ink800,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    color: Colors.ink100,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  count: { color: Colors.ink500, fontSize: 12, marginLeft: 'auto' },
});

export { ErrorBoundary } from '@/components/RouteError';
