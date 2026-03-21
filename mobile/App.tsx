import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator';
import { getStoredUser, AuthUser } from './src/services/auth';
import { startSession, endSession } from './src/services/api';
import { ThemeProvider, useAppTheme } from './src/contexts/ThemeContext';

function AppContent() {
  const [splash, setSplash]   = useState(true);
  const [user, setUser]       = useState<AuthUser | null>(null);
  const sessionId             = useRef<string | null>(null);
  const sessionStart          = useRef<number>(0);
  const { selectedTheme } = useAppTheme();

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
      <>
        <StatusBar style={selectedTheme.isLight ? 'dark' : 'light'} />
        <SplashScreen onFinish={() => setSplash(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={selectedTheme.isLight ? 'dark' : 'light'} />
      {user
        ? <TabNavigator user={user} onLogout={() => setUser(null)} />
        : <LoginScreen onLogin={u => setUser(u)} />
      }
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
