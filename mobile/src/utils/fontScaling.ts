import { Text, TextInput } from 'react-native';

// Respect the system font size, but cap it so fixed-height controls (chips,
// tabs, headers) don't break at the largest accessibility settings. Any Text
// can still pass its own maxFontSizeMultiplier to override this.
const MAX_FONT_SCALE = 1.6;

type Patchable = { render?: (props: Record<string, unknown>, ref: unknown) => unknown; defaultProps?: Record<string, unknown> };

function capFontScale(component: unknown) {
  const target = component as Patchable;
  if (typeof target.render === 'function') {
    const originalRender = target.render;
    target.render = function patchedRender(this: unknown, props, ref) {
      return originalRender.call(this, { maxFontSizeMultiplier: MAX_FONT_SCALE, ...props }, ref);
    };
  } else {
    target.defaultProps = { ...target.defaultProps, maxFontSizeMultiplier: MAX_FONT_SCALE };
  }
}

capFontScale(Text);
capFontScale(TextInput);
