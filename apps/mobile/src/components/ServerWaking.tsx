import { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Colors, Spacing } from '@/constants/theme';
import { isServerSlow, subscribeServerSlow } from '@/lib/api';

const MESSAGE =
  'Acordando o servidor… Depois de um tempo parado, a primeira conexão leva até um minuto.';

export function useServerSlow(): boolean {
  return useSyncExternalStore(subscribeServerSlow, isServerSlow);
}

/**
 * Faixa no topo enquanto alguma requisição espera há mais de 5s. Sem ela, o
 * primeiro toque depois de o servidor dormir parece o app travado.
 */
export function ServerWakingBanner() {
  const slow = useServerSlow();
  if (!slow) return null;
  return (
    <SafeAreaView edges={['top']} style={styles.banner} pointerEvents="none">
      <View style={styles.bannerRow}>
        <ActivityIndicator size="small" color={Colors.ink950} />
        <Text style={styles.bannerText}>{MESSAGE}</Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Enquanto a sessão salva é retomada. A splash nativa sai depois de uns
 * segundos e esta tela assume — com o servidor dormindo, a retomada pode levar
 * meio minuto, e uma splash parada esse tempo todo parece app travado.
 */
export function StartupScreen() {
  const slow = useServerSlow();
  return (
    <View style={styles.startup}>
      <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} />
      <ActivityIndicator color={Colors.brand} />
      {slow ? <Text style={styles.startupText}>{MESSAGE}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: Colors.brand },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bannerText: { flex: 1, color: Colors.ink950, fontSize: 13, fontWeight: '600' },
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.five,
    backgroundColor: Colors.ink900,
  },
  logo: { width: 120, height: 120 },
  startupText: { color: Colors.ink300, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
