import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LibrarySeriesGroup } from '@comicz/shared';

import { Colors, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { MediaImage } from './ui';

/** Uma saga na lista: abre a página com as edições, onde fica o download. */
export function SeriesRow({
  id,
  name,
  coverUrl,
  detail,
}: {
  id: string;
  name: string;
  coverUrl: string | null;
  detail: string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/saga/[id]', params: { id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <MediaImage url={coverUrl} style={styles.cover} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.subtitle}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.ink500} style={styles.chevron} />
    </Pressable>
  );
}

/** A saga como coleção na biblioteca e nas pastas. */
export function LibrarySeriesRow({ series }: { series: LibrarySeriesGroup }) {
  const partial = series.inLibrary < series.seriesIssues;
  const detail = [
    partial
      ? `${series.inLibrary} de ${series.seriesIssues} salvas`
      : plural(series.inLibrary, 'edição', 'edições'),
    ...progressParts(series),
    series.favorites > 0 ? '★' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return <SeriesRow id={series.id} name={series.name} coverUrl={series.coverUrl} detail={detail} />;
}

/** "3 lidas · 1 lendo · 4 na fila" — só o que é diferente de zero. */
function progressParts(series: LibrarySeriesGroup): string[] {
  const parts: string[] = [];
  if (series.read > 0) parts.push(plural(series.read, 'lida', 'lidas'));
  if (series.reading > 0) parts.push(`${series.reading} lendo`);
  if (series.wantToRead > 0) parts.push(`${series.wantToRead} na fila`);
  return parts;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cover: { width: 54, height: 82, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  title: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  subtitle: { color: Colors.ink400, fontSize: 13 },
  chevron: { width: 44, textAlign: 'center' },
});
