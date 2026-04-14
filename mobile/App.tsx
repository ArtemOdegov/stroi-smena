import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/context/SessionContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { DayEntryScreen } from './src/screens/DayEntryScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatThreadScreen } from './src/screens/ChatThreadScreen';
import { ColleaguesScreen } from './src/screens/ColleaguesScreen';
import { flushPendingQueue } from './src/sync/offlineQueue';
import type { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

function NavigationRoot() {
  const { tokens } = useSession();

  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      if (s.isConnected) {
        void flushPendingQueue();
      }
    });
  }, []);

  return (
    <NavigationContainer
      key={tokens ? 'session' : 'guest'}
      theme={navTheme}
    >
      <Stack.Navigator
        initialRouteName={tokens ? 'Home' : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Компании', headerBackVisible: false }}
        />
        <Stack.Screen
          name="Calendar"
          component={CalendarScreen}
          options={({ route }) => ({ title: route.params.companyName })}
        />
        <Stack.Screen
          name="DayEntry"
          component={DayEntryScreen}
          options={{ title: 'День' }}
        />
        <Stack.Screen
          name="ChatList"
          component={ChatListScreen}
          options={{ title: 'Чаты' }}
        />
        <Stack.Screen
          name="ChatThread"
          component={ChatThreadScreen}
          options={({ route }) => ({ title: route.params.title })}
        />
        <Stack.Screen
          name="Colleagues"
          component={ColleaguesScreen}
          options={{ title: 'Коллеги' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_800ExtraBold,
    Manrope_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <NavigationRoot />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
