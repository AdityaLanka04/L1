import { useEffect, useRef, useState } from 'react';
// Restart a full reading interval after interaction, rather than dismissing on blur.
export default function useNotificationDismiss(onClose, duration = 12000) {
  const close = useRef(onClose); close.current = onClose;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return undefined;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [hovered, focused, duration]);
  return {
    onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }
  };
}
