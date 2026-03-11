import { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import HomeScreen from '../screens/HomeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import SocialScreen from '../screens/SocialScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MoreScreen from '../screens/MoreScreen';

const GOLD = '#C9A87C';
const BG   = '#0A0A0A';
const DIM  = '#3A3028';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { label: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { label: 'ai chat', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { label: 'more',    icon: 'grid-outline',     activeIcon: 'grid'     },
  { label: 'home',    icon: 'home-outline',     activeIcon: 'home'     },
  { label: 'social',  icon: 'people-outline',   activeIcon: 'people'   },
  { label: 'profile', icon: 'person-outline',   activeIcon: 'person'   },
];


type Props = { user: AuthUser; onLogout: () => void };

export default function TabNavigator({ user, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(2);
  const pager = useRef<PagerView>(null);

  const goTo = (i: number) => {
    pager.current?.setPage(i);
    setIndex(i);
  };

  const SCREENS = [
    () => <AIChatScreen user={user} />,
    () => <MoreScreen user={user} />,
    () => <HomeScreen user={user} />,
    () => <SocialScreen user={user} />,
    () => <ProfileScreen user={user} onLogout={onLogout} />,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={2}
        onPageSelected={e => setIndex(e.nativeEvent.position)}
        overdrag
      >
        {SCREENS.map((Screen, i) => (
          <View key={i} style={{ flex: 1 }}>
            <Screen />
          </View>
        ))}
      </PagerView>

      <View style={[s.tabBar, { paddingBottom: insets.bottom, height: 56 + insets.bottom }]}>
        {TABS.map((t, i) => {
          const active = index === i;
          return (
            <TouchableOpacity key={t.label} style={s.tab} onPress={() => goTo(i)} activeOpacity={0.7}>
              <Ionicons name={active ? t.activeIcon : t.icon} size={20} color={active ? GOLD : DIM} />
              <Text style={[s.tabLabel, { color: active ? GOLD : DIM }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  tabLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
