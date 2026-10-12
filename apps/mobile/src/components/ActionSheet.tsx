import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * O menu "⋯": as ações raras saem da tela e vêm de baixo, perto do polegar,
 * para não disputar espaço com a principal (ler).
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar o menu" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              action.onPress();
            }}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: Colors.ink800 }]}
          >
            <Text style={[styles.actionLabel, action.destructive && { color: '#ff8a8a' }]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelLabel}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink600,
    marginBottom: Spacing.two,
  },
  title: {
    color: Colors.ink400,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  action: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10 },
  actionLabel: { color: Colors.ink100, fontSize: 16 },
  cancel: { minHeight: 50, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  cancelLabel: { color: Colors.ink300, fontSize: 15, fontWeight: '700' },
});
