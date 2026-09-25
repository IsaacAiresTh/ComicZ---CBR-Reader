import { StyleSheet, Text, View } from 'react-native';
import type { GuideItemView } from '@comicz/shared';

import { Colors, Spacing } from '@/constants/theme';
import { agruparEmAtos } from '@/lib/format';
import { ComicRow } from './ComicRow';

/**
 * A trilha de edições de um evento (ou de uma história dele), já achatada em
 * linhas para uma FlatList: o nome de cada ato e, embaixo, as edições.
 */
export type TrailRow =
  | { kind: 'act'; key: string; name: string; count: number }
  | { kind: 'item'; key: string; item: GuideItemView };

export function trailRows(items: GuideItemView[], essentialOnly: boolean): TrailRow[] {
  const visible = essentialOnly ? items.filter((item) => !item.optional) : items;
  return agruparEmAtos(visible).flatMap((act): TrailRow[] => [
    ...(act.nome
      ? [{ kind: 'act' as const, key: act.key, name: act.nome, count: act.itens.length }]
      : []),
    ...act.itens.map((item) => ({ kind: 'item' as const, key: item.id, item })),
  ]);
}

export function TrailRowView({ row, accent }: { row: TrailRow; accent: string }) {
  if (row.kind === 'act') {
    return (
      <View style={styles.act}>
        <Text style={[styles.actName, { color: accent }]}>{row.name.toUpperCase()}</Text>
        <View style={[styles.actLine, { backgroundColor: accent }]} />
        <Text style={styles.count}>{row.count}</Text>
      </View>
    );
  }
  return (
    <ComicRow
      comic={row.item.comic}
      position={row.item.position}
      note={row.item.note}
      optional={row.item.optional}
      accent={accent}
    />
  );
}

/**
 * A edição por onde seguir numa lista: a primeira essencial ainda não lida;
 * com as essenciais em dia, a primeira opcional não lida; com tudo lido, a
 * primeira (reler). Só conta o que já dá para ler. Null quando nada está pronto.
 */
export function nextItem(items: GuideItemView[]): GuideItemView | null {
  const readable = items.filter((item) => item.comic.file?.status === 'READY');
  const unread = readable.filter((item) => !item.comic.progress?.completed);
  return unread.find((item) => !item.optional) ?? unread[0] ?? readable[0] ?? null;
}

const styles = StyleSheet.create({
  act: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  actName: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  actLine: { flex: 1, height: 1, opacity: 0.4 },
  count: { color: Colors.ink400, fontSize: 12 },
});
