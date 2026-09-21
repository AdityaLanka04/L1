import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_URL } from './api';
import { getToken } from './tokenStorage';
const KEY = 'cerbyl.pushSubscription';
async function headers() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` }; }
export const devicePushEnabled = async () => Boolean(await AsyncStorage.getItem(KEY));
export async function enableDevicePush() {
  const auth = await headers();
  const response = await fetch(`${API_URL}/notification_push/config`, { headers: auth });
  if (!response.ok || !(await response.json()).expo_enabled) throw new Error('Device push is not available yet. Your inbox still works.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Cerbyl updates', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Allow notifications in device settings to enable push.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('This build is not configured for push notifications.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const saved = await fetch(`${API_URL}/notification_push/subscriptions`, { method: 'POST', headers: auth, body: JSON.stringify({ platform: 'expo', subscription: { token } }) });
  if (!saved.ok) throw new Error('Could not save device push preferences. Please retry.');
  const data = await saved.json();
  await AsyncStorage.setItem(KEY, String(data.id));
}
export async function disableDevicePush() {
  const id = await AsyncStorage.getItem(KEY);
  if (!id) return;
  const response = await fetch(`${API_URL}/notification_push/subscriptions/${id}`, { method: 'DELETE', headers: await headers() });
  if (!response.ok) throw new Error('Could not disable device push. Please retry.');
  await AsyncStorage.removeItem(KEY);
  await Notifications.dismissAllNotificationsAsync();
}
