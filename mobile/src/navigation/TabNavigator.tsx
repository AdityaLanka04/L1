import { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationIndependentTree } from '@react-navigation/core';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthUser } from '../services/auth';
import HomeScreen from '../screens/HomeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import SocialScreen from '../screens/SocialScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MoreScreen from '../screens/MoreScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import NotesScreen from '../screens/NotesScreen';
import AIMediaNotesScreen from '../screens/AIMediaNotesScreen';
import HapticTouchable from '../components/HapticTouchable';

const GOLD = '#C9A87C';
const BG   = '#0A0A0A';
const DIM  = '#3A3028';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type RootStackParamList = {
  Main: undefined;
  Flashcards: undefined;
  Notes: undefined;
  AIMedia: undefined;
};

const TABS: { label: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { label: 'ai',      icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { label: 'explore', icon: 'grid-outline',      activeIcon: 'grid'    },
  { label: 'cerbyl',  icon: 'home-outline',      activeIcon: 'home'    },
  { label: 'social',  icon: 'people-outline',    activeIcon: 'people'  },
  { label: 'profile', icon: 'person-outline',    activeIcon: 'person'  },
];

type Props = { user: AuthUser; onLogout: () => void };
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs({ user, onLogout, onNavigate }: Props & { onNavigate: (screen: 'flashcards' | 'notes' | 'aimedia') => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(2);
  const pager = useRef<PagerView>(null);

  const goTo = (i: number) => {
    pager.current?.setPage(i);
    setIndex(i);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#100D07', '#0A0908', '#07080D']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ flex: 1, paddingTop: insets.top }}>
      <PagerView
        ref={pager}
        style={{ flex: 1 }}
        initialPage={2}
        onPageSelected={e => setIndex(e.nativeEvent.position)}
        overdrag={false}
        scrollEnabled={index !== 2}
      >
        <View key="0" style={{ flex: 1 }}><AIChatScreen user={user} /></View>
        <View key="1" style={{ flex: 1 }}><MoreScreen user={user} onNavigate={onNavigate} onNavigateToAI={() => goTo(0)} /></View>
        <View key="2" style={{ flex: 1 }}><HomeScreen user={user} onNavigate={onNavigate} onNavigateToAI={() => goTo(0)} onSwipeLeftPage={() => goTo(3)} onSwipeRightPage={() => goTo(1)} /></View>
        <View key="3" style={{ flex: 1 }}><SocialScreen user={user} /></View>
        <View key="4" style={{ flex: 1 }}><ProfileScreen user={user} onLogout={onLogout} onNavigate={onNavigate} /></View>
      </PagerView>

      <View style={[s.tabBar, { paddingBottom: insets.bottom, height: 62 + insets.bottom }]}>
        {TABS.map((t, i) => {
          const active = index === i;
          return (
            <HapticTouchable key={t.label} style={s.tab} onPress={() => goTo(i)} activeOpacity={0.7} haptic="selection">
              <Ionicons name={active ? t.activeIcon : t.icon} size={18} color={active ? GOLD : DIM} />
              <Text style={[s.tabLabel, { color: active ? GOLD : DIM }]}>{t.label}</Text>
            </HapticTouchable>
          );
        })}
      </View>
      </View>
    </View>
  );
}

export default function TabNavigator({ user, onLogout }: Props) {
  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: { backgroundColor: BG },
          }}
        >
          <Stack.Screen name="Main">
            {({ navigation }) => (
              <MainTabs
                user={user}
                onLogout={onLogout}
                onNavigate={(screen) => {
                  if (screen === 'flashcards') navigation.navigate('Flashcards');
                  if (screen === 'notes') navigation.navigate('Notes');
                  if (screen === 'aimedia') navigation.navigate('AIMedia');
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Flashcards">
            {({ navigation }) => (
              <FlashcardsScreen user={user} onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>
          <Stack.Screen name="Notes">
            {({ navigation }) => (
              <NotesScreen user={user} onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>
          <Stack.Screen name="AIMedia">
            {({ navigation }) => (
              <AIMediaNotesScreen user={user} onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
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
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
