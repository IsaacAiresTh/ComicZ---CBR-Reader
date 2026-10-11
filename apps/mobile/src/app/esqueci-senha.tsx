import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { forgotPasswordSchema } from '@comicz/shared';

import { Body, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { forgotPassword, OfflineError, offlineMessage } from '@/lib/api';

/** O servidor aceita um link por minuto por conta: o botão espera o mesmo. */
const RESEND_SECONDS = 60;

/**
 * "Esqueci a senha". O e-mail digitado no login já vem preenchido. O link
 * abre a página de nova senha do site; depois é só voltar e entrar.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit() {
    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira o e-mail');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(parsed.data.email);
      setSentTo(parsed.data.email);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? offlineMessage(err)
          : err instanceof Error
            ? err.message
            : 'Não deu para enviar agora',
      );
    } finally {
      setLoading(false);
    }
  }

  const minutes = Math.floor(wait / 60);
  const seconds = String(wait % 60).padStart(2, '0');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Esqueceu a senha?</Text>
          <Body muted>Mandamos um link para você criar uma nova.</Body>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>E-mail da sua conta</Text>
          <TextInput
            style={styles.input}
            placeholder="voce@email.com"
            placeholderTextColor={Colors.ink500}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={
            sentTo
              ? wait > 0
                ? `Reenviar em ${minutes}:${seconds}`
                : 'Reenviar o link'
              : 'Enviar o link'
          }
          variant={sentTo ? 'secondary' : 'primary'}
          loading={loading}
          disabled={wait > 0}
          onPress={() => void submit()}
        />

        {sentTo ? (
          <View style={styles.sent}>
            <Text style={styles.sentTitle}>Confira o seu e-mail</Text>
            <Text style={styles.sentText}>
              Se existir uma conta com <Text style={styles.strong}>{sentTo}</Text>, o link chega em
              instantes. Ele vale por <Text style={styles.strong}>1 hora</Text> e funciona uma vez
              só.
            </Text>
            <Text style={styles.sentText}>
              O link abre no navegador. Depois de criar a senha nova, volte aqui e entre com ela.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  content: { padding: Spacing.three, gap: Spacing.three },
  title: { color: Colors.ink100, fontSize: 24, fontWeight: '800' },
  label: { color: Colors.ink300, fontSize: 13, fontWeight: '600' },
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
  error: { color: '#ff8a8a', fontSize: 14 },
  sent: {
    gap: 8,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 168, 0.35)',
    backgroundColor: 'rgba(110, 231, 168, 0.06)',
  },
  sentTitle: { color: Colors.success, fontSize: 15, fontWeight: '800' },
  sentText: { color: Colors.ink200, fontSize: 14, lineHeight: 20 },
  strong: { color: Colors.ink100, fontWeight: '700' },
});

export { ErrorBoundary } from '@/components/RouteError';
