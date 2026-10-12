import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GuideNodeView } from '@comicz/shared';

import { Colors, mix, readableOn, Spacing } from '@/constants/theme';
import { stepNodeState, type Step, type StepNodeState } from '@/lib/eventSteps';
import { isOptionalNode, type NodeOptional } from '@/lib/eventTimeline';
import { percent } from '@/lib/format';
import { MediaImage } from './ui';

/**
 * Uma linha do mapa: o título do ato quando ele começa, o fio que liga ao
 * passo de cima e as histórias do passo — uma só ocupa a largura; várias
 * (as que correm em paralelo) deslizam para o lado, cada cartão mostrando a
 * ponta do vizinho para deixar claro que há mais.
 */
export function StepRow({
  step,
  first,
  accent,
  currentId,
  optional,
  hiddenInAct,
  onPress,
}: {
  step: Step;
  first: boolean;
  accent: string;
  currentId: string | null;
  optional: Map<string, NodeOptional>;
  /** "Seguir uma linha": quantas histórias deste ato ficaram de fora. */
  hiddenInAct?: number;
  onPress: (node: GuideNodeView) => void;
}) {
  const { width } = useWindowDimensions();
  const parallel = step.nodes.length > 1;
  const cardWidth = Math.min(width * 0.72, 300);

  return (
    <View>
      {step.actStart && step.act ? (
        <View style={styles.act}>
          <Text style={[styles.actName, { color: mix(accent, '#ffffff', 0.35) }]}>
            {step.act.toUpperCase()}
          </Text>
          {hiddenInAct ? (
            <Text style={styles.hidden}>
              + {hiddenInAct} {hiddenInAct === 1 ? 'história' : 'histórias'} fora desta linha
            </Text>
          ) : null}
        </View>
      ) : !first ? (
        <View style={styles.connector} />
      ) : null}

      {parallel ? (
        <>
          <Text style={styles.parallel}>
            Ao mesmo tempo · {step.nodes.length} histórias, leia em qualquer ordem
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 10}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: 10 }}
          >
            {step.nodes.map((node) => (
              <MapCard
                key={node.id}
                node={node}
                width={cardWidth}
                accent={accent}
                state={stepNodeState(node, currentId)}
                optional={optional.get(node.id)}
                onPress={() => onPress(node)}
              />
            ))}
          </ScrollView>
          {step.nodes.length > 2 ? (
            <View style={styles.dots}>
              {step.nodes.map((node) => (
                <View
                  key={node.id}
                  style={[
                    styles.pageDot,
                    node.id === currentId && { backgroundColor: accent, width: 14 },
                  ]}
                />
              ))}
              <Text style={styles.swipe}>deslize para ver as {step.nodes.length}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ paddingHorizontal: Spacing.three }}>
          <MapCard
            node={step.nodes[0]!}
            accent={accent}
            state={stepNodeState(step.nodes[0]!, currentId)}
            optional={optional.get(step.nodes[0]!.id)}
            onPress={() => onPress(step.nodes[0]!)}
          />
        </View>
      )}
    </View>
  );
}

function MapCard({
  node,
  width,
  accent,
  state,
  optional,
  onPress,
}: {
  node: GuideNodeView;
  width?: number;
  accent: string;
  state: StepNodeState;
  optional?: NodeOptional;
  onPress: () => void;
}) {
  const skippable = isOptionalNode(optional);
  const current = state === 'current';
  const done = state === 'done';
  const tag = current
    ? 'VOCÊ ESTÁ AQUI'
    : node.entry && !done
      ? 'COMECE AQUI'
      : done
        ? '✓ LIDA'
        : skippable
          ? 'OPCIONAL'
          : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${node.label}, ${node.readCount} de ${node.itemCount} edições lidas${tag ? `, ${tag.toLowerCase()}` : ''}`}
      style={({ pressed }) => [
        styles.card,
        width ? { width } : null,
        done && styles.cardDone,
        skippable && !current && styles.cardOptional,
        current && {
          borderColor: accent,
          borderWidth: 2,
          backgroundColor: mix(accent, Colors.ink900, 0.86),
          boxShadow: `3px 3px 0 0 ${accent}`,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <MediaImage url={node.coverUrl} style={[styles.thumb, skippable && { opacity: 0.6 }]} />
      <View style={{ flex: 1, gap: 4 }}>
        {tag ? (
          <Text
            style={[
              styles.tag,
              current
                ? { backgroundColor: accent, color: readableOn(accent) }
                : done
                  ? { color: Colors.success }
                  : node.entry
                    ? { color: mix(accent, '#ffffff', 0.35) }
                    : { color: Colors.ink400 },
            ]}
          >
            {tag}
          </Text>
        ) : null}
        <Text style={[styles.title, done && { color: Colors.ink300 }]} numberOfLines={2}>
          {node.label}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.count}>
            {node.readCount ? `${node.readCount} de ${node.itemCount}` : `${node.itemCount} ed.`}
          </Text>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${percent(node.readCount, node.itemCount)}%`,
                  backgroundColor: done ? Colors.success : accent,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * A visão geral ("afastado"): cada passo vira uma fileira de tracinhos, um
 * por história, pintados pelo estado. Uma saga de 300 edições cabe numa tela;
 * tocar numa fileira volta para o mapa naquele ponto.
 */
export function StepOverviewRow({
  step,
  accent,
  currentId,
  optional,
  onPress,
}: {
  step: Step;
  accent: string;
  currentId: string | null;
  optional: Map<string, NodeOptional>;
  onPress: () => void;
}) {
  const many = step.nodes.length > 5;
  return (
    <Pressable onPress={onPress} style={styles.overviewRow} accessibilityRole="button">
      <Text style={[styles.overviewAct, { color: mix(accent, '#ffffff', 0.35) }]} numberOfLines={1}>
        {step.actStart && step.act ? step.act.split('·')[0]!.trim().toUpperCase() : ''}
      </Text>
      <View style={[styles.overviewBlocks, { gap: many ? 4 : 8 }]}>
        {step.nodes.map((node) => {
          const state = stepNodeState(node, currentId);
          const skippable = isOptionalNode(optional.get(node.id));
          return (
            <View
              key={node.id}
              style={[
                styles.block,
                step.nodes.length === 1
                  ? { width: 140 }
                  : many
                    ? { flex: 1, maxWidth: 36 }
                    : { width: 56 },
                state === 'done'
                  ? { backgroundColor: Colors.success }
                  : state === 'current'
                    ? {
                        backgroundColor: accent,
                        boxShadow: `0 0 0 3px ${mix(accent, Colors.ink900, 0.6)}`,
                      }
                    : skippable
                      ? { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.ink500 }
                      : state === 'partial'
                        ? { backgroundColor: mix(accent, Colors.ink900, 0.55) }
                        : { backgroundColor: Colors.ink600 },
              ]}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  act: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, paddingBottom: 10, gap: 2 },
  actName: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  hidden: { color: Colors.ink500, fontSize: 12 },
  connector: {
    width: 2,
    height: 18,
    marginLeft: Spacing.three + 28,
    backgroundColor: Colors.ink600,
  },
  parallel: {
    color: Colors.ink400,
    fontSize: 12,
    paddingHorizontal: Spacing.three,
    marginBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    marginTop: 8,
  },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ink600 },
  swipe: { color: Colors.ink500, fontSize: 11, marginLeft: 6 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  cardDone: { borderColor: 'rgba(110, 231, 168, 0.45)', backgroundColor: Colors.ink900 },
  cardOptional: {
    borderStyle: 'dashed',
    borderColor: Colors.ink500,
    backgroundColor: Colors.ink900,
  },
  thumb: { width: 44, height: 66, borderRadius: 5 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: Colors.ink100, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  count: { color: Colors.ink400, fontSize: 11 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.ink700, overflow: 'hidden' },
  barFill: { height: '100%' },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    paddingHorizontal: Spacing.three,
  },
  overviewAct: { width: 56, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  overviewBlocks: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  block: { height: 14, borderRadius: 4 },
});
