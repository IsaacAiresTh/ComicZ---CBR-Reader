import { useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { Image, type ImageStyle } from 'expo-image';

import { Colors, Spacing } from '@/constants/theme';
import { getMediaToken, subscribeMediaToken } from '@/lib/api';
import { absoluteUrl } from '@/lib/config';

/** Header de mídia atual; re-renderiza quando o token é renovado. */
export function useMediaHeaders(): Record<string, string> | undefined {
  const token = useSyncExternalStore(subscribeMediaToken, getMediaToken);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

/**
 * Imagem da API (capa, página). `localUri` vence quando existe — é a cópia
 * baixada, que abre sem rede e sem token.
 */
export function MediaImage({
  url,
  localUri,
  style,
  contentFit = 'cover',
  blurRadius,
}: {
  url: string | null | undefined;
  localUri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  /** Capa desfocada de fundo, como no topo das páginas de evento. */
  blurRadius?: number;
}) {
  const headers = useMediaHeaders();
  const source = localUri
    ? { uri: localUri }
    : url
      ? { uri: absoluteUrl(url), headers, cacheKey: url }
      : null;

  if (!source) return <View style={[styles.imagePlaceholder, style as StyleProp<ViewStyle>]} />;
  return (
    <Image
      source={source}
      style={[styles.imagePlaceholder, style]}
      contentFit={contentFit}
      blurRadius={blurRadius}
      cachePolicy="disk"
      transition={120}
    />
  );
}

export function Title({ style, ...rest }: TextProps) {
  return <Text style={[styles.title, style]} {...rest} />;
}

export function Body({ style, muted, ...rest }: TextProps & { muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, style]} {...rest} />;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: PressableProps & {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (pressed || off) && { opacity: 0.6 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.ink950 : Colors.ink100} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' ? { color: Colors.ink950 } : { color: Colors.ink100 },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.brand} size="large" />
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Title style={{ textAlign: 'center', fontSize: 20 }}>{title}</Title>
      {message ? (
        <Body muted style={{ textAlign: 'center', marginTop: Spacing.two }}>
          {message}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: Spacing.three }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  imagePlaceholder: {
    backgroundColor: Colors.ink800,
  },
  title: {
    color: Colors.ink100,
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    color: Colors.ink100,
    fontSize: 15,
    lineHeight: 21,
  },
  muted: {
    color: Colors.ink400,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: Colors.brand },
  buttonGhost: { backgroundColor: Colors.ink800, borderWidth: 1, borderColor: Colors.ink700 },
  buttonDanger: { backgroundColor: Colors.accent },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.ink850,
  },
  chipActive: { backgroundColor: Colors.brand },
  chipText: { color: Colors.ink300, fontSize: 14 },
  chipTextActive: { color: Colors.ink950, fontWeight: '700' },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.ink800,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionTitle: { color: Colors.ink100, fontSize: 18, fontWeight: '700' },
  sectionAction: { color: Colors.brandLight, fontSize: 14 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});

// ------------------------------------------------------------ peças menores

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const palette = {
    neutral: { bg: Colors.ink800, fg: Colors.ink300 },
    brand: { bg: 'rgba(245, 179, 1, 0.16)', fg: Colors.brandLight },
    success: { bg: 'rgba(52, 211, 153, 0.16)', fg: '#6ee7b7' },
    warning: { bg: 'rgba(251, 191, 36, 0.16)', fg: '#fcd34d' },
    danger: { bg: 'rgba(224, 49, 49, 0.18)', fg: '#ff8a8a' },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

/** Filtro em pílula: as abas "Tudo / Lendo / Lidas" da biblioteca, a ordem do catálogo. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = Colors.brand }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Título de seção com um "ver todos" opcional à direita. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable hitSlop={8} onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rótulo pequeno em caixa alta, como os "O QUE É" / "O MAPA" do site. */
export function Eyebrow({ children, color = Colors.ink400 }: { children: string; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children.toUpperCase()}</Text>;
}
