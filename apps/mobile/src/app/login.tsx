import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginSchema } from '@comicz/shared';

import { Logo } from '@/components/Logo';
import { Body, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { OfflineError, offlineMessage } from '@/lib/api';
import { useDownloads } from '@/lib/downloads';

/** Mesmas credenciais do site. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sair da conta não apaga os downloads: eles continuam legíveis daqui.
  const downloaded = Object.keys(useDownloads().comics).length;

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
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Logo size="lg" />
            <Text style={styles.welcome}>Bem-vindo de volta</Text>
            <Body muted style={{ textAlign: 'center' }}>
              Entre com a mesma conta do site.
            </Body>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="voce@email.com"
                placeholderTextColor={Colors.ink500}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Senha</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    router.push({ pathname: '/esqueci-senha', params: { email: email.trim() } })
                  }
                >
                  <Text style={styles.link}>Esqueci a senha</Text>
                </Pressable>
              </View>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, minWidth: 0, borderWidth: 0 }]}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.ink500}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
                  style={styles.reveal}
                >
                  <Text style={styles.revealText}>{showPassword ? 'esconder' : 'mostrar'}</Text>
                </Pressable>
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Entrar" loading={loading} onPress={() => void submit()} />
            {downloaded > 0 ? (
              <Button
                label={`Ler HQs baixadas (${downloaded})`}
                variant="secondary"
                onPress={() => router.push('/offline')}
              />
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não tem conta? </Text>
            <Pressable hitSlop={10} onPress={() => router.push('/registrar')}>
              <Text style={styles.link}>Criar conta</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four },
  head: { alignItems: 'center', gap: Spacing.two },
  welcome: { color: Colors.ink100, fontSize: 22, fontWeight: '800', marginTop: Spacing.three },
  form: { gap: Spacing.three },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: Colors.ink300, fontSize: 13, fontWeight: '600' },
  link: { color: Colors.brandLight, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: Colors.ink850,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
    color: Colors.ink100,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ink700,
    borderRadius: 10,
    backgroundColor: Colors.ink850,
  },
  reveal: { paddingHorizontal: 14, paddingVertical: 12 },
  revealText: { color: Colors.ink300, fontSize: 13, fontWeight: '600' },
  error: { color: '#ff8a8a', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: Colors.ink400, fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
