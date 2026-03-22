import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export function getResponsiveLayout(width: number, height: number) {
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isLandscape = width >= height;
  const isTablet = shortestSide >= 768 || (shortestSide >= 600 && longestSide >= 960);
  const isWide = width >= 900;
  const screenPadding = width >= 1100 ? 28 : width >= 768 ? 22 : 18;
  const contentMaxWidth = Math.min(width - screenPadding * 2, isWide ? 1180 : isTablet ? 960 : 720);

  return {
    width,
    height,
    shortestSide,
    longestSide,
    isLandscape,
    isTablet,
    isWide,
    screenPadding,
    contentMaxWidth,
    twoColumn: width >= 700,
    threeColumn: width >= 1100,
    sideRailTabs: isLandscape && width >= 900,
  };
}

export type ResponsiveLayout = ReturnType<typeof getResponsiveLayout>;

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getResponsiveLayout(width, height), [width, height]);
}
