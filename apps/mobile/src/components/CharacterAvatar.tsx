import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { MediaImage } from './ui';

/**
 * Rosto redondo de personagem, com a inicial quando não há retrato — mantém a
 * fila com a mesma altura mesmo para quem ainda não tem imagem.
 */
export function CharacterAvatar({
  name,
  imageUrl,
  subtitle,
  slug,
  accent,
  size = 76,
}: {
  name: string;
  imageUrl: string | null;
  subtitle?: string | null;
  slug?: string | null;
  accent?: string | null;
  size?: number;
}) {
  const content = (
    <>
      <View
        style={[
          styles.face,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: accent ?? Colors.ink700,
          },
        ]}
      >
        {imageUrl ? (
          <MediaImage url={imageUrl} style={{ width: size, height: size }} />
        ) : (
          <Text style={styles.initial}>{name.slice(0, 1)}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  if (!slug) return <View style={{ width: size + 8, alignItems: 'center' }}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [
        { width: size + 8, alignItems: 'center' },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => router.push({ pathname: '/personagens/[slug]', params: { slug } })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink850,
  },
  initial: { color: Colors.ink500, fontSize: 24, fontWeight: '700' },
  name: {
    color: Colors.ink100,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  subtitle: { color: Colors.ink500, fontSize: 11, textAlign: 'center' },
});
