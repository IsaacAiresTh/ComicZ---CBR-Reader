import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { changePasswordSchema, type PublicUser } from '@comicz/shared';

import { Badge, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { formatBytes, useDownloads } from '@/lib/downloads';
import { useUserStats } from '@/lib/queries';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function since(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `no ComicZ desde ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

/**
 * O perfil em três blocos: quem você é (com os números da biblioteca), o que
 * é deste celular (conexão, baixadas, versão) e a conta. Editar nome e senha
 * abre no próprio lugar, em vez de formulários sempre abertos.
 */
export default function ProfileScreen() {
  const { user, online, signOut, updateUser, retryConnection } = useAuth();
  const stats = useUserStats();
  const { comics } = useDownloads();

  const [editing, setEditing] = useState<'username' | 'password' | null>(null);
  const [username, setUsername] = useState(user?.username ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [checking, setChecking] = useState(false);

  const downloaded = Object.values(comics);
  const bytes = downloaded.reduce((sum, comic) => sum + comic.sizeBytes, 0);
  const initials = (user?.username ?? '').slice(0, 2).toUpperCase();
  const version = Constants.expoConfig?.version;
  const memberSince = since(user?.createdAt);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const updated = await api<PublicUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username: username.trim() }),
      });
      await updateUser(updated);
      setEditing(null);
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
      // O servidor já encerrou todas as sessões: aqui é só esquecer a local.
      Alert.alert('Senha alterada', 'Entre novamente com a nova senha.', [
        { text: 'OK', onPress: () => void signOut({ local: true }) },
      ]);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Erro ao trocar a senha');
    } finally {
      setSavingPassword(false);
    }
  }

  function confirmSignOut(everywhere: boolean) {
    const kept = downloaded.length
      ? `As ${downloaded.length} HQs baixadas continuam neste celular.`
      : 'Você vai precisar entrar de novo para ler.';
    Alert.alert(
      everywhere ? 'Sair de todos os aparelhos?' : 'Sair deste celular?',
      everywhere ? `Encerra a sessão aqui, no site e em outros celulares. ${kept}` : kept,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void signOut({ everywhere }) },
      ],
    );
  }

  const statCards = stats.data
    ? [
        { label: 'guardadas', value: stats.data.inLibrary },
        { label: 'lendo', value: stats.data.reading },
        { label: 'lidas', value: stats.data.finished },
        {
          label: stats.data.favorites === 1 ? 'favorita' : 'favoritas',
          value: stats.data.favorites,
        },
      ]
    : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.username}
              </Text>
              {user?.role === 'ADMIN' ? <Badge label="admin" tone="brand" /> : null}
            </View>
            {memberSince ? <Text style={styles.since}>{memberSince}</Text> : null}
          </View>
        </View>
        {statCards.length ? (
          <View style={styles.stats}>
            {statCards.map((card) => (
              <Pressable
                key={card.label}
                style={styles.stat}
                onPress={() => router.navigate('/biblioteca')}
                accessibilityLabel={`${card.value} ${card.label}, abrir a biblioteca`}
              >
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>ESTE CELULAR</Text>
        <View style={styles.item}>
          <View style={[styles.dot, { backgroundColor: online ? Colors.success : '#fcd34d' }]} />
          <Text style={[styles.itemLabel, { flex: 1 }]}>
            {online ? 'Conectado · progresso em dia' : 'Sem conexão · o progresso sobe depois'}
          </Text>
          {!online ? (
            <Pressable
              hitSlop={10}
              disabled={checking}
              onPress={async () => {
                setChecking(true);
                const ok = await retryConnection().finally(() => setChecking(false));
                if (!ok) Alert.alert('Ainda sem conexão', 'Tente de novo em instantes.');
              }}
            >
              <Text style={styles.itemAction}>{checking ? 'tentando…' : 'tentar'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[styles.item, !version && styles.itemLast]}
          onPress={() => router.navigate('/baixadas')}
        >
          <Text style={[styles.itemLabel, { flex: 1 }]}>HQs baixadas</Text>
          <Text style={styles.itemValue}>
            {downloaded.length} · {formatBytes(bytes)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.ink500} />
        </Pressable>
        {version ? (
          <View style={[styles.item, styles.itemLast]}>
            <Text style={[styles.itemLabel, { flex: 1 }]}>Versão do app</Text>
            <Text style={styles.itemValue}>{version}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>CONTA</Text>
        {editing === 'username' ? (
          <View style={styles.edit}>
            <Text style={styles.label}>Nome de usuário</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={styles.input}
            />
            <View style={styles.editActions}>
              <Button
                label="Cancelar"
                variant="quiet"
                style={{ flex: 1 }}
                onPress={() => {
                  setUsername(user?.username ?? '');
                  setEditing(null);
                }}
              />
              <Button
                label="Salvar"
                style={{ flex: 1 }}
                loading={savingProfile}
                disabled={!username.trim() || username.trim() === user?.username}
                onPress={() => void saveProfile()}
              />
            </View>
          </View>
        ) : (
          <Pressable style={styles.item} onPress={() => setEditing('username')}>
            <Text style={[styles.itemLabel, { flex: 1 }]}>Nome de usuário</Text>
            <Text style={styles.itemValue}>{user?.username}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.ink500} />
          </Pressable>
        )}
        <View style={styles.item}>
          <Text style={[styles.itemLabel, { flex: 1 }]}>E-mail</Text>
          <Text style={styles.itemValue} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        {editing === 'password' ? (
          <View style={[styles.edit, styles.itemLast]}>
            <Text style={styles.hint}>
              Ao trocar a senha, todas as sessões abertas são encerradas — inclusive a do site.
            </Text>
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
              onChangeText={(value) =>
                setPasswords((current) => ({ ...current, newPassword: value }))
              }
              style={styles.input}
            />
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            <View style={styles.editActions}>
              <Button
                label="Cancelar"
                variant="quiet"
                style={{ flex: 1 }}
                onPress={() => {
                  setPasswords({ currentPassword: '', newPassword: '' });
                  setPasswordError(null);
                  setEditing(null);
                }}
              />
              <Button
                label="Trocar senha"
                style={{ flex: 1 }}
                loading={savingPassword}
                onPress={() => void savePassword()}
              />
            </View>
          </View>
        ) : (
          <Pressable style={[styles.item, styles.itemLast]} onPress={() => setEditing('password')}>
            <Text style={[styles.itemLabel, { flex: 1 }]}>Trocar a senha</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.ink500} />
          </Pressable>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button
          label="Sair só deste celular · as baixadas ficam"
          variant="secondary"
          onPress={() => confirmSignOut(false)}
        />
        <Button
          label="Sair de todos os aparelhos"
          variant="quiet"
          onPress={() => confirmSignOut(true)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.five },
  hero: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 179, 1, 0.35)',
    backgroundColor: '#13110a',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand,
    boxShadow: `3px 3px 0 0 ${Colors.ink950}`,
  },
  avatarText: { color: Colors.ink950, fontSize: 20, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { color: Colors.ink100, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  since: { color: Colors.ink400, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(7, 9, 13, 0.55)',
  },
  statValue: { color: Colors.ink100, fontSize: 20, fontWeight: '800' },
  statLabel: { color: Colors.ink400, fontSize: 11, marginTop: 2 },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
    overflow: 'hidden',
  },
  groupTitle: {
    color: Colors.ink400,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ink700,
  },
  itemLast: { borderBottomWidth: 0 },
  itemLabel: { color: Colors.ink100, fontSize: 15 },
  itemValue: { color: Colors.ink400, fontSize: 14, maxWidth: '55%' },
  itemAction: { color: Colors.brandLight, fontSize: 14, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  edit: {
    gap: 8,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ink700,
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  label: { color: Colors.ink300, fontSize: 13, fontWeight: '600' },
  hint: { color: Colors.ink400, fontSize: 13, lineHeight: 18 },
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
  error: { color: '#ff8a8a', fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
