import { useState } from 'react';
import { enableBrowserPush, disableBrowserPush } from '../utils/notificationPush';
export default function BrowserPushSettings({ alertsEnabled }) {
  const [enabled, setEnabled] = useState(() => Boolean(localStorage.getItem('cerbyl.pushSubscription')));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toggle = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await (enabled ? disableBrowserPush() : enableBrowserPush()); setEnabled(!enabled); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <div>
    <button className="pnw-secondary-action" type="button" onClick={toggle} disabled={busy || (!enabled && !alertsEnabled)}>{busy ? 'Updating…' : enabled ? 'Disable push on this browser' : 'Enable push on this browser'}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
