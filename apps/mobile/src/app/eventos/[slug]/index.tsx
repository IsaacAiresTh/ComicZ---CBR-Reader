import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { GuideDetail, GuideItemView, GuideNodeView } from '@comicz/shared';

import { CharacterText } from '@/components/CharacterText';
import { EventNodeSheet } from '@/components/EventNodeSheet';
import { StepOverviewRow, StepRow } from '@/components/EventStepMap';
import { nextItem, TrailRowView, type TrailRow } from '@/components/EventTrail';
import { QueryError } from '@/components/QueryError';
import { Badge, Eyebrow, Loading, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Fonts, mix, readableOn, Spacing } from '@/constants/theme';
import { enqueueDownloads, useDownloads } from '@/lib/downloads';
import { actByNode, buildSteps, currentStepIndex, lineOf, type Step } from '@/lib/eventSteps';
import { isOptionalNode, optionalByNode } from '@/lib/eventTimeline';
import { agruparEmAtos, comicLabel, percent, plural } from '@/lib/format';
import { useCharacters, useGuide } from '@/lib/queries';

type Mode = 'ordem' | 'mapa';

type Row =
  | { kind: 'step'; key: string; step: Step; index: number }
  | { kind: 'overview'; key: string; step: Step; index: number }
  | { kind: 'trail'; key: string; row: TrailRow }
  | { kind: 'actDone'; key: string; actKey: string; name: string; count: number };

/**
 * A ordem por atos. Um ato todo lido fecha numa linha só ("✓ Ato 1 · 3
 * edições lidas"): numa saga de 300 edições, o que já passou não deve
 * empurrar para baixo o que vem agora.
 */
function orderRows(items: GuideItemView[], essentialOnly: boolean, openActs: Set<string>): Row[] {
  const visible = essentialOnly ? items.filter((item) => !item.optional) : items;
  return agruparEmAtos(visible).flatMap((act): Row[] => {
    const done = act.itens.every((item) => item.comic.progress?.completed);
    if (act.nome && done && !openActs.has(act.key)) {
      return [
        {
          kind: 'actDone',
          key: `feito-${act.key}`,
          actKey: act.key,
          name: act.nome,
          count: act.itens.length,
        },
      ];
    }
    return [
      ...(act.nome
        ? [
            {
              kind: 'trail' as const,
              key: act.key,
              row: { kind: 'act' as const, key: act.key, name: act.nome, count: act.itens.length },
            },
          ]
        : []),
      ...act.itens.map((item) => ({
        kind: 'trail' as const,
        key: item.id,
        row: { kind: 'item' as const, key: item.id, item },
      })),
    ];
  });
}

/**
 * A página de uma grande saga no celular.
 *
 * Duas formas de ver: a ORDEM (a lista por atos, para quem só quer seguir) e
 * o MAPA (um passo por linha; o que corre em paralelo desliza para o lado).
 * No mapa dá para afastar até ver a saga inteira de uma vez e para "seguir
 * só uma linha" — a trilha de uma frente num evento com nove. Em qualquer
 * das duas, a próxima edição fica presa no pé da tela, a um toque.
 */
export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useGuide(slug);
  const { comics: downloaded, active } = useDownloads();
  const [selected, setSelected] = useState<GuideNodeView | null>(null);
  const [essentialOnly, setEssentialOnly] = useState(false);
  const [mode, setMode] = useState<Mode>('mapa');
  const [overview, setOverview] = useState(false);
  const [following, setFollowing] = useState<GuideNodeView | null>(null);
  const [openActs, setOpenActs] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<Row>>(null);
  // Rola só quando a pessoa pede (trocou de vista, tocou na visão geral):
  // ao abrir, o topo com o resumo da saga vem primeiro.
  const pendingScroll = useRef<number | null>(null);

  const guide = query.data;
  const hasMap = (guide?.nodes.length ?? 0) > 0;
  const effectiveMode: Mode = hasMap ? mode : 'ordem';

  const optional = optionalByNode(guide?.items ?? []);
  const line = following && guide ? lineOf(guide.nodes, following.id) : null;
  const steps = guide
    ? buildSteps(
        guide.nodes,
        guide.items,
        (node) =>
          (!essentialOnly || !isOptionalNode(optional.get(node.id))) &&
          (!line || line.has(node.id)),
      )
    : [];
  const next = guide ? nextItem(guide.items) : null;
  const currentId = next && !next.comic.progress?.completed ? next.nodeId : null;

  const rows: Row[] = !guide
    ? []
    : effectiveMode === 'ordem'
      ? orderRows(guide.items, essentialOnly, openActs)
      : overview
        ? steps.map((step, index) => ({ kind: 'overview', key: `ov-${step.key}`, step, index }))
        : steps.map((step, index) => ({ kind: 'step', key: step.key, step, index }));

  useEffect(() => {
    const index = pendingScroll.current;
    if (index == null || index < 0) return;
    pendingScroll.current = null;
    requestAnimationFrame(() =>
      listRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true }),
    );
  }, [effectiveMode, overview, following]);

  if (query.isPending) return <Loading />;
  if (query.isError || !guide)
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const accent = guide.accentColor ?? Colors.brand;
  const accentText = mix(accent, '#ffffff', 0.35);
  const skippable = guide.nodes.filter((node) => isOptionalNode(optional.get(node.id)));
  const optionalCount = guide.items.filter((item) => item.optional).length;

  // Seguindo uma linha: quantas histórias de cada ato ficaram de fora.
  const acts = actByNode(guide.items);
  const hiddenByAct = new Map<string, number>();
  if (line) {
    for (const node of guide.nodes) {
      const act = acts.get(node.id);
      if (!line.has(node.id) && act) hiddenByAct.set(act, (hiddenByAct.get(act) ?? 0) + 1);
    }
  }

  // Histórias que dividem o passo com outras: correm em paralelo.
  const parallelIds = new Set(
    steps.filter((step) => step.nodes.length > 1).flatMap((step) => step.nodes.map((n) => n.id)),
  );

  const switchMode = (value: Mode) => {
    if (value === mode) return;
    if (value === 'mapa') pendingScroll.current = currentStepIndex(steps, currentId);
    setMode(value);
  };

  const follow = (node: GuideNodeView) => {
    setSelected(null);
    setOverview(false);
    setMode('mapa');
    const lineSteps = buildSteps(guide.nodes, guide.items, (candidate) =>
      lineOf(guide.nodes, node.id).has(candidate.id),
    );
    pendingScroll.current = currentStepIndex(lineSteps, node.id);
    setFollowing(node);
  };

  const openEditions = (node: GuideNodeView) => {
    setSelected(null);
    router.push({ pathname: '/eventos/[slug]/[bloco]', params: { slug, bloco: node.id } });
  };

  // "Baixar o ato": o que falta ler no ato da próxima edição.
  const actItems = next
    ? guide.items.filter((item) =>
        next.chapter ? item.chapter === next.chapter : item.nodeId === next.nodeId,
      )
    : [];
  const toDownload = actItems.filter(
    (item) =>
      item.comic.file?.status === 'READY' &&
      !item.comic.progress?.completed &&
      !downloaded[item.comic.id] &&
      !active[item.comic.id],
  );
  const nextIndex = next ? guide.items.findIndex((item) => item.id === next.id) : -1;

  const controls = (
    <View style={[styles.padded, { gap: 12 }]}>
      {hasMap ? (
        <View style={styles.segmented} accessibilityRole="tablist">
          {(['ordem', 'mapa'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: effectiveMode === value }}
              onPress={() => switchMode(value)}
              style={[styles.segment, effectiveMode === value && styles.segmentActive]}
            >
              <Text
                style={[styles.segmentLabel, effectiveMode === value && styles.segmentLabelActive]}
              >
                {value === 'ordem' ? 'Ordem' : 'Mapa'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Eyebrow>A trilha</Eyebrow>
      )}

      {effectiveMode === 'mapa' ? (
        <>
          <View style={styles.legend}>
            <Legend color={Colors.success} label="lida" />
            <Legend color={accent} label="você está aqui" />
            <Legend dashed label="opcional" />
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (overview) pendingScroll.current = currentStepIndex(steps, currentId);
                setOverview((value) => !value);
              }}
              style={styles.overviewButton}
              accessibilityRole="button"
            >
              <Ionicons
                name={overview ? 'expand-outline' : 'contract-outline'}
                size={15}
                color={accentText}
              />
              <Text style={[styles.overviewLabel, { color: accentText }]}>
                {overview ? 'Aproximar' : 'Visão geral'}
              </Text>
            </Pressable>
          </View>
          {overview ? (
            <Text style={styles.help}>
              Cada tracinho é uma história. Toque numa fileira para aproximar ali.
            </Text>
          ) : !following ? (
            <Text style={styles.help}>
              A leitura <Text style={styles.strong}>desce</Text>. Quando várias histórias acontecem
              ao mesmo tempo, elas ficam lado a lado — deslize e leia na ordem que quiser.
            </Text>
          ) : null}
          {following ? (
            <View style={[styles.following, { borderColor: mix(accent, Colors.ink900, 0.4) }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.followingEyebrow, { color: accentText }]}>
                  SEGUINDO A LINHA DE
                </Text>
                <Text style={styles.followingName} numberOfLines={1}>
                  {following.label}
                </Text>
              </View>
              <Pressable
                onPress={() => setFollowing(null)}
                style={styles.followingButton}
                accessibilityRole="button"
              >
                <Text style={styles.followingButtonLabel}>Ver tudo</Text>
              </Pressable>
            </View>
          ) : null}
          {skippable.length > 0 && !following ? (
            <View style={styles.toggle}>
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
        </>
      ) : optionalCount > 0 ? (
        <View style={styles.toggle}>
          <Text style={styles.small}>Só o essencial · esconde {optionalCount} opcionais</Text>
          <Switch
            value={essentialOnly}
            onValueChange={setEssentialOnly}
            trackColor={{ true: accent, false: Colors.ink700 }}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingBottom: next ? 120 : Spacing.five }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
          setTimeout(
            () => listRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true }),
            120,
          );
        }}
        ListHeaderComponent={
          <View style={{ gap: Spacing.four, marginBottom: Spacing.two }}>
            <Hero guide={guide} accent={accent} accentText={accentText} />
            <Cast guide={guide} accent={accent} />
            <About text={guide.description} accentText={accentText} />
            {controls}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Esta saga ainda não tem HQs.</Text>}
        renderItem={({ item, index }) => {
          if (item.kind === 'step') {
            return (
              <StepRow
                step={item.step}
                first={index === 0}
                accent={accent}
                currentId={currentId}
                optional={optional}
                hiddenInAct={item.step.act ? hiddenByAct.get(item.step.act) : undefined}
                onPress={setSelected}
              />
            );
          }
          if (item.kind === 'overview') {
            return (
              <StepOverviewRow
                step={item.step}
                accent={accent}
                currentId={currentId}
                optional={optional}
                onPress={() => {
                  pendingScroll.current = item.index;
                  setOverview(false);
                }}
              />
            );
          }
          if (item.kind === 'actDone') {
            return (
              <Pressable
                style={styles.actDone}
                onPress={() => setOpenActs((open) => new Set(open).add(item.actKey))}
              >
                <Text style={styles.actDoneCheck}>✓</Text>
                <Text style={styles.actDoneLabel} numberOfLines={1}>
                  {item.name} · {plural(item.count, 'edição lida', 'edições lidas')}
                </Text>
                <Text style={styles.small}>abrir</Text>
              </Pressable>
            );
          }
          return <TrailRowView row={item.row} accent={accent} />;
        }}
      />

      {next ? (
        <SafeAreaView edges={['bottom']} style={styles.nextBarWrap} pointerEvents="box-none">
          <View style={[styles.nextBar, { borderColor: mix(accent, Colors.ink900, 0.45) }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.nextEyebrow, { color: accentText }]}>
                {next.comic.progress?.completed ? 'RELER' : 'PRÓXIMA'} · {nextIndex + 1} DE{' '}
                {guide.items.length}
              </Text>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {comicLabel(next.comic)}
              </Text>
            </View>
            {toDownload.length > 0 ? (
              <Pressable
                onPress={() =>
                  enqueueDownloads(
                    toDownload.map((item) => ({
                      comicId: item.comic.id,
                      coverUrl: item.comic.coverUrl,
                    })),
                  )
                }
                style={styles.nextIcon}
                accessibilityRole="button"
                accessibilityLabel={`Baixar ${plural(toDownload.length, 'edição', 'edições')} ${next.chapter ? `do ${next.chapter}` : 'desta história'}`}
              >
                <Ionicons name="arrow-down" size={18} color={Colors.ink100} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push({ pathname: '/ler/[id]', params: { id: next.comic.id } })}
              style={[styles.nextRead, { backgroundColor: accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.nextReadLabel, { color: readableOn(accent) }]}>Ler</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}

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
          selected?.id === currentId
            ? 'Você está aqui'
            : selected?.entry
              ? 'Comece aqui'
              : selected && parallelIds.has(selected.id)
                ? 'Acontece junto com outras'
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
        onFollow={following?.id === selected?.id ? undefined : follow}
      />
    </View>
  );
}

function Legend({ color, dashed, label }: { color?: string; dashed?: boolean; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          dashed
            ? { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.ink400 }
            : { backgroundColor: color },
        ]}
      />
      <Text style={styles.small}>{label}</Text>
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
  help: { color: Colors.ink300, fontSize: 13, lineHeight: 19 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  segment: { flex: 1, height: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.ink700 },
  segmentLabel: { color: Colors.ink400, fontSize: 14, fontWeight: '600' },
  segmentLabelActive: { color: Colors.ink100, fontWeight: '800' },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  overviewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  overviewLabel: { fontSize: 13, fontWeight: '700' },
  following: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    paddingLeft: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: Colors.ink850,
  },
  followingEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  followingName: { color: Colors.ink100, fontSize: 14, fontWeight: '800' },
  followingButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.ink600,
    justifyContent: 'center',
  },
  followingButtonLabel: { color: Colors.ink100, fontSize: 13, fontWeight: '700' },
  actDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
  },
  actDoneCheck: { color: Colors.success, fontWeight: '900' },
  actDoneLabel: { flex: 1, color: Colors.ink300, fontSize: 14 },
  nextBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  nextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    paddingLeft: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: Colors.ink850,
    boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)',
  },
  nextEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  nextTitle: { color: Colors.ink100, fontSize: 14, fontWeight: '800', marginTop: 2 },
  nextIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ink600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRead: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextReadLabel: { fontSize: 15, fontWeight: '800' },
  empty: { color: Colors.ink500, textAlign: 'center', padding: Spacing.four },
});

export { ErrorBoundary } from '@/components/RouteError';
