import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GuideItemView, GuideNodeView } from '@comicz/shared';

import { Colors, readableOn, Spacing } from '@/constants/theme';
import { joinLabels } from '@/lib/eventTimeline';
import { percent, plural } from '@/lib/format';
import { nextItem } from './EventTrail';
import { MediaImage } from './ui';

/**
 * O que abre ao tocar numa história do mapa: o resumo dela e as duas saídas —
 * ver a lista de edições, ou ir direto para a próxima edição a ler.
 */
export function EventNodeSheet({
  node,
  items,
  parents,
  leadsTo,
  context,
  accent,
  accentText,
  onClose,
  onOpenEditions,
  onRead,
}: {
  node: GuideNodeView | null;
  items: GuideItemView[];
  /** Nomes dos blocos que vêm antes — as setas que chegam, no mapa do site. */
  parents: string[];
  /** Nomes dos blocos que vêm depois — as setas que saem. */
  leadsTo: string[];
  /** "Comece aqui", "Linha principal" ou "Ramo". */
  context: string;
  accent: string;
  accentText: string;
  onClose: () => void;
  onOpenEditions: (node: GuideNodeView) => void;
  onRead: (item: GuideItemView) => void;
}) {
  if (!node) return null;
  const next = nextItem(items);
  const read = node.readCount;
  const cta = read === 0 ? 'Começar' : read >= node.itemCount ? 'Reler' : 'Continuar';
  const optional = items.filter((item) => item.optional).length;
  const essentials =
    optional === 0
      ? null
      : optional === items.length
        ? 'Todas opcionais — dá para pular esta história'
        : `${items.length - optional} essenciais · ${optional} opcionais`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.top}>
          <MediaImage url={node.coverUrl} style={styles.cover} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.context, { color: accentText }]}>{context}</Text>
            <Text style={styles.title}>{node.label}</Text>
            <Text style={styles.meta}>
              {plural(node.itemCount, 'edição', 'edições')} · {read} {read === 1 ? 'lida' : 'lidas'}
            </Text>
          </View>
        </View>
        {node.note ? <Text style={styles.note}>{node.note}</Text> : null}
        {essentials ? <Text style={styles.essentials}>{essentials}</Text> : null}
        {parents.length || leadsTo.length ? (
          <View style={{ gap: 4 }}>
            {parents.length ? (
              <Text style={styles.relation}>
                <Text style={styles.relationLabel}>Depois de </Text>
                {joinLabels(parents)}
              </Text>
            ) : null}
            {leadsTo.length ? (
              <Text style={styles.relation}>
                <Text style={styles.relationLabel}>Leva a </Text>
                {joinLabels(leadsTo)}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${percent(read, node.itemCount)}%`, backgroundColor: accent },
            ]}
          />
        </View>
        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.outline]} onPress={() => onOpenEditions(node)}>
            <Text style={styles.outlineLabel}>Ver edições</Text>
          </Pressable>
          {next ? (
            <Pressable
              style={[styles.button, { backgroundColor: accent }]}
              onPress={() => onRead(next)}
            >
              <Text style={[styles.filledLabel, { color: readableOn(accent) }]}>{cta}</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.ink800,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink500,
    marginBottom: 4,
  },
  top: { flexDirection: 'row', gap: 14 },
  cover: { width: 72, height: 108, borderRadius: 6 },
  context: { fontSize: 12, fontWeight: '500' },
  title: { color: Colors.ink100, fontSize: 20, fontWeight: '500', lineHeight: 25 },
  meta: { color: Colors.ink400, fontSize: 13 },
  note: { color: Colors.ink300, fontSize: 14, lineHeight: 21 },
  essentials: { color: Colors.ink200, fontSize: 13, fontWeight: '600' },
  relation: { color: Colors.ink300, fontSize: 13, lineHeight: 19 },
  relationLabel: { color: Colors.ink500 },
  bar: { height: 4, borderRadius: 2, backgroundColor: Colors.ink900, overflow: 'hidden' },
  barFill: { height: '100%' },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1, borderColor: Colors.ink500 },
  outlineLabel: { color: Colors.ink100, fontSize: 14, fontWeight: '500' },
  filledLabel: { fontSize: 14, fontWeight: '600' },
});
