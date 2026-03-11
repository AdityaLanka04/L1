import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator';
import { getStoredUser, AuthUser } from './src/services/auth';
import { startSession, endSession } from './src/services/api';

export default function App() {
  const [splash, setSplash]   = useState(true);
  const [user, setUser]       = useState<AuthUser | null>(null);
  const sessionId             = useRef<string | null>(null);
  const sessionStart          = useRef<number>(0);

  useEffect(() => {
    getStoredUser().then(u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    // Start session timer
    sessionStart.current = Date.now();
    startSession(user.username, 'mobile_app').then(data => {
      sessionId.current = data.session_id;
    }).catch(() => {});

    return () => {
      // End session when user navigates away / app closes
      if (!sessionId.current) return;
      const mins = (Date.now() - sessionStart.current) / 60000;
      endSession(user.username, sessionId.current, parseFloat(mins.toFixed(2)), 'mobile_app').catch(() => {});
    };
  }, [user]);

  if (splash) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SplashScreen onFinish={() => setSplash(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {user
        ? <TabNavigator user={user} onLogout={() => setUser(null)} />
        : <LoginScreen onLogin={u => setUser(u)} />
      }
    </SafeAreaProvider>
  );
}
