import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/**
 * A marca do site (apps/web/src/components/Logo.tsx): o rótulo amarelo
 * "Comic" com a sombra deslocada dos botões, e o Z ao lado.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = { sm: 0.82, md: 1, lg: 1.5 }[size];
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="ComicZ" style={styles.row}>
      <Text
        style={[
          styles.label,
          { fontSize: 22 * scale, paddingHorizontal: 7 * scale, paddingTop: 3 * scale },
        ]}
      >
        Comic
      </Text>
      <Text style={[styles.z, { fontSize: 26 * scale }]}>Z</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: Fonts.display,
    color: Colors.ink950,
    backgroundColor: Colors.brand,
    borderRadius: 6,
    overflow: 'hidden',
    letterSpacing: 0.6,
    boxShadow: `2px 2px 0 0 ${Colors.ink950}, 2px 2px 0 1px ${Colors.brandDark}`,
  },
  z: {
    fontFamily: Fonts.display,
    color: Colors.ink100,
    letterSpacing: 0.6,
    textShadowColor: Colors.brandDark,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0.1,
  },
});
