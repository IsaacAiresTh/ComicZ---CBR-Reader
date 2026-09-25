import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { CatalogEntry } from '@comicz/shared';

import { Colors, Spacing } from '@/constants/theme';
import { comicLabel, plural } from '@/lib/format';
import { MediaImage, SectionHeader } from './ui';

export interface ShelfItem {
  key: string;
  title: string;
  subtitle?: string | null;
  coverUrl: string | null;
  localUri?: string | null;
  /** 0–100: barra no pé da capa, para "continue lendo". */
  progress?: number | null;
  onPress: () => void;
}

/**
 * Prateleira horizontal de capas — a forma de uma grade do site caber na
 * largura do celular sem virar uma página de rolagem.
 */
export function Shelf({
  title,
  items,
  actionLabel,
  onAction,
  width = 112,
}: {
  title: string;
  items: ShelfItem[];
  actionLabel?: string;
  onAction?: () => void;
  width?: number;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.three }}
        renderItem={({ item }) => <CoverCard item={item} width={width} />}
      />
    </View>
  );
}

export function CoverCard({ item, width }: { item: ShelfItem; width: number }) {
  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.7 }]}
    >
      <View>
        <MediaImage
          url={item.coverUrl}
          localUri={item.localUri}
          style={{ width, height: width * 1.5, borderRadius: 8 }}
        />
        {item.progress != null && item.progress > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Uma entrada do catálogo (saga ou HQ avulsa) como capa de prateleira. */
export function catalogShelfItem(entry: CatalogEntry): ShelfItem {
  if (entry.kind === 'series') {
    const { series } = entry;
    return {
      key: `s-${series.id}`,
      title: series.name,
      subtitle: plural(series.issueCount, 'edição', 'edições'),
      coverUrl: series.coverUrl,
      onPress: () => router.push({ pathname: '/saga/[id]', params: { id: series.id } }),
    };
  }
  const { comic } = entry;
  return {
    key: `c-${comic.id}`,
    title: comicLabel(comic),
    subtitle: comic.publisher?.name,
    coverUrl: comic.coverUrl,
    onPress: () => router.push({ pathname: '/hq/[id]', params: { id: comic.id } }),
  };
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.four },
  title: { color: Colors.ink100, fontSize: 13, fontWeight: '600', marginTop: 6 },
  subtitle: { color: Colors.ink500, fontSize: 12, marginTop: 2 },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(7, 9, 13, 0.6)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.brand },
});
