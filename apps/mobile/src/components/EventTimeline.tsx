import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GuideNodeView } from '@comicz/shared';

import { Colors } from '@/constants/theme';
import {
  isOptionalNode,
  joinLabels,
  nodeState,
  X,
  type NodeOptional,
  type NodeState,
  type TimelineRow,
} from '@/lib/eventTimeline';
import { percent } from '@/lib/format';
import { MediaImage } from './ui';

/** Desenho de uma linha da linha do tempo: trilhos, cotovelo, bolinha e cartão. */
const LINE = Colors.ink600;

export function TimelineRowView({
  row,
  accent,
  optional,
  onPress,
}: {
  row: TimelineRow;
  accent: string;
  /** Opcionais do bloco desta linha, quando é um bloco. */
  optional?: NodeOptional;
  onPress: (node: GuideNodeView) => void;
}) {
  const dotLeft = X(row.depth) - 5;
  const state = row.kind === 'stub' ? row.state : nodeState(row.node);

  return (
    <View style={{ paddingLeft: X(row.depth) + 16 }}>
      {row.full.map((x) => (
        <View key={`f${x}`} style={[styles.rail, { left: x, top: 0, bottom: 0 }]} />
      ))}
      {row.top.map((x) => (
        <View key={`t${x}`} style={[styles.rail, { left: x, top: 0, height: 26 }]} />
      ))}
      {row.bottom.map((x) => (
        <View key={`b${x}`} style={[styles.rail, { left: x, top: 26, bottom: 0 }]} />
      ))}
      {row.elbow ? (
        <View
          style={[
            styles.elbow,
            { left: X(row.depth - 1) - 1, width: X(row.depth) - X(row.depth - 1) + 2 },
          ]}
        />
      ) : null}
      <Dot state={state} left={dotLeft} accent={accent} />

      {row.kind === 'stub' ? (
        <Text style={styles.stub}>{row.text}</Text>
      ) : (
        <View style={{ paddingBottom: 10 }}>
          <NodeCard
            node={row.node}
            accent={accent}
            optional={optional}
            onPress={() => onPress(row.node)}
          />
          {row.after.length > 0 ? (
            <Text style={styles.relation} numberOfLines={2}>
              <Text style={styles.relationLabel}>depois de </Text>
              {joinLabels(row.after)}
            </Text>
          ) : null}
          {row.backTo.length > 0 ? (
            <Text style={styles.relation} numberOfLines={2}>
              <Text style={styles.relationLabel}>↳ volta em </Text>
              {joinLabels(row.backTo)}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Dot({ state, left, accent }: { state: NodeState; left: number; accent: string }) {
  if (state === 'done') {
    return (
      <View
        style={[styles.dot, { left, top: 21, width: 10, height: 10, backgroundColor: accent }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.dot,
        {
          left,
          top: 20,
          width: 12,
          height: 12,
          borderWidth: 2,
          backgroundColor: Colors.ink900,
          borderColor: state === 'partial' ? accent : Colors.ink500,
        },
      ]}
    />
  );
}

function NodeCard({
  node,
  accent,
  optional,
  onPress,
}: {
  node: GuideNodeView;
  accent: string;
  optional?: NodeOptional;
  onPress: () => void;
}) {
  const skippable = isOptionalNode(optional);
  const someOptional = !skippable && !!optional?.optional;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        // Opcional fica um passo atrás: presente, mas sem disputar com o que é essencial.
        skippable && styles.cardOptional,
        pressed && { backgroundColor: Colors.ink800 },
      ]}
    >
      <MediaImage url={node.coverUrl} style={[styles.thumb, skippable && { opacity: 0.6 }]} />
      <View style={styles.cardBody}>
        {skippable ? <Text style={styles.optionalTag}>OPCIONAL · DÁ PARA PULAR</Text> : null}
        <Text style={[styles.cardTitle, skippable && { color: Colors.ink300 }]}>{node.label}</Text>
        {node.note ? (
          <Text style={styles.cardNote} numberOfLines={2}>
            {node.note}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCount}>
            {node.readCount
              ? `${node.readCount} de ${node.itemCount} ed.`
              : `${node.itemCount} ed.`}
            {someOptional ? ` · ${optional!.optional} opcionais` : ''}
          </Text>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${percent(node.readCount, node.itemCount)}%`, backgroundColor: accent },
              ]}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', width: 2, backgroundColor: LINE },
  elbow: {
    position: 'absolute',
    top: 0,
    height: 25,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: LINE,
    borderBottomLeftRadius: 10,
  },
  dot: { position: 'absolute', borderRadius: 999 },
  stub: { minHeight: 44, paddingTop: 16, color: Colors.ink400, fontSize: 12, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.ink850,
    borderWidth: 1,
    borderColor: Colors.ink700,
  },
  thumb: { width: 44, height: 66, borderRadius: 5 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: Colors.ink100, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  cardNote: { color: Colors.ink400, fontSize: 12.5, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 4,
  },
  cardCount: { color: Colors.ink400, fontSize: 11 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.ink700, overflow: 'hidden' },
  barFill: { height: '100%' },
  cardOptional: {
    backgroundColor: Colors.ink900,
    borderStyle: 'dashed',
    borderColor: Colors.ink600,
  },
  optionalTag: { color: Colors.ink400, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  relation: { color: Colors.ink300, fontSize: 12, lineHeight: 17, marginTop: 5, marginLeft: 2 },
  relationLabel: { color: Colors.ink500 },
});
