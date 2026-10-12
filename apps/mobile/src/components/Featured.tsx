import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import type { FeaturedItem } from '@comicz/shared';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { Button, Eyebrow, MediaImage } from './ui';

function openTarget(item: FeaturedItem) {
  if (item.kind === 'series')
    router.push({ pathname: '/saga/[id]', params: { id: item.targetId } });
  else router.push({ pathname: '/hq/[id]', params: { id: item.targetId } });
}

function startLabel(item: FeaturedItem): string {
  if (item.kind === 'comic') return item.readCount > 0 ? 'Ler de novo' : 'Começar a ler';
  if (item.readCount > 0) return item.startLabel ? `Continuar na ${item.startLabel}` : 'Continuar';
  return item.startLabel ? `Começar pela ${item.startLabel}` : 'Começar a ler';
}

function meta(item: FeaturedItem): string {
  return [
    item.publisher?.name,
    item.kind === 'series' ? plural(item.issueCount, 'edição', 'edições') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * "Em destaque": a curadoria do painel do site, em cartões que deslizam para
 * o lado. O cartão mostra a próxima vizinha na borda, o que diz sem palavras
 * que há mais.
 */
export function FeaturedShelf({ items }: { items: FeaturedItem[] }) {
  const { width } = useWindowDimensions();
  if (items.length === 0) return null;
  const cardWidth = items.length === 1 ? width - Spacing.three * 2 : Math.min(width - 56, 360);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Eyebrow color={Colors.brandLight}>Em destaque</Eyebrow>
        <Text style={styles.headerTitle}>Escolhidas para você começar</Text>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + Spacing.three}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.three }}
        renderItem={({ item }) => <FeaturedCard item={item} width={cardWidth} />}
      />
    </View>
  );
}

export function FeaturedCard({
  item,
  width,
  eyebrow,
}: {
  item: FeaturedItem;
  width?: number;
  /** "Primeira vez aqui?" quando o cartão é o topo do início. */
  eyebrow?: string;
}) {
  const goodStart = item.kind === 'series' && item.issueCount <= 6;
  return (
    <Pressable
      onPress={() => openTarget(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${meta(item)}`}
      style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.coverWrap}>
          {item.kind === 'series' ? <View style={styles.coverStack} /> : null}
          <MediaImage url={item.coverUrl} style={styles.cover} />
        </View>
        <View style={styles.cardText}>
          {eyebrow ? (
            <Eyebrow color={Colors.brandLight}>{eyebrow}</Eyebrow>
          ) : goodStart ? (
            <Text style={styles.goodStart}>BOM PARA COMEÇAR</Text>
          ) : null}
          <Text style={styles.title} numberOfLines={3}>
            {item.title}
          </Text>
          <Text style={styles.meta}>{meta(item)}</Text>
          {item.kind === 'series' && item.readCount > 0 ? (
            <Text style={styles.read}>
              {item.readCount} de {item.issueCount} lidas
            </Text>
          ) : null}
        </View>
      </View>
      {item.note ? (
        <Text style={styles.note} numberOfLines={3}>
          {item.ownNote ? `“${item.note}”` : item.note}
        </Text>
      ) : null}
      {item.startComicId ? (
        <Button
          label={startLabel(item)}
          onPress={() => router.push({ pathname: '/ler/[id]', params: { id: item.startComicId! } })}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.four },
  header: { paddingHorizontal: Spacing.three, marginBottom: Spacing.two, gap: 4 },
  headerTitle: { color: Colors.ink100, fontSize: 18, fontWeight: '700' },
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.35)',
    backgroundColor: '#13110a',
  },
  cardTop: { flexDirection: 'row', gap: 14 },
  coverWrap: { width: 92, height: 138 },
  coverStack: {
    position: 'absolute',
    top: -5,
    right: -6,
    bottom: 5,
    left: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink800,
  },
  cover: {
    width: 92,
    height: 138,
    borderRadius: 8,
    boxShadow: `4px 4px 0 0 ${Colors.brand}`,
  },
  cardText: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  goodStart: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(110, 231, 168, 0.14)',
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    color: Colors.ink100,
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  meta: { color: Colors.ink300, fontSize: 12 },
  read: { color: Colors.brandLight, fontSize: 12, fontWeight: '700' },
  note: {
    color: Colors.ink100,
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
});
