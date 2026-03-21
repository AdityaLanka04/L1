import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_900Black, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

import { signIn, signInWithGoogle, AuthUser } from '../services/auth';
import { register } from '../services/api';
import HapticTouchable from '../components/HapticTouchable';
import AmbientBubbles from '../components/AmbientBubbles';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor, rgbaFromHex } from '../utils/theme';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '482205787855-emlbsvd954ga26c2i1gmegm80lq40qek.apps.googleusercontent.com';
const redirectUri = makeRedirectUri({ scheme: 'cerbyl' });

type Props = { onLogin: (user: AuthUser) => void };

export default function LoginScreen({ onLogin }: Props) {
  const { selectedTheme } = useAppTheme();
  const s = useMemo(() => createStyles(selectedTheme), [selectedTheme]);
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular, Inter_600SemiBold });
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // register fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName]   = useState('');
  const [regEmail, setRegEmail]         = useState('');
  const [regUsername, setRegUsername]   = useState('');
  const [regPassword, setRegPassword]   = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:        CLIENT_ID,
    androidClientId: CLIENT_ID,
    iosClientId:     CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken;
      if (!idToken) { setError('google sign-in failed'); return; }
      setLoading(true);
      setError('');
      signInWithGoogle(idToken)
        .then(user => onLogin(user))
        .catch(() => setError('google sign-in failed'))
        .finally(() => setLoading(false));
    }
  }, [response]);

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('enter username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await signIn(username.trim(), password);
      onLogin(user);
    } catch {
      setError('invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regFirstName.trim() || !regLastName.trim() || !regEmail.trim() || !regUsername.trim() || !regPassword.trim()) {
      setError('all fields are required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await register({
        first_name: regFirstName.trim(),
        last_name:  regLastName.trim(),
        email:      regEmail.trim(),
        username:   regUsername.trim(),
        password:   regPassword,
      });
      setSuccess('account created! sign in below');
      setUsername(regUsername.trim());
      setPassword(regPassword);
      setMode('login');
    } catch (e: any) {
      setError(e.message || 'registration failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <AmbientBubbles theme={selectedTheme} variant="auth" opacity={1} />
      <View style={s.glowA} />
      <View style={s.glowB} />
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.top}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>AI study operating system</Text>
            </View>
            <Text style={s.brand}>cerbyl</Text>
            <Text style={s.sub}>A cleaner, calmer way to learn with chat, notes, flashcards, and guided study flows.</Text>
          </View>

          <View style={s.panel}>
            <View style={s.tabs}>
              <HapticTouchable style={[s.tab, mode === 'login' && s.tabActive]} onPress={() => switchMode('login')} haptic="selection">
                <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>sign in</Text>
              </HapticTouchable>
              <HapticTouchable style={[s.tab, mode === 'register' && s.tabActive]} onPress={() => switchMode('register')} haptic="selection">
                <Text style={[s.tabText, mode === 'register' && s.tabTextActive]}>create account</Text>
              </HapticTouchable>
            </View>

            {success ? <Text style={s.success}>{success}</Text> : null}
            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.form}>
              {mode === 'login' ? (
                <>
                  <Text style={s.label}>username or email</Text>
                  <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="enter username" placeholderTextColor={selectedTheme.textSecondary} autoCapitalize="none" autoCorrect={false} />

                  <Text style={[s.label, s.spacedLabel]}>password</Text>
                  <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="enter password" placeholderTextColor={selectedTheme.textSecondary} secureTextEntry />

                  <HapticTouchable style={s.btnWrap} onPress={handleLogin} activeOpacity={0.88} disabled={loading} haptic="medium">
                    <LinearGradient colors={[selectedTheme.accentHover, selectedTheme.accent]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={s.btn}>
                      {loading ? <ActivityIndicator color={selectedTheme.bgPrimary} /> : <Text style={s.btnText}>sign in</Text>}
                    </LinearGradient>
                  </HapticTouchable>

                  <View style={s.dividerRow}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerText}>or continue</Text>
                    <View style={s.dividerLine} />
                  </View>

                  <HapticTouchable style={s.googleBtn} onPress={() => { setError(''); promptAsync(); }} activeOpacity={0.88} disabled={loading || !request} haptic="medium">
                    <Text style={s.googleIcon}>G</Text>
                    <Text style={s.googleText}>continue with google</Text>
                  </HapticTouchable>
                </>
              ) : (
                <>
                  <View style={s.row}>
                    <View style={s.half}>
                      <Text style={s.label}>first name</Text>
                      <TextInput style={s.input} value={regFirstName} onChangeText={setRegFirstName} placeholder="first" placeholderTextColor={selectedTheme.textSecondary} autoCapitalize="words" />
                    </View>
                    <View style={s.half}>
                      <Text style={s.label}>last name</Text>
                      <TextInput style={s.input} value={regLastName} onChangeText={setRegLastName} placeholder="last" placeholderTextColor={selectedTheme.textSecondary} autoCapitalize="words" />
                    </View>
                  </View>

                  <Text style={[s.label, s.spacedLabel]}>email</Text>
                  <TextInput style={s.input} value={regEmail} onChangeText={setRegEmail} placeholder="you@example.com" placeholderTextColor={selectedTheme.textSecondary} autoCapitalize="none" keyboardType="email-address" />

                  <Text style={[s.label, s.spacedLabel]}>username</Text>
                  <TextInput style={s.input} value={regUsername} onChangeText={setRegUsername} placeholder="choose a username" placeholderTextColor={selectedTheme.textSecondary} autoCapitalize="none" autoCorrect={false} />

                  <Text style={[s.label, s.spacedLabel]}>password</Text>
                  <TextInput style={s.input} value={regPassword} onChangeText={setRegPassword} placeholder="min 6 characters" placeholderTextColor={selectedTheme.textSecondary} secureTextEntry />

                  <HapticTouchable style={s.btnWrap} onPress={handleRegister} activeOpacity={0.88} disabled={loading} haptic="medium">
                    <LinearGradient colors={[selectedTheme.accentHover, selectedTheme.accent]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={s.btn}>
                      {loading ? <ActivityIndicator color={selectedTheme.bgPrimary} /> : <Text style={s.btnText}>create account</Text>}
                    </LinearGradient>
                  </HapticTouchable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
const SHADOW = darkenColor(theme.primary, theme.isLight ? 72 : 4);
return StyleSheet.create({
  safe:    { flex: 1, backgroundColor: theme.bgPrimary },
  kav:     { flex: 1 },
  scroll:  { paddingHorizontal: 24, paddingVertical: 28, flexGrow: 1, justifyContent: 'center' },

  glowA: {
    position: 'absolute',
    top: -60,
    right: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: rgbaFromHex(theme.accent, 0.08),
  },
  glowB: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: rgbaFromHex(theme.accent, 0.10),
  },
  top: { alignItems: 'center', marginBottom: 26, paddingHorizontal: 6 },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: rgbaFromHex(theme.textPrimary, 0.03),
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
  },
  heroBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: theme.accent, letterSpacing: 1.4, textTransform: 'uppercase' },
  brand: { fontFamily: 'Inter_900Black', fontSize: 42, color: theme.accentHover, marginTop: 4, letterSpacing: -1.4 },
  sub:   { fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.textSecondary, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 320 },

  panel: {
    backgroundColor: rgbaFromHex(theme.panel, 0.92),
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 18,
  },
  tabs: { flexDirection: 'row', backgroundColor: rgbaFromHex(theme.textPrimary, 0.03), borderRadius: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 22, overflow: 'hidden', padding: 4 },
  tab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  tabActive: { backgroundColor: theme.panelAlt },
  tabText:       { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: theme.textSecondary, letterSpacing: 0.5 },
  tabTextActive: { color: theme.accent },

  form: {},
  row:  { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: theme.textSecondary, letterSpacing: 1.7, marginBottom: 8, textTransform: 'uppercase' },
  spacedLabel: { marginTop: 16 },
  input: {
    backgroundColor: theme.panelAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: theme.textPrimary,
  },

  error:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: theme.danger, letterSpacing: 0.3, marginBottom: 12, textAlign: 'center' },
  success: { fontFamily: 'Inter_400Regular', fontSize: 12, color: theme.success, letterSpacing: 0.3, marginBottom: 12, textAlign: 'center' },

  btnWrap: { marginTop: 24, borderRadius: 18, overflow: 'hidden' },
  btn:     { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'Inter_900Black', fontSize: 14, color: theme.bgPrimary, letterSpacing: 0.6 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: theme.textSecondary, letterSpacing: 1.2 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: theme.border, borderRadius: 18, paddingVertical: 15, backgroundColor: theme.panelAlt,
  },
  googleIcon: { fontFamily: 'Inter_900Black', fontSize: 16, color: theme.accent },
  googleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: theme.textPrimary, letterSpacing: 0.2 },
});
}
