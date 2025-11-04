import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/register" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
