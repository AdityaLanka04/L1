import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MobileTheme, rgbaFromHex } from '../utils/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type BubbleSpec = {
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  alpha: number;
  scaleX?: number;
  scaleY?: number;
};

type BubbleVariant =
  | 'home'
  | 'social'
  | 'explore'
  | 'profile'
  | 'settings'
  | 'chat'
  | 'auth'
  | 'notes'
  | 'flashcards'
  | 'media'
  | 'friends'
  | 'leaderboard'
  | 'games'
  | 'playlists'
  | 'paths'
  | 'quiz';

type Props = {
  theme: MobileTheme;
  variant?: BubbleVariant;
  opacity?: number;
};

function getPresets(width: number, height: number): Record<BubbleVariant, BubbleSpec[]> {
  return {
    home: [
      { size: 176, top: height * 0.1, right: -54, alpha: 0.12, scaleX: 1.05 },
      { size: 126, top: height * 0.3, left: -42, alpha: 0.1, scaleY: 1.08 },
      { size: 112, bottom: height * 0.16, right: 18, alpha: 0.08 },
    ],
    social: [
      { size: 168, top: height * 0.08, left: -48, alpha: 0.1, scaleX: 1.08 },
      { size: 132, top: height * 0.26, right: -36, alpha: 0.08 },
      { size: 104, bottom: height * 0.14, left: width * 0.14, alpha: 0.07 },
    ],
    explore: [
      { size: 164, top: height * 0.12, right: -46, alpha: 0.1 },
      { size: 118, top: height * 0.34, left: -32, alpha: 0.08, scaleY: 1.1 },
      { size: 96, bottom: height * 0.12, right: width * 0.18, alpha: 0.06 },
    ],
    profile: [
      { size: 152, top: height * 0.06, right: -34, alpha: 0.1 },
      { size: 116, top: height * 0.24, left: -28, alpha: 0.07 },
      { size: 92, bottom: height * 0.18, right: width * 0.12, alpha: 0.06 },
    ],
    settings: [
      { size: 144, top: height * 0.08, left: -28, alpha: 0.08 },
      { size: 122, top: height * 0.22, right: -24, alpha: 0.08 },
      { size: 84, bottom: height * 0.22, left: width * 0.18, alpha: 0.06 },
    ],
    chat: [
      { size: 166, top: height * 0.08, right: -56, alpha: 0.08, scaleY: 1.12 },
      { size: 124, top: height * 0.28, left: -22, alpha: 0.06 },
      { size: 98, bottom: height * 0.14, right: width * 0.2, alpha: 0.05 },
    ],
    auth: [
      { size: 188, top: height * 0.06, left: -64, alpha: 0.12 },
      { size: 140, top: height * 0.22, right: -32, alpha: 0.08 },
      { size: 108, bottom: height * 0.12, left: width * 0.14, alpha: 0.06 },
    ],
    notes: [
      { size: 158, top: height * 0.08, right: -42, alpha: 0.1 },
      { size: 118, top: height * 0.28, left: -30, alpha: 0.08 },
      { size: 98, bottom: height * 0.16, right: width * 0.12, alpha: 0.06 },
    ],
    flashcards: [
      { size: 170, top: height * 0.08, left: -46, alpha: 0.1, scaleX: 1.06 },
      { size: 120, top: height * 0.26, right: -28, alpha: 0.08 },
      { size: 104, bottom: height * 0.14, left: width * 0.2, alpha: 0.06 },
    ],
    media: [
      { size: 164, top: height * 0.08, right: -38, alpha: 0.1, scaleY: 1.08 },
      { size: 128, top: height * 0.3, left: -36, alpha: 0.08 },
      { size: 88, bottom: height * 0.16, right: width * 0.14, alpha: 0.05 },
    ],
    friends: [
      { size: 156, top: height * 0.08, left: -34, alpha: 0.09 },
      { size: 116, top: height * 0.3, right: -30, alpha: 0.07 },
      { size: 96, bottom: height * 0.14, left: width * 0.16, alpha: 0.05 },
    ],
    leaderboard: [
      { size: 174, top: height * 0.06, right: -40, alpha: 0.11 },
      { size: 118, top: height * 0.24, left: -24, alpha: 0.08 },
      { size: 88, bottom: height * 0.16, right: width * 0.16, alpha: 0.05 },
    ],
    games: [
      { size: 164, top: height * 0.1, left: -34, alpha: 0.1 },
      { size: 120, top: height * 0.32, right: -28, alpha: 0.07 },
      { size: 90, bottom: height * 0.16, left: width * 0.18, alpha: 0.05 },
    ],
    playlists: [
      { size: 162, top: height * 0.08, right: -34, alpha: 0.1 },
      { size: 114, top: height * 0.28, left: -26, alpha: 0.07 },
      { size: 86, bottom: height * 0.18, right: width * 0.12, alpha: 0.05 },
    ],
    paths: [
      { size: 156, top: height * 0.1, left: -28, alpha: 0.09 },
      { size: 118, top: height * 0.26, right: -22, alpha: 0.07 },
      { size: 92, bottom: height * 0.14, left: width * 0.24, alpha: 0.05 },
    ],
    quiz: [
      { size: 160, top: height * 0.08, right: -28, alpha: 0.1 },
      { size: 110, top: height * 0.34, left: -24, alpha: 0.07 },
      { size: 84, bottom: height * 0.18, right: width * 0.18, alpha: 0.05 },
    ],
  };
}

export default function AmbientBubbles({ theme, variant = 'home', opacity = 1 }: Props) {
  const { width, height } = useResponsiveLayout();
  const bubbles = getPresets(width, height)[variant];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map((bubble, index) => (
        <View
          key={`${variant}-${index}`}
          style={[
            styles.bubble,
            {
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              top: bubble.top,
              bottom: bubble.bottom,
              left: bubble.left,
              right: bubble.right,
              backgroundColor: rgbaFromHex(theme.accent, bubble.alpha * opacity),
              borderColor: rgbaFromHex(theme.accentHover, bubble.alpha * opacity * 1.25),
              shadowColor: theme.accent,
              shadowOpacity: theme.isLight ? bubble.alpha * 0.28 : bubble.alpha * 0.42,
              transform: [
                { scaleX: bubble.scaleX ?? 1 },
                { scaleY: bubble.scaleY ?? 1 },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 0,
  },
});
