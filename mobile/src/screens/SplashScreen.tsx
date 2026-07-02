import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular } from '@expo-google-fonts/inter';
import { LinearGradient } from 'expo-linear-gradient';
import GeoBackground from '../components/GeoBackground';
import { useAppTheme } from '../contexts/ThemeContext';
import { rgbaFromHex } from '../utils/theme';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular });
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const { selectedTheme } = useAppTheme();
  const s = createStyles(selectedTheme);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    if (!fontsLoaded) return;

    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 2400, useNativeDriver: true })
    ).start();

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, [fontsLoaded]);

  return (
    <View style={s.container}>
      <LinearGradient colors={[selectedTheme.bgTop, selectedTheme.bgPrimary, selectedTheme.bgBottom]} style={StyleSheet.absoluteFillObject} />
      <GeoBackground />
      <View style={[s.glow, { backgroundColor: rgbaFromHex(selectedTheme.accent, 0.14) }]} />
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <Animated.Image
          source={require('../../assets/logo.png')}
          style={[s.logoImg, { transform: [{ rotate: spin }] }]}
        />
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
    logoImg: {
      width: 80,
      height: 80,
      marginBottom: 20,
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
