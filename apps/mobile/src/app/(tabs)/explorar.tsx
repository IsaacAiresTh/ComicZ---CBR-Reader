import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { CharacterAvatar } from '@/components/CharacterAvatar';
import { QueryError } from '@/components/QueryError';
import { Shelf, type ShelfItem } from '@/components/Shelf';
import { Loading, SectionHeader } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { plural } from '@/lib/format';
import { useCharacters, useGuides } from '@/lib/queries';

/**
 * No site, Guias, Eventos e Personagens são três itens do menu. No celular não
 * cabem três abas a mais, então viram prateleiras de uma aba só, cada uma com
 * o seu "ver todos".
 */
export default function ExploreScreen() {
  const guides = useGuides();
  const characters = useCharacters();

  if (guides.isPending && characters.isPending) return <Loading />;
  if (guides.isError && characters.isError) {
    return <QueryError error={guides.error} onRetry={() => void guides.refetch()} />;
  }

  const all = guides.data ?? [];
  const toItem =
    (pathname: '/guias/[slug]' | '/eventos/[slug]', label: [string, string]) =>
    (guide: (typeof all)[number]): ShelfItem => ({
      key: guide.id,
      title: guide.title,
      subtitle: plural(guide.itemCount, ...label),
      coverUrl: guide.coverUrl,
      onPress: () => router.push({ pathname, params: { slug: guide.slug } }),
    });

  const guideItems = all
    .filter((guide) => guide.kind !== 'EVENT')
    .map(toItem('/guias/[slug]', ['HQ', 'HQs']));
  const eventItems = all
    .filter((guide) => guide.kind === 'EVENT')
    .map(toItem('/eventos/[slug]', ['edição', 'edições']));
  // Os mais presentes no acervo primeiro: é por onde alguém novo começa.
  const topCharacters = [...(characters.data ?? [])]
    .sort((a, b) => b.comicCount - a.comicCount)
    .slice(0, 15);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: Spacing.five }}
      refreshControl={
        <RefreshControl
          refreshing={guides.isRefetching || characters.isRefetching}
          onRefresh={() => {
            void guides.refetch();
            void characters.refetch();
          }}
          tintColor={Colors.brand}
        />
      }
    >
      <View style={styles.links}>
        <HubLink icon="map-outline" label="Guias" onPress={() => router.push('/guias')} />
        <HubLink icon="flash-outline" label="Eventos" onPress={() => router.push('/eventos')} />
        <HubLink
          icon="people-outline"
          label="Personagens"
          onPress={() => router.push('/personagens')}
        />
      </View>

      <Shelf
        title="Guias de leitura"
        items={guideItems}
        actionLabel="ver todos"
        onAction={() => router.push('/guias')}
      />
      <Shelf
        title="Grandes sagas"
        items={eventItems}
        actionLabel="ver todos"
        onAction={() => router.push('/eventos')}
      />

      {topCharacters.length > 0 ? (
        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader
            title="Personagens"
            actionLabel="ver todos"
            onAction={() => router.push('/personagens')}
          />
          <FlatList
            horizontal
            data={topCharacters}
            keyExtractor={(character) => character.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}
            renderItem={({ item }) => (
              <CharacterAvatar
                name={item.name}
                imageUrl={item.portraitUrl}
                subtitle={plural(item.comicCount, 'edição', 'edições')}
                slug={item.slug}
                accent={item.accentColor}
              />
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function HubLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.hub, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={24} color={Colors.brand} />
      <Text style={styles.hubLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  links: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  hub: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    backgroundColor: Colors.ink850,
  },
  hubLabel: { color: Colors.ink100, fontSize: 13, fontWeight: '600' },
});
