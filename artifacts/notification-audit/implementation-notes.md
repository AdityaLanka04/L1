# Notification fixes and friend display names

The friend cards, discovery rows and request headings now prefer a real name, then a username. Legacy accounts whose username is an email use its local part as the display fallback. Full emails remain secondary contact text where appropriate. The friends API returns experience, level, points and streak; invalid experience values render as 0%, never NaN. Alphabetical sorting and name search use the displayed name.

## Audit coverage

The original audit remains unchanged as a historical record. This implementation addresses its findings as follows:

| Original findings | Implemented correction |
| --- | --- |
| 1–2 | Account-scoped state, logout/storage/route listeners, abortable reads, generation guards and mutation reconciliation. |
| 3–4 | UTC occurrence identity, conditional claim, transactional cancellation, rescheduling/reopening and recursive deletion cleanup; due timers reconcile against current unread items. |
| 5 | Independent total/unread counts and cursor pagination across web, mobile and classroom inboxes. Loaded web history refreshes past the API page-size cap. |
| 6 | Server reminder scheduler plus optional browser Web Push and Expo device delivery. Registration, durable delivery records, retries, provider receipts and invalid-device cleanup are included. Production activation is described below. |
| 7–8 | Read transitions decrement only once; ordinary and immediately-due alerts are coalesced. |
| 9–13 | Shared server-clock generator; stable timezone/UTC schedule; 30-minute overdue cutoff; occurrence-based deduplication and structured metadata from every entry point. |
| 14–16 | Failed generation rolls back before inbox reads; API errors are non-success HTTP responses; validated creation schema and preserved authorization status. |
| 17–18 | Indexed pending schedules, synchronous route execution for blocking database work, request coalescing and backoff respected by manual refresh. |
| 19–20 | Loading/error/retry states, server preference synchronization, popup preferences that preserve inbox history, and explicit per-browser/device push opt-in. Battle alerts check the preference. |
| 21–22 | Shared type routing, classroom/battle/mastery destinations, full-text detail view and target references for new reminder, battle, sharing and classroom notifications. Pending battle links open the response dialog rather than starting a quiz. |
| 23–26 | Mobile HTTP failures surface as errors; mutations wait for success; full text is readable; pagination, focus refresh, incoming-push events and shared badge invalidation keep state current. |
| 27–32 | Separate native Open/Delete buttons, labelled/focus-managed battle and detail dialogs, hover/focus-paused dismissal, one visible popup/toast at a time, live announcements, queued battles and action errors/pending states. |
| 33–37 | Internal markers stripped on the server and mobile; monotonic toast IDs; per-account first-load baseline and bounded session presentation history; actual timestamps and current due-time copy. |
| 38–41 | Consistent popup keys, bounded bookkeeping, explicit permission requests, existing icon assets and accurate debug totals. |
| 42 | Durable provider, timer, display-name, authenticated reminder lifecycle, migration, delivery and push regression tests. |

Historical notifications without resource identifiers still show their full text and a relevant category destination when one can be determined. New resource notifications carry explicit links. Legacy reminders without a trustworthy saved timezone are initialized once from the user's next authenticated client read; the migration does not guess their timezone.

## Validation

- 46 frontend regression checks passed across 9 suites, including existing profile/auth/battle/classroom coverage.
- 27 backend checks passed, including authenticated reminder edit/complete/reopen/delete, migration upgrade/downgrade, pagination, authorization, push retries, preference enforcement and late-commit delivery.
- Two unrelated tutor tests in the classroom audit suite were excluded after confirming that the minimal test environment lacks `langgraph`. They are not notification tests.
- Mobile TypeScript check passed.
- Production web build passed.
- Browser validation uses local mocked API data: name headings, finite progress, full-text dialog, Escape dismissal, keyboard deletion, pending-battle deep link and mobile overflow. Screenshots in this directory use synthetic accounts.
- No live push was sent. Device delivery and production rollout are not claimed as verified.

## Rollout requirements

1. Deploy the backend dependencies and run `alembic upgrade head` from `backend` before starting the new application. The migration is `c3b20260922`, based on `b2b20260911a`. Application tests and migration verification used disposable databases; no existing development or production database was migrated by this task.
2. Keep APScheduler enabled. Reminder generation runs every 15 seconds. The push job uses the application's PostgreSQL advisory-lock convention to select one worker. For SQLite development, run one scheduler process.
3. Browser push requires stable `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` deployment secrets/settings. The private key accepts the format supported by pywebpush; the public key is the URL-safe base64 uncompressed P-256 public point. The subject is an operator contact such as a `mailto:` URI. Without them the UI explicitly reports that browser push is not yet available.
4. Native push requires `EXPO_PUSH_ENABLED=true`, the existing EAS project, APNs/FCM credentials configured for that project, and a new native build containing `expo-notifications`. Set `EXPO_ACCESS_TOKEN` when Expo push access-token security is enabled. Users must explicitly enable push on each device. This cannot be activated by a JavaScript-only update to an old native build.
5. Lock-screen push previews are generic. Private titles/messages are shown inside the authenticated app. Push retries use durable per-device delivery records; transport acknowledgement and actual device display are distinct, and delivery is ultimately subject to platform permission, connectivity and provider availability.

Provider references: [pywebpush documentation](https://github.com/web-push-libs/pywebpush), [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo delivery/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

To repeat the browser checks after building, run `node artifacts/notification-audit/serve-build.cjs` from the repository root, then run `node artifacts/notification-audit/verify-browser.cjs` in a second terminal. The verifier stubs HTTP APIs and WebSockets and uses synthetic account data. Stop the local server after checking.
