import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GuideItemView, GuideNodeView } from '@comicz/shared';

import { Colors, readableOn, Spacing } from '@/constants/theme';
import { joinLabels } from '@/lib/eventTimeline';
import { comicLabel, percent, plural } from '@/lib/format';
import { nextItem } from './EventTrail';
import { MediaImage } from './ui';

/**
 * O que abre ao tocar numa história do mapa: o resumo, as edições dela (com a
 * da vez marcada), "ler" direto e "seguir só esta linha" — que filtra o mapa
 * para a trilha desta história num evento com várias frentes.
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
  onFollow,
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
  /** Ausente quando o mapa já está seguindo esta linha. */
  onFollow?: (node: GuideNodeView) => void;
}) {
  if (!node) return null;
  const next = nextItem(items);
  const read = node.readCount;
  const cta = next
    ? `${read === 0 ? 'Começar por' : read >= node.itemCount ? 'Reler' : 'Ler'} ${comicLabel(next.comic)}`
    : '';
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
        {node.note ? (
          <Text style={styles.note} numberOfLines={4}>
            {node.note}
          </Text>
        ) : null}
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
        {items.length > 0 ? (
          <ScrollView style={styles.list} nestedScrollEnabled>
            {items.map((item) => {
              const done = Boolean(item.comic.progress?.completed);
              const isNext = item.id === next?.id && !done;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onRead(item)}
                  disabled={item.comic.file?.status !== 'READY'}
                  style={[styles.item, isNext && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
                >
                  {done ? (
                    <Text style={styles.itemDone}>✓</Text>
                  ) : (
                    <View style={[styles.itemNumber, isNext && { backgroundColor: accent }]}>
                      <Text
                        style={[styles.itemNumberText, isNext && { color: readableOn(accent) }]}
                      >
                        {item.position}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.itemLabel,
                      done && { color: Colors.ink400 },
                      isNext && { fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {comicLabel(item.comic)}
                  </Text>
                  {isNext ? (
                    <Text style={[styles.itemTag, { color: accentText }]}>próxima</Text>
                  ) : item.optional ? (
                    <Text style={styles.itemTag}>opcional</Text>
                  ) : done ? (
                    <Text style={[styles.itemTag, { color: Colors.success }]}>lida</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={styles.buttons}>
          {next ? (
            <Pressable
              style={[styles.button, { backgroundColor: accent }]}
              onPress={() => onRead(next)}
            >
              <Text style={[styles.filledLabel, { color: readableOn(accent) }]} numberOfLines={1}>
                {cta}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.links}>
          <Pressable hitSlop={8} onPress={() => onOpenEditions(node)}>
            <Text style={[styles.link, { color: accentText }]}>Ver a lista completa</Text>
          </Pressable>
          {onFollow && (parents.length > 0 || leadsTo.length > 0) ? (
            <Pressable hitSlop={8} onPress={() => onFollow(node)}>
              <Text style={[styles.link, { color: accentText }]}>Seguir só esta linha →</Text>
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
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filledLabel: { fontSize: 15, fontWeight: '800' },
  list: { maxHeight: 220, marginHorizontal: -8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  itemDone: { width: 22, textAlign: 'center', color: Colors.success, fontWeight: '900' },
  itemNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.ink600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumberText: { color: Colors.ink300, fontSize: 10, fontWeight: '800' },
  itemLabel: { flex: 1, color: Colors.ink100, fontSize: 14 },
  itemTag: { color: Colors.ink500, fontSize: 11, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  link: { fontSize: 14, fontWeight: '700' },
});
