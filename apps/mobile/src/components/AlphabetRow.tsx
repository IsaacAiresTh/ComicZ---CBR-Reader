import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ALPHABET } from '@comicz/shared';

import { Colors, Spacing } from '@/constants/theme';

/** Teclas por linha: 26 letras em duas linhas cabem na largura de um celular. */
const PER_ROW = 14;
const GAP = 4;

/**
 * A fila do alfabeto, usada pelo catálogo e pelos personagens — mesmas regras
 * da FilaDoAlfabeto do site:
 *
 * - De A a Z a fila é sempre inteira, com as letras vazias apagadas em vez de
 *   ocultas: é uma régua, e régua com buraco obriga a procurar onde estava o L.
 * - O "#" só aparece quando alguém cai nele.
 * - Tocar na letra já escolhida desfaz; "limpar" também.
 *
 * A contagem vem de fora: o catálogo recebe pronta da API (já considerando
 * busca e editora); os personagens contam no aparelho, com a lista inteira.
 */
export function AlphabetRow({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (letter: string | null) => void;
}) {
  const { width } = useWindowDimensions();
  const keys = ALPHABET.filter((letter) => letter !== '#' || (counts['#'] ?? 0) > 0);
  const size = Math.floor((width - Spacing.three * 2 - GAP * (PER_ROW - 1)) / PER_ROW);

  return (
    <View style={styles.wrap}>
      <View style={styles.keys}>
        {keys.map((letter) => {
          const count = counts[letter] ?? 0;
          const active = selected === letter;
          return (
            <Pressable
              key={letter}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: count === 0 }}
              accessibilityLabel={`${letter}: ${count === 1 ? '1 título' : `${count} títulos`}`}
              onPress={() => onSelect(active ? null : letter)}
              style={[styles.key, { width: size, height: size + 4 }, active && styles.keyActive]}
            >
              <Text
                style={[
                  styles.label,
                  count === 0 && styles.labelEmpty,
                  active && styles.labelActive,
                ]}
              >
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <Pressable hitSlop={8} onPress={() => onSelect(null)} style={styles.clear}>
          <Text style={styles.clearLabel}>limpar letra {selected}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  key: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  keyActive: { backgroundColor: Colors.brand },
  label: { color: Colors.ink300, fontSize: 13, fontWeight: '700' },
  labelEmpty: { color: Colors.ink700 },
  labelActive: { color: Colors.ink950 },
  clear: { alignSelf: 'flex-start' },
  clearLabel: { color: Colors.ink400, fontSize: 12 },
});
