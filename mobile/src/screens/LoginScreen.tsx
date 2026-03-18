import { useState, useEffect } from 'react';
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

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '482205787855-emlbsvd954ga26c2i1gmegm80lq40qek.apps.googleusercontent.com';
const redirectUri = makeRedirectUri({ scheme: 'cerbyl' });

const BG     = '#0A0A0A';
const CARD   = '#111111';
const GOLD_L = '#FFE8A0';
const GOLD_M = '#C9A87C';
const GOLD_D = '#7A5C2E';
const DIM    = '#5A5040';
const BORDER = '#1E1E1E';
const ERR    = '#8B3A3A';

type Props = { onLogin: (user: AuthUser) => void };

export default function LoginScreen({ onLogin }: Props) {
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
    expoClientId:    CLIENT_ID,
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
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.top}>
            <Text style={s.brand}>cerbyl</Text>
            <Text style={s.sub}>your ai tutor</Text>
          </View>

          {/* Tab toggle */}
          <View style={s.tabs}>
            <HapticTouchable style={[s.tab, mode === 'login' && s.tabActive]} onPress={() => switchMode('login')} haptic="selection">
              <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>sign in</Text>
            </HapticTouchable>
            <HapticTouchable style={[s.tab, mode === 'register' && s.tabActive]} onPress={() => switchMode('register')} haptic="selection">
              <Text style={[s.tabText, mode === 'register' && s.tabTextActive]}>new user</Text>
            </HapticTouchable>
          </View>

          {success ? <Text style={s.success}>{success}</Text> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.form}>
            {mode === 'login' ? (
              <>
                <Text style={s.label}>username or email</Text>
                <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="enter username" placeholderTextColor={DIM} autoCapitalize="none" autoCorrect={false} />

                <Text style={[s.label, { marginTop: 16 }]}>password</Text>
                <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="enter password" placeholderTextColor={DIM} secureTextEntry />

                <HapticTouchable style={s.btnWrap} onPress={handleLogin} activeOpacity={0.85} disabled={loading} haptic="medium">
                  <LinearGradient colors={[GOLD_L, GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
                    {loading ? <ActivityIndicator color="#0A0A0A" /> : <Text style={s.btnText}>sign in</Text>}
                  </LinearGradient>
                </HapticTouchable>

                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or</Text>
                  <View style={s.dividerLine} />
                </View>

                <HapticTouchable style={s.googleBtn} onPress={() => { setError(''); promptAsync(); }} activeOpacity={0.85} disabled={loading || !request} haptic="medium">
                  <Text style={s.googleIcon}>G</Text>
                  <Text style={s.googleText}>continue with google</Text>
                </HapticTouchable>
              </>
            ) : (
              <>
                <View style={s.row}>
                  <View style={s.half}>
                    <Text style={s.label}>first name</Text>
                    <TextInput style={s.input} value={regFirstName} onChangeText={setRegFirstName} placeholder="first" placeholderTextColor={DIM} autoCapitalize="words" />
                  </View>
                  <View style={s.half}>
                    <Text style={s.label}>last name</Text>
                    <TextInput style={s.input} value={regLastName} onChangeText={setRegLastName} placeholder="last" placeholderTextColor={DIM} autoCapitalize="words" />
                  </View>
                </View>

                <Text style={[s.label, { marginTop: 16 }]}>email</Text>
                <TextInput style={s.input} value={regEmail} onChangeText={setRegEmail} placeholder="you@example.com" placeholderTextColor={DIM} autoCapitalize="none" keyboardType="email-address" />

                <Text style={[s.label, { marginTop: 16 }]}>username</Text>
                <TextInput style={s.input} value={regUsername} onChangeText={setRegUsername} placeholder="choose a username" placeholderTextColor={DIM} autoCapitalize="none" autoCorrect={false} />

                <Text style={[s.label, { marginTop: 16 }]}>password</Text>
                <TextInput style={s.input} value={regPassword} onChangeText={setRegPassword} placeholder="min 6 characters" placeholderTextColor={DIM} secureTextEntry />

                <HapticTouchable style={s.btnWrap} onPress={handleRegister} activeOpacity={0.85} disabled={loading} haptic="medium">
                  <LinearGradient colors={[GOLD_L, GOLD_M, GOLD_D]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
                    {loading ? <ActivityIndicator color="#0A0A0A" /> : <Text style={s.btnText}>create account</Text>}
                  </LinearGradient>
                </HapticTouchable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  kav:     { flex: 1 },
  scroll:  { paddingHorizontal: 28, paddingVertical: 32 },

  top: { alignItems: 'center', marginBottom: 32 },
  brand: { fontFamily: 'Inter_900Black', fontSize: 32, color: GOLD_M, marginTop: 12 },
  sub:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: DIM, letterSpacing: 2, marginTop: 4 },

  tabs: { flexDirection: 'row', backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 20, overflow: 'hidden' },
  tab:       { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#1A1A1A' },
  tabText:       { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: DIM, letterSpacing: 1.5 },
  tabTextActive: { color: GOLD_M },

  form: {},
  row:  { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: DIM, letterSpacing: 2, marginBottom: 8 },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: GOLD_L,
  },

  error:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: ERR, letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  success: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#4CAF50', letterSpacing: 1, marginBottom: 12, textAlign: 'center' },

  btnWrap: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  btn:     { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'Inter_900Black', fontSize: 14, color: '#0A0A0A', letterSpacing: 1 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: DIM, letterSpacing: 2 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingVertical: 14, backgroundColor: CARD,
  },
  googleIcon: { fontFamily: 'Inter_900Black', fontSize: 16, color: GOLD_M },
  googleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: GOLD_L, letterSpacing: 0.5 },
});
