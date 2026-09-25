import { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { router } from 'expo-router';

import { partir } from '@/lib/format';
import { useCharacters } from '@/lib/queries';

/**
 * Texto em que nome de personagem vira link, como no site. Sem o índice de
 * personagens (offline, ou ainda carregando), o texto sai inteiro, sem link.
 */
export function CharacterText({
  texto,
  style,
  linkColor,
  exceto,
  numberOfLines,
}: {
  texto: string;
  style?: StyleProp<TextStyle>;
  linkColor: string;
  /** Slug a NÃO linkar: a página do próprio personagem não aponta para si. */
  exceto?: string;
  numberOfLines?: number;
}) {
  const { data: personagens } = useCharacters();
  const partes = useMemo(
    () => partir(texto, personagens ?? [], exceto),
    [texto, personagens, exceto],
  );

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {partes.map((parte, i) =>
        typeof parte === 'string' ? (
          parte
        ) : (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() =>
              router.push({ pathname: '/personagens/[slug]', params: { slug: parte.slug } })
            }
          >
            {parte.texto}
          </Text>
        ),
      )}
    </Text>
  );
}
