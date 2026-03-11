import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useFonts, Inter_900Black, Inter_400Regular } from '@expo-google-fonts/inter';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const [fontsLoaded] = useFonts({ Inter_900Black, Inter_400Regular });
  const opacity = useRef(new Animated.Value(0)).current;

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
      <Animated.View style={{ opacity }}>
        <Text style={s.logo}>cerbyl</Text>
        <Text style={s.sub}>your ai tutor</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'Inter_900Black',
    fontSize: 42,
    color: '#C9A87C',
    textAlign: 'center',
    letterSpacing: 2,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#5A5040',
    textAlign: 'center',
    letterSpacing: 4,
    marginTop: 8,
  },
});
