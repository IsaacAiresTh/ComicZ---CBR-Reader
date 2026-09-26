import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CharacterDetail, CharacterMilestoneView } from '@comicz/shared';

import { CharacterText } from '@/components/CharacterText';
import { QueryError } from '@/components/QueryError';
import { Eyebrow, Loading, MediaImage } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { comicLabel, plural } from '@/lib/format';
import { useCharacter } from '@/lib/queries';

/**
 * A página do personagem, na ordem do site: topo, ficha, "se é sua primeira
 * vez", linha do tempo, por que importa, onde aparece, elenco e relacionados.
 * A cor do personagem entra só nos acentos; a fonte temática do site fica de
 * fora (exigiria embutir cinco famílias no app).
 */
export default function CharacterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useCharacter(slug);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const character = query.data;
  const accent = character.accentColor ?? Colors.brand;

  return (
    <>
      <Stack.Screen options={{ title: character.name }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: Spacing.five, gap: Spacing.five }}
      >
        <Top character={character} accent={accent} />
        <Facts character={character} accent={accent} />
        {character.primer ? <FirstTime character={character} accent={accent} /> : null}
        {character.milestones.length > 0 ? (
          <Timeline milestones={character.milestones} slug={character.slug} accent={accent} />
        ) : character.description ? (
          <Section title="A história">
            {character.description.split(/\n{2,}/).map((paragraph, i) => (
              <CharacterText
                key={i}
                texto={paragraph}
                exceto={character.slug}
                style={styles.text}
                linkColor={accent}
              />
            ))}
          </Section>
        ) : null}
        {character.whyMatters ? (
          <Section title="Por que ele importa">
            <CharacterText
              texto={character.whyMatters}
              exceto={character.slug}
              style={styles.text}
              linkColor={accent}
            />
          </Section>
        ) : null}
        <Appearances character={character} accent={accent} />
        {character.guides.length > 0 ? (
          <Section title="No elenco de">
            {character.guides.map((guide) => (
              <Pressable
                key={guide.id}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: guide.kind === 'EVENT' ? '/eventos/[slug]' : '/guias/[slug]',
                    params: { slug: guide.slug },
                  })
                }
              >
                <Text style={styles.cardTitle}>{guide.title}</Text>
                {guide.role ? <Text style={styles.muted}>{guide.role}</Text> : null}
              </Pressable>
            ))}
          </Section>
        ) : null}
        {character.related.length > 0 ? (
          <Section title="Personagens relacionados">
            <Text style={styles.muted}>Quem mais aparece nas mesmas edições do acervo.</Text>
            <View style={styles.wrap}>
              {character.related.map((other) => (
                <Pressable
                  key={other.id}
                  style={styles.pill}
                  onPress={() =>
                    router.push({ pathname: '/personagens/[slug]', params: { slug: other.slug } })
                  }
                >
                  <MediaImage url={other.portraitUrl} style={styles.pillFace} />
                  <Text style={styles.pillText}>{other.name}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function Top({ character, accent }: { character: CharacterDetail; accent: string }) {
  // Mesma regra do site: 0 é o retrato, 1 é a arte do topo; o emblema fica de fora.
  const images = character.images.filter((image) => !image.emblem);
  const art = images[1] ?? images[0] ?? null;
  const portrait = images.length > 1 ? images[0] : null;

  return (
    <View style={styles.top}>
      {art ? (
        <MediaImage url={art.url} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} />
      ) : null}
      <View style={styles.topShade} />
      <Text style={styles.crumb}>
        Personagens{character.publisher ? ` · ${character.publisher}` : ''}
      </Text>
      {portrait ? (
        <MediaImage url={portrait.url} style={[styles.portrait, { borderColor: accent }]} />
      ) : null}
      <Text style={[styles.name, { color: accent }]}>{character.name}</Text>
      <View style={[styles.rule, { backgroundColor: accent }]} />
      {character.summary ? <Text style={styles.summary}>{character.summary}</Text> : null}
      {character.tags.length > 0 ? (
        <View style={styles.wrap}>
          {character.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={styles.muted}>
        <Text style={{ color: Colors.ink100, fontWeight: '700' }}>{character.comicCount}</Text>{' '}
        {character.comicCount === 1 ? 'edição no acervo' : 'edições no acervo'}
      </Text>
    </View>
  );
}

function Facts({ character, accent }: { character: CharacterDetail; accent: string }) {
  const facts: { title: string; body: React.ReactNode }[] = [];
  if (character.firstAppearance) {
    facts.push({
      title: 'Primeira aparição',
      body: (
        <>
          <Text style={styles.factMain}>{character.firstAppearance}</Text>
          {character.firstAppearanceYear ? (
            <Text style={styles.muted}>{character.firstAppearanceYear}</Text>
          ) : null}
        </>
      ),
    });
  }
  if (character.affiliations.length > 0) {
    facts.push({
      title: 'Afiliações',
      // A primeira é a atual; as seguintes são histórico e vêm apagadas.
      body: character.affiliations.map((affiliation, i) => (
        <Text key={affiliation} style={i === 0 ? styles.factMain : styles.muted}>
          {affiliation}
        </Text>
      )),
    });
  }
  if (character.powers.length > 0) {
    facts.push({
      title: 'Poderes',
      body: (
        <View style={styles.wrap}>
          {character.powers.map((power) => (
            <Text key={power} style={styles.power}>
              {power}
            </Text>
          ))}
        </View>
      ),
    });
  }
  if (character.powerLevel || character.powerLevelRank) {
    facts.push({
      title: 'Nível de poder',
      body: (
        <>
          {character.powerLevel ? (
            <Text style={styles.factMain}>{character.powerLevel}</Text>
          ) : null}
          {character.powerLevelRank ? (
            <View
              style={styles.levels}
              accessibilityLabel={`Nível ${character.powerLevelRank} de 5`}
            >
              {[1, 2, 3, 4, 5].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.level,
                    { backgroundColor: step <= character.powerLevelRank! ? accent : Colors.ink800 },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </>
      ),
    });
  }
  if (character.status) {
    facts.push({
      title: 'Status atual',
      body: (
        <>
          <Text style={styles.factMain}>{character.status}</Text>
          {character.statusNote ? <Text style={styles.muted}>{character.statusNote}</Text> : null}
        </>
      ),
    });
  }
  if (facts.length === 0) return null;

  return (
    <View style={styles.facts}>
      {facts.map((fact) => (
        <View key={fact.title} style={styles.fact}>
          <Eyebrow>{fact.title}</Eyebrow>
          <View style={{ gap: 2, marginTop: 6 }}>{fact.body}</View>
        </View>
      ))}
    </View>
  );
}

function FirstTime({ character, accent }: { character: CharacterDetail; accent: string }) {
  const start = character.startHere;
  return (
    <Section title="Se é sua primeira vez">
      <CharacterText
        texto={character.primer ?? ''}
        exceto={character.slug}
        style={styles.text}
        linkColor={accent}
      />
      {start ? (
        <Pressable
          style={[styles.card, { borderColor: accent }]}
          onPress={() => router.push({ pathname: '/saga/[id]', params: { id: start.seriesId } })}
        >
          <Eyebrow>Se você só vai ler uma coisa</Eyebrow>
          <Text style={[styles.startTitle, { color: Colors.ink100 }]}>{start.name}</Text>
          <Text style={styles.muted}>
            {plural(start.issueCount, 'edição', 'edições')}
            {start.note ? ` · ${start.note}` : ''}
          </Text>
        </Pressable>
      ) : null}
    </Section>
  );
}

/**
 * A linha do tempo. Marco de spoiler nasce escondido e se revela com um
 * toque — no site é um borrão; aqui o texto nem é desenhado até pedir.
 */
function Timeline({
  milestones,
  slug,
  accent,
}: {
  milestones: CharacterMilestoneView[];
  slug: string;
  accent: string;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  return (
    <Section title="A história">
      {milestones.map((milestone, i) => {
        const hidden = milestone.spoiler && !revealed.has(milestone.id);
        return (
          <View key={milestone.id} style={styles.milestone}>
            <Text style={[styles.era, { color: accent }]}>
              {String(i + 1).padStart(2, '0')} · {milestone.era.toUpperCase()}
              {milestone.spoiler ? <Text style={{ color: Colors.ink500 }}> SPOILER</Text> : null}
            </Text>
            {milestone.headline ? <Text style={styles.headline}>{milestone.headline}</Text> : null}
            {hidden ? (
              <Pressable
                style={styles.spoiler}
                onPress={() => setRevealed((current) => new Set(current).add(milestone.id))}
              >
                <Ionicons name="eye-off-outline" size={18} color={Colors.ink400} />
                <Text style={styles.muted}>Contém spoiler — toque para revelar</Text>
              </Pressable>
            ) : (
              <>
                {milestone.body.split(/\n{2,}/).map((paragraph, j) => (
                  <CharacterText
                    key={j}
                    texto={paragraph}
                    exceto={slug}
                    style={styles.text}
                    linkColor={accent}
                  />
                ))}
                {milestone.imageUrl ? (
                  <View style={{ gap: 4 }}>
                    <MediaImage
                      url={milestone.imageUrl}
                      style={styles.milestoneArt}
                      contentFit="contain"
                    />
                    {milestone.sourceLabel ? (
                      <Text style={styles.muted}>{milestone.sourceLabel}</Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
      })}
    </Section>
  );
}

function Appearances({ character, accent }: { character: CharacterDetail; accent: string }) {
  const sagas = character.appearances.filter((group) => group.slug && group.seriesId);
  const loose = character.appearances.find((group) => !group.slug)?.comics ?? [];

  return (
    <Section
      title="Onde aparece"
      aside={`${plural(character.comicCount, 'edição', 'edições')}${sagas.length ? ` · ${plural(sagas.length, 'saga', 'sagas')}` : ''}`}
    >
      {character.appearances.length === 0 ? (
        <Text style={styles.muted}>
          Nenhuma edição do acervo está marcada com este personagem ainda.
        </Text>
      ) : null}
      {sagas.length > 0 ? (
        <>
          <Text style={styles.muted}>Na ordem em que fazem mais sentido ler.</Text>
          <View style={styles.list}>
            {sagas.map((group, i) => (
              <AppearanceRow
                key={group.seriesId}
                number={i + 1}
                accent={accent}
                cover={group.comics[0]?.coverUrl ?? null}
                title={group.name}
                detail={[plural(group.comics.length, 'edição', 'edições'), group.note]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({ pathname: '/saga/[id]', params: { id: group.seriesId! } })
                }
              />
            ))}
          </View>
        </>
      ) : null}
      {loose.length > 0 ? (
        <>
          <Text style={styles.muted}>
            Edições avulsas — não fazem parte de nenhuma saga do acervo.
          </Text>
          <View style={styles.list}>
            {loose.map((comic) => (
              <AppearanceRow
                key={comic.id}
                accent={accent}
                cover={comic.coverUrl}
                title={comicLabel(comic)}
                detail={comic.publisher?.name ?? null}
                onPress={() => router.push({ pathname: '/hq/[id]', params: { id: comic.id } })}
              />
            ))}
          </View>
        </>
      ) : null}
    </Section>
  );
}

function AppearanceRow({
  number,
  accent,
  cover,
  title,
  detail,
  onPress,
}: {
  number?: number;
  accent: string;
  cover: string | null;
  title: string;
  detail: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.appearance, pressed && { backgroundColor: Colors.ink850 }]}
    >
      {number != null ? (
        <Text style={[styles.number, { color: accent }]}>{String(number).padStart(2, '0')}</Text>
      ) : null}
      <MediaImage url={cover} style={styles.appearanceCover} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.muted} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.ink600} />
    </Pressable>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Eyebrow>{title}</Eyebrow>
        {aside ? <Text style={styles.muted}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  top: { padding: Spacing.three, paddingTop: Spacing.five, gap: Spacing.two, overflow: 'hidden' },
  topShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 13, 18, 0.55)' },
  crumb: { color: Colors.ink300, fontSize: 13 },
  portrait: { width: 80, height: 80, borderRadius: 40, borderWidth: 3 },
  name: { fontSize: 42, fontWeight: '900', lineHeight: 44 },
  rule: { width: 120, height: 6, borderRadius: 3 },
  summary: { color: Colors.ink200, fontSize: 15, lineHeight: 22 },
  tag: {
    color: Colors.ink100,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(238, 241, 247, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muted: { color: Colors.ink400, fontSize: 13 },
  facts: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  fact: { width: '50%', paddingRight: Spacing.two },
  factMain: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  power: {
    color: Colors.ink200,
    fontSize: 12,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levels: { flexDirection: 'row', gap: 4, marginTop: 6 },
  level: { flex: 1, height: 6, borderRadius: 2 },
  section: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  text: { color: Colors.ink200, fontSize: 15, lineHeight: 24 },
  card: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    gap: 4,
  },
  cardTitle: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  startTitle: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  milestone: { gap: Spacing.two, paddingBottom: Spacing.three },
  era: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  headline: { color: Colors.ink100, fontSize: 22, fontWeight: '800', lineHeight: 27 },
  spoiler: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
    backgroundColor: Colors.ink850,
  },
  milestoneArt: { width: '100%', aspectRatio: 1.4, borderRadius: 10 },
  list: { borderRadius: 12, borderWidth: 1, borderColor: Colors.ink800, overflow: 'hidden' },
  appearance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ink800,
  },
  number: { width: 22, fontSize: 14, fontWeight: '700' },
  appearanceCover: { width: 40, height: 56, borderRadius: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.ink800,
  },
  pillFace: { width: 28, height: 28, borderRadius: 14 },
  pillText: { color: Colors.ink200, fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
