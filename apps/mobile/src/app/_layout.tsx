import { useEffect, useState } from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Bangers_400Regular, useFonts } from '@expo-google-fonts/bangers';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Colors } from '@/constants/theme';
import { ServerWakingBanner, StartupScreen } from '@/components/ServerWaking';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';

void SplashScreen.preventAutoHideAsync();

/** Quanto a splash nativa espera a sessão antes de dar lugar à tela de abertura. */
const SPLASH_MAX_MS = 2_500;

const queryClient = new QueryClient({
  defaultOptions: {
    // Sem rede, uma tentativa extra só atrasa a tela de "sem conexão".
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.brand,
    background: Colors.ink900,
    card: Colors.ink850,
    border: Colors.ink700,
    text: Colors.ink100,
  },
};

function RootStack() {
  const { status } = useAuth();
  // A fonte vem embutida no app; se falhar ao carregar, o título cai na do sistema.
  const [fontsLoaded, fontError] = useFonts({ Bangers_400Regular });
  const fontsReady = fontsLoaded || !!fontError;
  // A splash nativa segura no máximo este tempo; depois entra a tela de abertura.
  const [splashExpired, setSplashExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSplashExpired(true), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  const showApp = fontsReady && (status !== 'loading' || splashExpired);
  useEffect(() => {
    if (showApp) void SplashScreen.hideAsync();
  }, [showApp]);

  if (!showApp) return null;
  // Retomar a sessão com o servidor dormindo leva meio minuto: melhor dizer isso.
  if (status === 'loading') return <StartupScreen />;
  const signedIn = status === 'signed-in';

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: Colors.ink100,
          headerStyle: { backgroundColor: Colors.ink850 },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="registrar" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="saga/[id]" options={{ title: '' }} />
          <Stack.Screen name="hq/[id]" options={{ title: '' }} />
          <Stack.Screen name="pasta/[id]" options={{ title: '' }} />
          <Stack.Screen name="guias/index" options={{ title: 'Guias de leitura' }} />
          <Stack.Screen name="guias/[slug]" options={{ title: '' }} />
          <Stack.Screen name="eventos/index" options={{ title: 'Grandes sagas' }} />
          <Stack.Screen name="eventos/[slug]/index" options={{ title: 'Grandes sagas' }} />
          <Stack.Screen name="eventos/[slug]/[bloco]" options={{ title: '' }} />
          <Stack.Screen name="personagens/index" options={{ title: 'Personagens' }} />
          <Stack.Screen name="personagens/[slug]" options={{ title: '' }} />
          <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
          <Stack.Screen name="ler/[id]" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {/* Depois da abertura: o aviso de servidor acordando vira faixa no topo. */}
      <ServerWakingBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    // O zoom do leitor usa gestos nativos, que precisam desta raiz.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <RootStack />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
