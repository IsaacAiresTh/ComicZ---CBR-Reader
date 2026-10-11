import { Pressable, Text } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Logo } from '@/components/Logo';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** O perfil não é aba: fica no canto do cabeçalho, como o menu do site. */
function ProfileButton() {
  const { user } = useAuth();
  const initials = (user?.username ?? '').slice(0, 2).toUpperCase();
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Meu perfil"
      onPress={() => router.push('/perfil')}
      style={{
        marginRight: 16,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.ink700,
      }}
    >
      {initials ? (
        <Text style={{ color: Colors.ink100, fontSize: 13, fontWeight: '800' }}>{initials}</Text>
      ) : (
        <Ionicons name="person-outline" size={18} color={Colors.ink100} />
      )}
    </Pressable>
  );
}

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Início', icon: 'home-outline' },
  { name: 'catalogo', title: 'Catálogo', icon: 'grid-outline' },
  { name: 'biblioteca', title: 'Biblioteca', icon: 'library-outline' },
  { name: 'explorar', title: 'Explorar', icon: 'compass-outline' },
  { name: 'baixadas', title: 'Baixadas', icon: 'cloud-download-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.ink400,
        tabBarStyle: { backgroundColor: Colors.ink850, borderTopColor: Colors.ink700 },
        headerStyle: { backgroundColor: Colors.ink850 },
        headerTintColor: Colors.ink100,
        headerRight: ProfileButton,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerTitle: tab.name === 'index' ? () => <Logo size="sm" /> : tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

export { ErrorBoundary } from '@/components/RouteError';
