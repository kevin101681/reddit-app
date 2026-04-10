import React, { useEffect } from 'react';
import { Platform, UIManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { setAudioModeAsync } from 'expo-audio';
import { ThemeProvider, useTheme } from '../utils/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function RootStack() {
  const { theme, themeName } = useTheme();
  return (
    <>
      <StatusBar
        style={themeName === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme.background}
      />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerShadowVisible: false,
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700', color: theme.text },
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="menu"
          options={{
            presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="feed"
          options={{ headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="post/[id]"
          options={{ title: 'Post', headerBackTitle: 'Back' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Allow video audio through the iOS silent switch; don't hog audio in background.
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}