import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** O perfil não é aba: fica no canto do cabeçalho, como o menu do site. */
function ProfileButton() {
  return (
    <Pressable
      hitSlop={10}
      accessibilityLabel="Meu perfil"
      onPress={() => router.push('/perfil')}
      style={{ marginRight: 16 }}
    >
      <Ionicons name="person-circle-outline" size={28} color={Colors.ink100} />
    </Pressable>
  );
}

const TABS: { name: string; title: string; icon: IconName; header?: string }[] = [
  { name: 'index', title: 'Início', icon: 'home-outline', header: 'ComicZ' },
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
            headerTitle: tab.header ?? tab.title,
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
