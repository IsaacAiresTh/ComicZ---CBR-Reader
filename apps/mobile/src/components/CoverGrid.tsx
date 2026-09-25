import { FlatList, useWindowDimensions, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { CoverCard, type ShelfItem } from './Shelf';

/** Grade de capas em 3 colunas — a lista de guias e a de eventos. */
export function CoverGrid({
  items,
  header,
  empty,
}: {
  items: ShelfItem[];
  header?: React.ReactElement;
  empty?: React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const columns = width > 600 ? 4 : 3;
  const cardWidth = (width - Spacing.three * 2 - Spacing.three * (columns - 1)) / columns;

  return (
    <FlatList
      data={items}
      key={columns}
      numColumns={columns}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.four }}
      columnWrapperStyle={{ gap: Spacing.three }}
      renderItem={({ item }) => (
        <View style={{ width: cardWidth }}>
          <CoverCard item={item} width={cardWidth} />
        </View>
      )}
    />
  );
}
