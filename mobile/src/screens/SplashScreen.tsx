import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/theme';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular });
  const opacity = useRef(new Animated.Value(0)).current;
  const { selectedTheme } = useAppTheme();
  const s = createStyles(selectedTheme);

  useEffect(() => {
    if (!fontsLoaded) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, [fontsLoaded]);

  return (
    <View style={s.container}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <View style={[s.glow, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.14) }]} />
      <Animated.View style={{ opacity }}>
        <Text style={s.logo}>cerbyl</Text>
        <Text style={s.sub}>your ai tutor</Text>
      </Animated.View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    glow: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      top: '30%',
    },
    logo: {
      fontFamily: 'Inter_900Black',
      fontSize: 42,
      color: theme.accentHover,
      textAlign: 'center',
      letterSpacing: 0,
    },
    sub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: theme.accent,
      textAlign: 'center',
      letterSpacing: 4,
      marginTop: 8,
      textTransform: 'uppercase',
    },
  });
}
