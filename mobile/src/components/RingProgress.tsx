import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const GOLD_LIGHT = '#FFE8A0';
const GOLD_MID = '#C9A87C';
const GOLD_DARK = '#7A5C2E';
const TEXT_DIM = '#5A5040';

type Props = {
  value: string;
  label: string;
  progress: number; // 0–1
  size?: number;
  strokeWidth?: number;
};

export default function RingProgress({ value, label, progress, size = 90, strokeWidth = 7 }: Props) {
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
              <Stop offset="0" stopColor={GOLD_LIGHT} stopOpacity="1" />
              <Stop offset="0.5" stopColor={GOLD_MID} stopOpacity="1" />
              <Stop offset="1" stopColor={GOLD_DARK} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Track ring */}
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={GOLD_DARK}
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

const styles = StyleSheet.create({
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
    color: GOLD_LIGHT,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: TEXT_DIM,
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 14,
  },
});
