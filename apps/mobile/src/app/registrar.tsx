import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerSchema } from '@comicz/shared';

import { Body, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { OfflineError, offlineMessage } from '@/lib/api';

/** Mesmo cadastro do site: a conta criada aqui entra no site também. */
export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  async function submit() {
    const parsed = registerSchema.safeParse({
      ...form,
      email: form.email.trim(),
      username: form.username.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(parsed.data);
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? offlineMessage(err)
          : err instanceof Error
            ? err.message
            : 'Falha ao criar a conta',
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
          <Text style={styles.logo}>ComicZ</Text>
          <Body muted style={{ textAlign: 'center', marginBottom: Spacing.four }}>
            Crie sua conta. Ela vale no site e no app.
          </Body>
          <TextInput
            style={styles.input}
            placeholder="Usuário"
            placeholderTextColor={Colors.ink500}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            value={form.username}
            onChangeText={set('username')}
          />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={Colors.ink500}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={form.email}
            onChangeText={set('email')}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha (mínimo de 8 caracteres)"
            placeholderTextColor={Colors.ink500}
            secureTextEntry
            autoComplete="new-password"
            value={form.password}
            onChangeText={set('password')}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Criar conta" loading={loading} onPress={() => void submit()} />
          <Button label="Já tenho conta" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  logo: { color: Colors.brand, fontSize: 44, fontWeight: '900', textAlign: 'center' },
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
