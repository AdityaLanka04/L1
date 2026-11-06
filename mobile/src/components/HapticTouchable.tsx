import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { HapticVariant, triggerHaptic } from '../utils/haptics';

const DEFAULT_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

type Props = TouchableOpacityProps & {
  haptic?: HapticVariant;
};

export default function HapticTouchable({
  haptic = 'light',
  onPressIn,
  disabled,
  accessibilityRole,
  accessibilityState,
  hitSlop,
  ...props
}: Props) {
  return (
    <TouchableOpacity
      {...props}
      disabled={disabled}
      hitSlop={hitSlop ?? DEFAULT_HIT_SLOP}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ ...accessibilityState, disabled }}
      onPressIn={(event) => {
        if (!disabled && haptic !== 'none') {
          triggerHaptic(haptic);
        }
        onPressIn?.(event);
      }}
    />
  );
}
