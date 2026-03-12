import { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import HomeScreen from '../screens/HomeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import SocialScreen from '../screens/SocialScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MoreScreen from '../screens/MoreScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import NotesScreen from '../screens/NotesScreen';

const GOLD = '#C9A87C';
const BG   = '#0A0A0A';
const DIM  = '#3A3028';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { label: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { label: 'ai',      icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { label: 'explore', icon: 'grid-outline',      activeIcon: 'grid'    },
  { label: 'home',    icon: 'home-outline',      activeIcon: 'home'    },
  { label: 'social',  icon: 'people-outline',    activeIcon: 'people'  },
  { label: 'profile', icon: 'person-outline',    activeIcon: 'person'  },
];

type Props = { user: AuthUser; onLogout: () => void };

export default function TabNavigator({ user, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(2);
  const [activeScreen, setActiveScreen] = useState<'flashcards' | 'notes' | null>(null);
  const pager = useRef<PagerView>(null);

  const goTo = (i: number) => {
    pager.current?.setPage(i);
    setIndex(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={2}
        onPageSelected={e => setIndex(e.nativeEvent.position)}
        overdrag
      >
        <View key="0" style={{ flex: 1 }}><AIChatScreen user={user} /></View>
        <View key="1" style={{ flex: 1 }}><MoreScreen user={user} onNavigate={setActiveScreen} onNavigateToAI={() => goTo(0)} /></View>
        <View key="2" style={{ flex: 1 }}><HomeScreen user={user} /></View>
        <View key="3" style={{ flex: 1 }}><SocialScreen user={user} /></View>
        <View key="4" style={{ flex: 1 }}><ProfileScreen user={user} onLogout={onLogout} /></View>
      </PagerView>

      <View style={[s.tabBar, { paddingBottom: insets.bottom, height: 54 + insets.bottom }]}>
        {TABS.map((t, i) => {
          const active = index === i;
          return (
            <TouchableOpacity key={t.label} style={s.tab} onPress={() => goTo(i)} activeOpacity={0.7}>
              <Ionicons name={active ? t.activeIcon : t.icon} size={18} color={active ? GOLD : DIM} />
              <Text style={[s.tabLabel, { color: active ? GOLD : DIM }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={activeScreen === 'flashcards'} animationType="slide" onRequestClose={() => setActiveScreen(null)}>
        <FlashcardsScreen user={user} onBack={() => setActiveScreen(null)} />
      </Modal>

      <Modal visible={activeScreen === 'notes'} animationType="slide" onRequestClose={() => setActiveScreen(null)}>
        <NotesScreen user={user} onBack={() => setActiveScreen(null)} />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 7,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  tabLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.3,
  },
});
