import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { changePasswordSchema, type PublicUser } from '@comicz/shared';

import { Badge, Body, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { formatBytes, useDownloads } from '@/lib/downloads';
import { useUserStats } from '@/lib/queries';

/** O perfil do site, mais o que só existe no app: conexão e armazenamento. */
export default function ProfileScreen() {
  const { user, online, signOut, updateUser, retryConnection } = useAuth();
  const stats = useUserStats();
  const { comics } = useDownloads();

  const [username, setUsername] = useState(user?.username ?? '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [checking, setChecking] = useState(false);

  const downloaded = Object.values(comics);
  const bytes = downloaded.reduce((sum, comic) => sum + comic.sizeBytes, 0);

  async function saveProfile() {
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const updated = await api<PublicUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username: username.trim() }),
      });
      await updateUser(updated);
      setProfileMessage('Perfil atualizado.');
    } catch (error) {
      Alert.alert('Erro ao salvar', error instanceof Error ? error.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    setPasswordError(null);
    const parsed = changePasswordSchema.safeParse(passwords);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }
    setSavingPassword(true);
    try {
      await api('/users/me/password', { method: 'PATCH', body: JSON.stringify(parsed.data) });
      // O servidor encerra todas as sessões. É a mesma pessoa: os downloads ficam.
      Alert.alert('Senha alterada', 'Entre novamente com a nova senha.', [
        { text: 'OK', onPress: () => void signOut({ keepDownloads: true }) },
      ]);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Erro ao trocar a senha');
    } finally {
      setSavingPassword(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Sair da conta?',
      downloaded.length
        ? `As ${downloaded.length} HQs baixadas (${formatBytes(bytes)}) serão removidas deste aparelho.`
        : 'Você precisará entrar de novo para ler.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>{user?.username}</Text>
        <View style={styles.row}>
          <Body muted>{user?.email}</Body>
          {user?.role === 'ADMIN' ? <Badge label="admin" tone="brand" /> : null}
        </View>
      </View>

      {stats.data ? (
        <View style={styles.stats}>
          {[
            { label: 'Na biblioteca', value: stats.data.inLibrary },
            { label: 'Lendo', value: stats.data.reading },
            { label: 'Concluídas', value: stats.data.finished },
            { label: 'Favoritas', value: stats.data.favorites },
          ].map((card) => (
            <View key={card.label} style={styles.stat}>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{online ? 'Conectado' : 'Modo offline'}</Text>
        <Body muted style={styles.small}>
          {online
            ? 'Seu progresso é sincronizado com o site.'
            : 'O progresso lido agora será enviado quando a conexão voltar.'}
        </Body>
        <Body muted style={styles.small}>
          {downloaded.length} {downloaded.length === 1 ? 'HQ baixada' : 'HQs baixadas'} ·{' '}
          {formatBytes(bytes)}
        </Body>
        {!online ? (
          <Button
            label="Tentar reconectar"
            variant="ghost"
            loading={checking}
            onPress={async () => {
              setChecking(true);
              const ok = await retryConnection().finally(() => setChecking(false));
              if (!ok) Alert.alert('Ainda sem conexão', 'Tente de novo em instantes.');
            }}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dados da conta</Text>
        <Text style={styles.label}>Usuário</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {profileMessage ? <Text style={styles.success}>{profileMessage}</Text> : null}
        <Button
          label="Salvar"
          variant="ghost"
          loading={savingProfile}
          disabled={!username.trim() || username.trim() === user?.username}
          onPress={() => void saveProfile()}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trocar senha</Text>
        <Body muted style={styles.small}>
          Ao trocar a senha, todas as sessões abertas são encerradas — inclusive a do site.
        </Body>
        <Text style={styles.label}>Senha atual</Text>
        <TextInput
          secureTextEntry
          autoComplete="current-password"
          value={passwords.currentPassword}
          onChangeText={(value) =>
            setPasswords((current) => ({ ...current, currentPassword: value }))
          }
          style={styles.input}
        />
        <Text style={styles.label}>Nova senha (mínimo de 8 caracteres)</Text>
        <TextInput
          secureTextEntry
          autoComplete="new-password"
          value={passwords.newPassword}
          onChangeText={(value) => setPasswords((current) => ({ ...current, newPassword: value }))}
          style={styles.input}
        />
        {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
        <Button
          label="Trocar senha"
          variant="ghost"
          loading={savingPassword}
          onPress={() => void savePassword()}
        />
      </View>

      <Button label="Sair" variant="danger" onPress={confirmSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  title: { color: Colors.ink100, fontSize: 26, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    backgroundColor: Colors.ink850,
  },
  statValue: { color: Colors.ink100, fontSize: 20, fontWeight: '800' },
  statLabel: { color: Colors.ink400, fontSize: 12 },
  card: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink800,
    backgroundColor: Colors.ink850,
    gap: Spacing.two,
  },
  cardTitle: { color: Colors.ink100, fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13 },
  label: { color: Colors.ink400, fontSize: 13, marginTop: 4 },
  input: {
    backgroundColor: Colors.ink800,
    borderColor: Colors.ink700,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    color: Colors.ink100,
    fontSize: 15,
  },
  success: { color: '#6ee7b7', fontSize: 14 },
  error: { color: Colors.accent, fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
