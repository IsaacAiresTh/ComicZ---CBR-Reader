import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CollectionEntry } from '@comicz/shared';

import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { LibrarySeriesRow } from '@/components/SeriesRow';
import { Body, Button, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useCollection, useCollectionActions } from '@/lib/queries';

/**
 * Uma pasta da biblioteca. No site a ordem muda arrastando; aqui, com as
 * setas de "Organizar" — arrastar numa lista que também rola briga com o dedo.
 */
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCollection(id);
  const actions = useCollectionActions();
  const [organizing, setOrganizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const collection = query.data;
  const entries = collection.entries;

  const fail = (title: string) => (error: unknown) =>
    Alert.alert(title, error instanceof Error ? error.message : undefined);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    actions.reorder
      .mutateAsync({ collectionId: collection.id, itemIds: next.map((entry) => entry.itemId) })
      .catch(fail('Não consegui reordenar'));
  }

  function confirmDelete() {
    Alert.alert(
      `Apagar a pasta “${collection.name}”?`,
      'As HQs continuam no acervo e na sua biblioteca — só a pasta some.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () =>
            actions.remove
              .mutateAsync(collection.id)
              .then(() => router.back())
              .catch(fail('Não consegui apagar')),
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: collection.name }} />
      <FlatList
        style={styles.screen}
        data={entries}
        keyExtractor={(entry) => entry.itemId}
        contentContainerStyle={
          entries.length === 0 ? { flexGrow: 1 } : { paddingBottom: Spacing.five }
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {editing ? (
              <View style={styles.rename}>
                <TextInput
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  style={styles.input}
                  onSubmitEditing={() =>
                    name.trim() &&
                    actions.rename
                      .mutateAsync({ id: collection.id, name: name.trim() })
                      .then(() => setEditing(false))
                      .catch(fail('Não consegui renomear'))
                  }
                />
                <Button
                  label="Salvar"
                  disabled={!name.trim()}
                  loading={actions.rename.isPending}
                  onPress={() =>
                    actions.rename
                      .mutateAsync({ id: collection.id, name: name.trim() })
                      .then(() => setEditing(false))
                      .catch(fail('Não consegui renomear'))
                  }
                />
              </View>
            ) : (
              <Body muted style={{ fontSize: 13 }}>
                {plural(collection.itemCount, 'item', 'itens')} nesta pasta — uma saga inteira conta
                como um
              </Body>
            )}
            <View style={styles.buttons}>
              <Button
                variant="ghost"
                label={editing ? 'Cancelar' : 'Renomear'}
                style={{ flex: 1 }}
                onPress={() => {
                  setName(collection.name);
                  setEditing((value) => !value);
                }}
              />
              {entries.length > 1 ? (
                <Button
                  variant="ghost"
                  label={organizing ? 'Concluir' : 'Organizar'}
                  style={{ flex: 1 }}
                  onPress={() => setOrganizing((value) => !value)}
                />
              ) : null}
              <Button variant="ghost" label="Apagar" style={{ flex: 1 }} onPress={confirmDelete} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Pasta vazia"
            message="Abra uma HQ ou uma saga e use “Guardar em pasta” para trazê-la para cá."
          />
        }
        renderItem={({ item, index }) => (
          <View>
            <Entry entry={item} />
            {organizing ? (
              <View style={styles.organize}>
                <OrganizeButton
                  icon="arrow-up"
                  disabled={index === 0 || actions.reorder.isPending}
                  onPress={() => move(index, -1)}
                />
                <OrganizeButton
                  icon="arrow-down"
                  disabled={index === entries.length - 1 || actions.reorder.isPending}
                  onPress={() => move(index, 1)}
                />
                <OrganizeButton
                  icon="close"
                  label="Tirar da pasta"
                  disabled={actions.removeItem.isPending}
                  onPress={() =>
                    actions.removeItem
                      .mutateAsync({ collectionId: collection.id, itemId: item.itemId })
                      .catch(fail('Não consegui tirar da pasta'))
                  }
                />
              </View>
            ) : null}
          </View>
        )}
      />
    </>
  );
}

function Entry({ entry }: { entry: CollectionEntry }) {
  return entry.kind === 'series' ? (
    <LibrarySeriesRow series={entry.series} />
  ) : (
    <ComicRow comic={entry.comic} />
  );
}

function OrganizeButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.organizeButton, (pressed || disabled) && { opacity: 0.4 }]}
    >
      <Ionicons name={icon} size={18} color={Colors.ink200} />
      {label ? <Text style={styles.organizeLabel}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  header: { padding: Spacing.three, gap: Spacing.three },
  rename: { flexDirection: 'row', gap: Spacing.two },
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
  buttons: { flexDirection: 'row', gap: Spacing.two },
  organize: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    marginLeft: 70,
  },
  organizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.ink800,
  },
  organizeLabel: { color: Colors.ink200, fontSize: 13 },
});

export { ErrorBoundary } from '@/components/RouteError';
