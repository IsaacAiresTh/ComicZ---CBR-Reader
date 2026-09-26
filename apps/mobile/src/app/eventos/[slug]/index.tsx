import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { GuideDetail, GuideNodeView } from '@comicz/shared';

import { CharacterText } from '@/components/CharacterText';
import { EventNodeSheet } from '@/components/EventNodeSheet';
import { TimelineRowView } from '@/components/EventTimeline';
import { trailRows, TrailRowView, type TrailRow } from '@/components/EventTrail';
import { QueryError } from '@/components/QueryError';
import { Badge, Eyebrow, Loading, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Fonts, mix, readableOn, Spacing } from '@/constants/theme';
import {
  buildTimeline,
  isOptionalNode,
  nodeState,
  optionalByNode,
  type NodeOptional,
  type TimelineRow,
} from '@/lib/eventTimeline';
import { percent } from '@/lib/format';
import { useCharacters, useGuide } from '@/lib/queries';

type Row = { kind: 'map'; row: TimelineRow } | { kind: 'trail'; row: TrailRow };

/**
 * A página de um evento, no desenho do app: topo com a capa desfocada, elenco,
 * "o que é" recolhido, os pontos de partida e o mapa como linha do tempo.
 * Tocar numa história abre uma folha com o resumo e o "começar/continuar".
 *
 * Evento sem mapa (só a trilha) cai direto na lista de edições, como no site.
 */
export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useGuide(slug);
  const [selected, setSelected] = useState<GuideNodeView | null>(null);
  const [essentialOnly, setEssentialOnly] = useState(false);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const guide = query.data;
  const accent = guide.accentColor ?? Colors.brand;
  const accentText = mix(accent, '#ffffff', 0.35);
  const optional = optionalByNode(guide.items);
  const skippable = guide.nodes.filter((node) => isOptionalNode(optional.get(node.id)));
  // "Só o essencial" no mapa esconde as histórias que dá para pular inteiras.
  const shownNodes = essentialOnly
    ? guide.nodes.filter((node) => !isOptionalNode(optional.get(node.id)))
    : guide.nodes;
  const { entries, rows: timeline } = buildTimeline(shownNodes);
  const hasMap = guide.nodes.length > 0;

  const rows: Row[] = hasMap
    ? timeline.map((row) => ({ kind: 'map', row }))
    : trailRows(guide.items, essentialOnly).map((row) => ({ kind: 'trail', row }));
  const optionalCount = guide.items.filter((item) => item.optional).length;

  const openEditions = (node: GuideNodeView) => {
    setSelected(null);
    router.push({ pathname: '/eventos/[slug]/[bloco]', params: { slug, bloco: node.id } });
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.row.key}
        contentContainerStyle={{ paddingBottom: Spacing.five }}
        ListHeaderComponent={
          <View style={{ gap: Spacing.four }}>
            <Hero guide={guide} accent={accent} accentText={accentText} />
            <Cast guide={guide} accent={accent} />
            <About text={guide.description} accentText={accentText} />
            {hasMap ? (
              <>
                <View style={styles.padded}>
                  <Eyebrow>O mapa</Eyebrow>
                  <Text style={styles.help}>
                    Cada bloco é uma história inteira, e a leitura{' '}
                    <Text style={styles.strong}>desce</Text>: o que está mais embaixo se lê depois.
                    As histórias <Text style={styles.strong}>recuadas</Text> correm em paralelo —
                    leia na ordem que quiser, antes de onde elas voltam. As marcadas como{' '}
                    <Text style={styles.strong}>opcional</Text> dá para pular.
                  </Text>
                  {skippable.length > 0 ? (
                    <View style={styles.essential}>
                      <Text style={styles.small}>
                        Só o essencial
                        {essentialOnly
                          ? ` · ${guide.nodes.length - skippable.length} de ${guide.nodes.length} histórias`
                          : ` · esconde ${skippable.length} opcionais`}
                      </Text>
                      <Switch
                        value={essentialOnly}
                        onValueChange={setEssentialOnly}
                        trackColor={{ true: accent, false: Colors.ink700 }}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={[styles.padded, { gap: Spacing.two }]}>
                  {entries.map((node) => (
                    <EntryCard
                      key={node.id}
                      node={node}
                      accent={accent}
                      optional={optional.get(node.id)}
                      onPress={() => setSelected(node)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={[styles.padded, styles.trailHeader]}>
                <Eyebrow>A trilha</Eyebrow>
                {optionalCount > 0 ? (
                  <View style={styles.toggle}>
                    <Text style={styles.small}>Só o essencial</Text>
                    <Switch
                      value={essentialOnly}
                      onValueChange={setEssentialOnly}
                      trackColor={{ true: accent, false: Colors.ink700 }}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          hasMap ? null : <Text style={styles.empty}>Este evento ainda não tem HQs.</Text>
        }
        renderItem={({ item }) =>
          item.kind === 'map' ? (
            <View style={styles.padded}>
              <TimelineRowView
                row={item.row}
                accent={accent}
                optional={item.row.kind === 'node' ? optional.get(item.row.node.id) : undefined}
                onPress={setSelected}
              />
            </View>
          ) : (
            <TrailRowView row={item.row} accent={accent} />
          )
        }
      />

      <EventNodeSheet
        node={selected}
        items={selected ? guide.items.filter((item) => item.nodeId === selected.id) : []}
        parents={
          selected
            ? guide.nodes
                .filter((node) => selected.parents.includes(node.id))
                .map((node) => node.label)
            : []
        }
        leadsTo={
          selected
            ? guide.nodes
                .filter((node) => node.parents.includes(selected.id))
                .map((node) => node.label)
            : []
        }
        context={
          selected?.entry
            ? 'Comece aqui'
            : selected && selected.lane > 0
              ? 'Ramo'
              : 'Linha principal'
        }
        accent={accent}
        accentText={accentText}
        onClose={() => setSelected(null)}
        onOpenEditions={openEditions}
        onRead={(item) => {
          setSelected(null);
          router.push({ pathname: '/ler/[id]', params: { id: item.comic.id } });
        }}
      />
    </View>
  );
}

function Hero({
  guide,
  accent,
  accentText,
}: {
  guide: GuideDetail;
  accent: string;
  accentText: string;
}) {
  const read = guide.readCount ?? 0;
  const progress = percent(read, guide.itemCount);
  return (
    <View style={styles.hero}>
      {guide.coverUrl ? (
        <MediaImage url={guide.coverUrl} style={StyleSheet.absoluteFill} blurRadius={6} />
      ) : null}
      <LinearGradient
        colors={['rgba(11,13,18,0.35)', Colors.ink900]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ gap: 12 }}>
        {!guide.published ? <Badge label="rascunho" tone="warning" /> : null}
        <Text style={styles.heroTitle}>{guide.title}</Text>
        {guide.summary ? (
          <CharacterText texto={guide.summary} style={styles.heroSummary} linkColor={accentText} />
        ) : null}
        <View style={styles.stats}>
          <Text style={styles.stat}>
            <Text style={styles.strong}>{guide.itemCount}</Text> edições
          </Text>
          {guide.nodes.length > 0 ? (
            <Text style={styles.stat}>
              <Text style={styles.strong}>{guide.nodes.length}</Text> histórias
            </Text>
          ) : null}
          {guide.characters.length > 0 ? (
            <Text style={styles.stat}>
              <Text style={styles.strong}>{guide.characters.length}</Text> personagens
            </Text>
          ) : null}
        </View>
        <View style={{ gap: 6 }}>
          <View style={styles.progressLabels}>
            <Text style={styles.small}>
              {read} de {guide.itemCount} lidas
            </Text>
            <Text style={styles.small}>{progress}%</Text>
          </View>
          <ProgressBar value={progress} color={accent} />
        </View>
      </View>
    </View>
  );
}

/**
 * O elenco. Não tem chave para o personagem do acervo, então casa por nome,
 * como no site; quem não casar aparece, só não vira link.
 */
function Cast({ guide, accent }: { guide: GuideDetail; accent: string }) {
  const { data: characters } = useCharacters();
  if (guide.characters.length === 0) return null;
  const slugByName = new Map((characters ?? []).map((c) => [c.name.toLowerCase(), c.slug]));

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.padded}>
        <Eyebrow>Quem move a história</Eyebrow>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: Spacing.three }}
      >
        {guide.characters.map((character) => {
          const slug = slugByName.get(character.name.toLowerCase());
          return (
            <Pressable
              key={character.id}
              disabled={!slug}
              style={styles.castItem}
              onPress={() =>
                slug && router.push({ pathname: '/personagens/[slug]', params: { slug } })
              }
            >
              <View style={[styles.face, { borderColor: accent }]}>
                {character.imageUrl ? (
                  <MediaImage url={character.imageUrl} style={styles.faceImage} />
                ) : (
                  <Text style={styles.initial}>{character.name.slice(0, 1)}</Text>
                )}
              </View>
              <Text style={styles.castName} numberOfLines={1}>
                {character.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** "O que é" num cartão, fechado em três linhas: o texto passa de três mil caracteres. */
function About({ text, accentText }: { text: string | null; accentText: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <View style={styles.about}>
      <Eyebrow>O que é</Eyebrow>
      <CharacterText
        texto={text}
        style={styles.aboutText}
        linkColor={accentText}
        numberOfLines={open ? undefined : 3}
      />
      <Text style={[styles.more, { color: accentText }]} onPress={() => setOpen((value) => !value)}>
        {open ? 'Mostrar menos' : 'Ler mais'}
      </Text>
    </View>
  );
}

function EntryCard({
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
  const done = nodeState(node) === 'done';
  // Abertura opcional (o "Prólogo do Tony" da Guerra Civil): contexto, não obrigação.
  const skippable = isOptionalNode(optional);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.entry,
        { borderColor: accent, backgroundColor: mix(accent, Colors.ink900, 0.85) },
        pressed && { opacity: 0.8 },
      ]}
    >
      <MediaImage url={node.coverUrl} style={styles.entryCover} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.entryTags}>
          <Text style={[styles.entryBadge, { backgroundColor: accent, color: readableOn(accent) }]}>
            COMECE AQUI
          </Text>
          {skippable ? (
            <Text style={[styles.entryBadge, styles.optionalBadge]}>OPCIONAL</Text>
          ) : null}
        </View>
        <Text style={styles.entryTitle}>{node.label}</Text>
        {node.note ? (
          <Text style={styles.entryNote} numberOfLines={2}>
            {node.note}
          </Text>
        ) : null}
        <Text style={styles.small}>
          {node.itemCount} ed.
          {done ? ' · lida' : node.readCount ? ` · ${node.readCount} lidas` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  padded: { paddingHorizontal: Spacing.three },
  hero: {
    paddingHorizontal: Spacing.three,
    paddingTop: 28,
    paddingBottom: Spacing.four,
    overflow: 'hidden',
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: 1.2,
    color: Colors.ink100,
  },
  heroSummary: { color: Colors.ink200, fontSize: 15, lineHeight: 22 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6 },
  stat: { color: Colors.ink300, fontSize: 13 },
  strong: { color: Colors.ink100, fontWeight: '700' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { color: Colors.ink400, fontSize: 12 },
  castItem: { width: 72, alignItems: 'center', gap: 6 },
  face: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink800,
  },
  faceImage: { width: 64, height: 64 },
  initial: { color: Colors.ink500, fontSize: 20, fontWeight: '500' },
  castName: {
    width: 72,
    color: Colors.ink100,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  about: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: Colors.ink850,
    gap: 8,
  },
  aboutText: { color: Colors.ink300, fontSize: 14, lineHeight: 22 },
  more: { fontSize: 14, fontWeight: '500', paddingVertical: 4 },
  help: { color: Colors.ink300, fontSize: 14, lineHeight: 21, marginTop: 8 },
  entry: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  entryCover: { width: 56, height: 84, borderRadius: 6 },
  entryTags: { flexDirection: 'row', gap: 6 },
  optionalBadge: { backgroundColor: Colors.ink700, color: Colors.ink300 },
  essential: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  entryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  entryTitle: { color: Colors.ink100, fontSize: 16, fontWeight: '500', lineHeight: 21 },
  entryNote: { color: Colors.ink300, fontSize: 13, lineHeight: 18 },
  trailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  empty: { color: Colors.ink500, textAlign: 'center', padding: Spacing.four },
});

export { ErrorBoundary } from '@/components/RouteError';
