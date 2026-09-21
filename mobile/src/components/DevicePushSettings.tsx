import { useEffect, useState } from 'react';
import { Alert, Button, View } from 'react-native';
import { devicePushEnabled, enableDevicePush, disableDevicePush } from '../services/notificationPush';
export default function DevicePushSettings({ alertsEnabled }: { alertsEnabled: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { devicePushEnabled().then(setEnabled); }, []);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try { await (enabled ? disableDevicePush() : enableDevicePush()); setEnabled(!enabled); }
    catch (error) { Alert.alert('Push notifications', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setBusy(false); }
  };
  return <View style={{ marginVertical: 12 }}><Button disabled={busy || (!enabled && !alertsEnabled)} onPress={toggle} title={busy ? 'Updating…' : enabled ? 'Disable push on this device' : 'Enable push on this device'} /></View>;
}
