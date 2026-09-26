import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useCollectionActions, useCollections } from '@/lib/queries';
import { Body, Button } from './ui';

export type CollectionTarget = { kind: 'comic'; id: string } | { kind: 'series'; id: string };

/**
 * "Guardar em uma pasta", como no site. Guardar a saga guarda a SAGA como um
 * item só; em nenhum dos casos a HQ sai da biblioteca.
 */
export function CollectionPicker({
  target,
  visible,
  onClose,
  onDone,
}: {
  target: CollectionTarget;
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { data: collections } = useCollections();
  const actions = useCollectionActions();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy =
    actions.addComic.isPending || actions.addSeries.isPending || actions.create.isPending;

  async function saveIn(collectionId: string, collectionName: string) {
    setError(null);
    try {
      const result =
        target.kind === 'series'
          ? await actions.addSeries.mutateAsync({ collectionId, seriesId: target.id })
          : await actions.addComic.mutateAsync({ collectionId, comicId: target.id });
      onDone(
        result.alreadyThere
          ? `Já estava em “${collectionName}”.`
          : `Guardada em “${collectionName}”.`,
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui guardar');
    }
  }

  async function createAndSave() {
    setError(null);
    try {
      const created = await actions.create.mutateAsync(name.trim());
      await saveIn(created.id, created.name);
      setName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui criar a pasta');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {target.kind === 'series' ? 'Guardar a saga em' : 'Guardar em'}
          </Text>

          <FlatList
            data={collections ?? []}
            keyExtractor={(collection) => collection.id}
            style={{ maxHeight: 280 }}
            ListEmptyComponent={
              <Body muted style={{ paddingVertical: Spacing.two }}>
                Você ainda não tem pastas. Crie a primeira abaixo.
              </Body>
            }
            renderItem={({ item }) => (
              <Pressable
                disabled={busy}
                onPress={() => void saveIn(item.id, item.name)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.ink800 }]}
              >
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowCount}>{plural(item.itemCount, 'item', 'itens')}</Text>
              </Pressable>
            )}
          />

          <View style={styles.create}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="Nova pasta..."
              placeholderTextColor={Colors.ink500}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && void createAndSave()}
            />
            <Button
              label="Criar"
              disabled={!name.trim() || busy}
              onPress={() => void createAndSave()}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.ink850,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink600,
    marginBottom: Spacing.two,
  },
  title: { color: Colors.ink100, fontSize: 17, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  rowName: { color: Colors.ink100, fontSize: 15, flex: 1 },
  rowCount: { color: Colors.ink500, fontSize: 13, marginLeft: Spacing.two },
  create: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.ink700,
    paddingTop: Spacing.three,
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
  error: { color: Colors.accent, fontSize: 14 },
});
