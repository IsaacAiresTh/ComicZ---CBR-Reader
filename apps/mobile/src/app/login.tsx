import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginSchema } from '@comicz/shared';

import { Body, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { OfflineError, offlineMessage } from '@/lib/api';

/** Mesmas credenciais do site. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? offlineMessage(err)
          : err instanceof Error
            ? err.message
            : 'Falha ao entrar',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Text style={styles.logo}>ComicZ</Text>
        <Body muted style={{ textAlign: 'center', marginBottom: Spacing.four }}>
          Entre com a mesma conta do site.
        </Body>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={Colors.ink500}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={Colors.ink500}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Entrar" loading={loading} onPress={() => void submit()} />
          <Button label="Criar conta" variant="ghost" onPress={() => router.push('/registrar')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  logo: {
    color: Colors.brand,
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  form: { gap: Spacing.three },
  input: {
    backgroundColor: Colors.ink800,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    color: Colors.ink100,
    fontSize: 16,
  },
  error: { color: Colors.accent, fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
