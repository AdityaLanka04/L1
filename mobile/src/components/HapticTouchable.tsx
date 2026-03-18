import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { HapticVariant, triggerHaptic } from '../utils/haptics';

type Props = TouchableOpacityProps & {
  haptic?: HapticVariant;
};

export default function HapticTouchable({
  haptic = 'light',
  onPressIn,
  disabled,
  ...props
}: Props) {
  return (
    <TouchableOpacity
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled && haptic !== 'none') {
          triggerHaptic(haptic);
        }
        onPressIn?.(event);
      }}
    />
  );
}
