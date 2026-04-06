import { Platform, UIManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700', color: theme.text },
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
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
  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}