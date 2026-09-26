import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type ErrorBoundaryProps } from 'expo-router';

import { Colors, Spacing } from '@/constants/theme';
import { Button } from './ui';

/**
 * Rede de proteção de cada tela (o `ErrorBoundary` do Expo Router).
 *
 * Num build de produção, um erro de JavaScript não tratado fecha o app
 * inteiro. Com esta rede, a tela que quebrou mostra o erro e deixa voltar —
 * e a mensagem aparece para quem for relatar, em vez de um app que some.
 *
 * Cada rota reexporta: `export { ErrorBoundary } from '@/components/RouteError';`
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Algo deu errado nesta tela</Text>
      <Text style={styles.body}>
        O resto do app continua funcionando. Se isso se repetir, mande a mensagem abaixo para quem
        cuida do ComicZ.
      </Text>
      <ScrollView style={styles.box} contentContainerStyle={{ padding: Spacing.three }}>
        <Text selectable style={styles.message}>
          {error.name}: {error.message}
        </Text>
        {error.stack ? (
          <Text selectable style={styles.stack}>
            {error.stack.split('\n').slice(0, 8).join('\n')}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.buttons}>
        <Button label="Tentar de novo" onPress={() => void retry()} style={{ flex: 1 }} />
        <Button
          label="Voltar"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.ink900,
    padding: Spacing.four,
    paddingTop: Spacing.five * 2,
    gap: Spacing.three,
  },
  title: { color: Colors.ink100, fontSize: 22, fontWeight: '800' },
  body: { color: Colors.ink300, fontSize: 15, lineHeight: 22 },
  box: {
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  message: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  stack: { color: Colors.ink400, fontSize: 11, marginTop: Spacing.two, fontFamily: 'monospace' },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
