/* ===================================================================
   Nexus AI OS — Mobile App Root
   NavigationContainer + Bottom Tab Navigator (5 tabs)
   =================================================================== */

import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import DashboardScreen from './src/screens/DashboardScreen';
import ChatScreen from './src/screens/ChatScreen';
import HomeScreen from './src/screens/HomeScreen';
import HealthScreen from './src/screens/HealthScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/lib/theme';
import { useStore } from './src/lib/store';

/* ------------------------------------------------------------------ */
/*  Dark theme matching Nexus desktop                                  */
/* ------------------------------------------------------------------ */
const NexusDarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.error,
  },
};

/* ------------------------------------------------------------------ */
/*  Tab navigator definition                                           */
/* ------------------------------------------------------------------ */
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: string; unfocused: string }> = {
  Dashboard: { focused: 'grid', unfocused: 'grid-outline' },
  Chat: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  Home: { focused: 'home', unfocused: 'home-outline' },
  Health: { focused: 'heart', unfocused: 'heart-outline' },
  Settings: { focused: 'settings', unfocused: 'settings-outline' },
};

/* ------------------------------------------------------------------ */
/*  App component                                                      */
/* ------------------------------------------------------------------ */
const App: React.FC = () => {
  const loadPersistedState = useStore((s) => s.loadPersistedState);

  useEffect(() => {
    loadPersistedState();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background}
        translucent={Platform.OS === 'android'}
      />
      <NavigationContainer theme={NexusDarkTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              const icons = TAB_ICONS[route.name];
              const iconName = focused ? icons.focused : icons.unfocused;
              return <Icon name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: Platform.OS === 'ios' ? 88 : 64,
              paddingBottom: Platform.OS === 'ios' ? 28 : 8,
              paddingTop: 8,
              elevation: 20,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Chat" component={ChatScreen} />
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Health" component={HealthScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
