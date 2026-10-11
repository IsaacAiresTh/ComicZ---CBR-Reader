import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { ComicSummary, GuideSummary } from '@comicz/shared';

import { FeaturedCard, FeaturedShelf } from '@/components/Featured';
import { QueryError } from '@/components/QueryError';
import { catalogShelfItem, Shelf, type ShelfItem } from '@/components/Shelf';
import { Button, EmptyState, Eyebrow, Loading, MediaImage, ProgressBar } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { comicLabel, percent, plural } from '@/lib/format';
import { useContinueReading, useFeatured, useGuides, useRecent } from '@/lib/queries';

/**
 * O início do app, como o do site: o que você estava lendo vem primeiro e
 * grande. Quem ainda não leu nada ganha no lugar o primeiro destaque do
 * painel — "comece por esta" —, que é a pergunta de quem acabou de chegar.
 */
export default function HomeScreen() {
  const continueReading = useContinueReading();
  const featured = useFeatured();
  const guides = useGuides();
  const recent = useRecent();

  const queries = [continueReading, featured, guides, recent];
  const refreshing = queries.some((query) => query.isRefetching);
  const refresh = () => queries.forEach((query) => void query.refetch());

  if (queries.every((query) => query.isPending)) return <Loading />;
  if (recent.isError && guides.isError)
    return <QueryError error={recent.error} onRetry={refresh} />;

  const [current, ...alsoReading] = continueReading.data ?? [];
  const highlights = featured.data ?? [];
  const featuredOnTop = !current && !continueReading.isPending && highlights.length > 0;
  const [firstHighlight, ...otherHighlights] = highlights;

  const readingItems: ShelfItem[] = alsoReading.map((comic) => ({
    key: comic.id,
    title: comicLabel(comic),
    subtitle: comic.series?.name,
    coverUrl: comic.coverUrl,
    progress: comic.progress ? percent(comic.progress.currentPage, comic.progress.pageCount) : null,
    onPress: () => router.push({ pathname: '/ler/[id]', params: { id: comic.id } }),
  }));

  const guideList = (guides.data ?? [])
    .filter((guide) => guide.published && guide.kind !== 'EVENT')
    // Os que já começou primeiro: é a trilha que a pessoa está seguindo.
    .sort((a, b) => Number(b.readCount > 0) - Number(a.readCount > 0))
    .slice(0, 4);

  const recentItems: ShelfItem[] = (recent.data?.items ?? []).map(catalogShelfItem);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: Spacing.five }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand} />
      }
    >
      {current ? <ContinueHero comic={current} /> : null}
      {featuredOnTop && firstHighlight ? (
        <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.three }}>
          <FeaturedCard item={firstHighlight} eyebrow="Primeira vez aqui? Comece por esta" />
        </View>
      ) : null}

      <Shelf
        title="Também lendo"
        items={readingItems}
        actionLabel="biblioteca"
        onAction={() => router.navigate('/biblioteca')}
        width={96}
      />

      <FeaturedShelf items={featuredOnTop ? otherHighlights : highlights} />

      {guideList.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {featuredOnTop ? 'Prefere uma ordem pronta?' : 'Siga um guia, na ordem'}
            </Text>
            <Pressable hitSlop={10} onPress={() => router.push('/guias')}>
              <Text style={styles.sectionAction}>todos</Text>
            </Pressable>
          </View>
          <View style={styles.guides}>
            {guideList.map((guide) => (
              <GuideRow key={guide.id} guide={guide} />
            ))}
          </View>
        </View>
      ) : null}

      <Shelf
        title="Adicionadas recentemente"
        items={recentItems}
        actionLabel="ver catálogo"
        onAction={() => router.navigate('/catalogo')}
      />

      {recentItems.length === 0 && guideList.length === 0 && !recent.isPending ? (
        <EmptyState
          title="O catálogo está vazio"
          message="Assim que HQs forem enviadas pelo site, elas aparecem aqui."
        />
      ) : null}
    </ScrollView>
  );
}

/** A HQ do momento, grande: capa, quanto falta e um botão só. */
function ContinueHero({ comic }: { comic: ComicSummary }) {
  const progress = comic.progress;
  const left = progress ? Math.max(0, progress.pageCount - progress.currentPage) : null;
  const open = () => router.push({ pathname: '/ler/[id]', params: { id: comic.id } });
  return (
    <Pressable
      onPress={open}
      style={styles.hero}
      accessibilityLabel={`Continuar ${comicLabel(comic)}`}
    >
      <MediaImage url={comic.coverUrl} style={styles.heroCover} />
      <View style={styles.heroText}>
        <Eyebrow color={Colors.brandLight}>Continue de onde parou</Eyebrow>
        <Text style={styles.heroTitle} numberOfLines={3}>
          {comicLabel(comic)}
        </Text>
        {left != null ? (
          <Text style={styles.heroMeta}>
            {left === 0 ? 'última página' : `faltam ${plural(left, 'página', 'páginas')}`}
          </Text>
        ) : null}
        {progress ? (
          <View style={styles.heroProgress}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={percent(progress.currentPage, progress.pageCount)} />
            </View>
            <Text style={styles.heroCount}>
              {progress.currentPage}/{progress.pageCount}
            </Text>
          </View>
        ) : null}
        <Button label="Continuar" onPress={open} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

function GuideRow({ guide }: { guide: GuideSummary }) {
  const started = guide.readCount > 0;
  const value = percent(guide.readCount, guide.itemCount);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/guias/[slug]', params: { slug: guide.slug } })}
      style={({ pressed }) => [
        styles.guide,
        started && styles.guideStarted,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.guideTitle} numberOfLines={2}>
        {guide.title}
      </Text>
      {started ? (
        <>
          <View style={styles.guideMeta}>
            <Text style={styles.guideMetaText}>
              {guide.readCount} de {guide.itemCount} lidas
            </Text>
            <Text style={[styles.guideMetaText, { color: Colors.brandLight }]}>{value}%</Text>
          </View>
          <ProgressBar value={value} />
        </>
      ) : (
        <Text style={styles.guideMetaText}>{plural(guide.itemCount, 'HQ', 'HQs')}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  hero: {
    flexDirection: 'row',
    gap: 16,
    margin: Spacing.three,
    marginBottom: 0,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.35)',
    backgroundColor: '#13110a',
  },
  heroCover: {
    width: 110,
    height: 165,
    borderRadius: 8,
    boxShadow: `4px 4px 0 0 ${Colors.brand}`,
  },
  heroText: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  heroTitle: {
    color: Colors.ink100,
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  heroMeta: { color: Colors.ink300, fontSize: 13 },
  heroProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCount: { color: Colors.ink400, fontSize: 12, fontVariant: ['tabular-nums'] },
  section: { marginTop: Spacing.four },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionTitle: { color: Colors.ink100, fontSize: 18, fontWeight: '700' },
  sectionAction: { color: Colors.brandLight, fontSize: 14 },
  guides: { paddingHorizontal: Spacing.three, gap: 10 },
  guide: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  guideStarted: { borderColor: 'rgba(245, 179, 1, 0.35)' },
  guideTitle: { color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  guideMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  guideMetaText: { color: Colors.ink400, fontSize: 12 },
});

export { ErrorBoundary } from '@/components/RouteError';
