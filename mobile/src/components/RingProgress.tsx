import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../contexts/ThemeContext';
import { darkenColor } from '../utils/theme';

type Props = {
  value: string;
  label: string;
  progress: number; // 0–1
  size?: number;
  strokeWidth?: number;
};

export default function RingProgress({ value, label, progress, size = 90, strokeWidth = 7 }: Props) {
  const { selectedTheme } = useAppTheme();
  const styles = createStyles(selectedTheme);
  const accentDark = darkenColor(selectedTheme.accent, selectedTheme.isLight ? 18 : 35);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * Math.min(progress, 1);
  const gap = circumference - filled;
  // Rotate so arc starts at top (-90deg = -π/2)
  const rotation = -90;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="arcGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={selectedTheme.accentHover} stopOpacity="1" />
              <Stop offset="0.5" stopColor={selectedTheme.accent} stopOpacity="1" />
              <Stop offset="1" stopColor={accentDark} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Track ring */}
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={accentDark}
            strokeWidth={strokeWidth}
            strokeOpacity={0.18}
            fill="none"
          />

          {/* Progress arc */}
          <Circle
            cx={cx} cy={cy} r={r}
            stroke="url(#arcGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${filled} ${gap}`}
            strokeLinecap="round"
            rotation={rotation}
            origin={`${cx}, ${cy}`}
          />
        </Svg>

        {/* Center text */}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.value}>{value}</Text>
        </View>
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>['selectedTheme']) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: 10,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      fontFamily: 'Inter_900Black',
      fontSize: 22,
      color: theme.accentHover,
    },
    label: {
      fontFamily: 'Inter_400Regular',
      fontSize: 9,
      color: theme.accent,
      letterSpacing: 1.5,
      textAlign: 'center',
      lineHeight: 14,
    },
  });
}
