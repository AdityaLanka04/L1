# Notification system audit — 22 September 2026

42 findings: 6 P1, 26 P2, 10 P3. No P0 issue established.

Scope: current web notification context, inbox, slides, battle alerts, transient toasts; backend notification/reminder APIs and notification producers; classroom notifications; mobile notification API, screen and settings. No application source was changed.

Evidence: source inspection plus isolated executable probes against the actual backend route/model code with an in-memory SQLite database and the actual frontend provider transformed into a controlled hook/fetch/timer harness. This was not a live browser, native-device, production-delivery, or load test. Concurrency and browser-dependent findings are identified as such. Findings are the issues established in the reviewed paths, not a claim that every possible defect is excluded.

Validated: rescheduling suppression; same-title suppression; missing alternate-endpoint metadata; truncated unread count; swallowed scope error; due timer after mark-read; repeated-read count error; stale-fetch restoration after delete and disable. A cross-user mark-read request correctly returned 404.

UI implementation integrity: fails because routing, lifecycle and interaction behavior diverge between notification surfaces. The mechanical Impeccable detector returned no findings for the inspected slide, battle and toast sources; that does not test the behavior above. Provisional source-only UI scores: accessibility 2/4, performance 2/4, responsiveness 3/4, theming 3/4, implementation integrity 1/4; 11/20. Contrast, zoom and device behavior were not visually validated.

Positive findings: notification read/delete operations filter by authenticated ownership; the main reminder generator uses a conditional claim update; the global slide region uses aria-live=polite; slides have labelled controls, a focus-visible style, a mobile-width layout and a reduced-motion rule; HTTP 429 has a normal polling backoff.

## 1. [P1] Notification state is not scoped to the active account

Location: [src/contexts/NotificationContext.js:98](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:98)

The provider is mounted outside the routes and only checks localStorage when polling. Logout does not immediately remove popups or timers. A quick logout/login can carry the previous account’s queued alerts and due timers into the next session; no account identity is retained for comparison.

Correction: Reset state on authentication changes, key the provider by account, and reject results for an old session.

## 2. [P1] Stale requests undo newer state

Location: [src/contexts/NotificationContext.js:155](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:155)

Reproduced: a fetch begun before deletion restores the deleted item; a fetch begun before disabling notifications repopulates the inbox afterward. Concurrent fetches can also overwrite newer read state.

Correction: Cancel requests and validate a session/request generation before applying results; reconcile mutations with pending reads.

## 3. [P1] Rescheduling an already-notified reminder suppresses the replacement alert

Location: [backend/routes/notifications.py:113](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:113)

Reproduced with an in-memory database: resetting is_notified and moving the due date produces no new notification. Deduplication matches only reminder ID and type, so the old alert sets is_notified back to true. update_reminder explicitly resets the flag at reminders.py:647.

Correction: Identify a reminder occurrence by reminder ID and due date, and replace or invalidate the earlier occurrence.

## 4. [P1] Read, deleted, completed, or cancelled reminders can still pop up

Location: [src/contexts/NotificationContext.js:196](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:196)

Reproduced for mark-read: the scheduled timer survives and adds a NOW popup. Mark-all and delete also never cancel these timers. Deleting/completing a Reminder leaves its Notification row intact (reminders.py:662,730), so future polls can schedule alerts for removed/completed work.

Correction: Cancel timers and reconcile queued alerts against current notification/reminder state; invalidate reminders’ active alerts on edit, completion, and deletion.

## 5. [P1] Unread counts and history are truncated

Location: [src/contexts/NotificationContext.js:163](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:163)

Reproduced: 12 newer read notifications hide an older unread notification and yield a zero badge. Web fetches only 12; mobile fetches 50; classroom API caps 100 and counts only those. No cursor/offset is offered. Web calls the loaded subset total; mark-all updates even unseen rows.

Correction: Return independent unread/total counts and paginated history; label any limited preview accurately.

## 6. [P1] Scheduled notification delivery depends on an open client

Location: [backend/routes/notifications.py:91](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:91)

Reminder generation is driven by GET polling or reminder create/update. No background push delivery integration was found in the reviewed repository. Browser due alerts use setTimeout; mobile fetches only on relevant screen loads/refreshes. A closed app cannot reliably alert at the scheduled time.

Correction: Introduce a server scheduler and platform push delivery if closed-app reminders are intended; distinguish in-app alerts from push.

## 7. [P2] Opening an already-read item decrements the unread badge

Location: [src/contexts/NotificationContext.js:284](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:284)

Reproduced: one unread item remains but opening another already-read item changes the badge to zero. Every successful mark-read subtracts one, including repeated clicks.

Correction: Derive the badge from authoritative counts or decrement only on an unread-to-read transition.

## 8. [P2] A reminder first fetched at its due time can produce two popups

Location: [src/contexts/NotificationContext.js:178](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:178)

The new-notification branch queues the ordinary alert, then the due-time branch immediately queues a NOW alert for the same ID. Neither branch checks the other.

Correction: Coalesce an immediately due reminder into one popup.

## 9. [P2] Very old reminders are announced as new upcoming work

Location: [backend/routes/notifications.py:109](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:109)

The main poll accepts all negative minutes_until values, without an overdue cutoff. An unnotified reminder from months ago becomes a newly created Upcoming reminder / Due at notification. The alternate endpoint instead stops after 30 minutes overdue.

Correction: Define a consistent overdue policy and label overdue work with its date and elapsed time.

## 10. [P2] Reminder timing is tied to the querying device’s timezone

Location: [backend/routes/notifications.py:92](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:92)

Dates are stored as local wall-clock values; user_timezone is only logged during creation. Polling subtracts the querying device offset. Travel or simultaneous devices in different zones changes when the same reminder fires. The alternate check uses UTC by default, producing another interpretation.

Correction: Persist a timezone or normalized instant and apply one time model across generation and clients.

## 11. [P2] Different reminders with matching titles suppress each other

Location: [backend/routes/notifications.py:417](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:417)

Reproduced: two distinct reminders titled Same title yield one notification in check_reminder_notifications. The title contains search also conflates substring matches; the skipped reminder remains pending. This endpoint has no current web/mobile caller but remains exposed.

Correction: Deduplicate by occurrence identity, never title text.

## 12. [P2] Alternate reminder generation is not concurrency-safe

Location: [backend/routes/notifications.py:435](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:435)

Unlike the main poll’s conditional claim update, the alternate endpoint reads pending reminders, inserts notifications, then sets is_notified. Concurrent workers can both observe pending state and insert; the model has no unique occurrence constraint. This is a code-confirmed race, not a load-tested reproduction.

Correction: Use the same atomic claim and a unique occurrence constraint for all generation paths.

## 13. [P2] Alternate reminder notifications lack required metadata

Location: [backend/routes/notifications.py:435](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:435)

Reproduced: notifications from check_reminder_notifications lack reminder_id and reminder_due_at markers. The frontend therefore cannot schedule the due-time follow-up, and the main generator cannot deduplicate these rows by marker.

Correction: Emit the same structured occurrence metadata from every generator.

## 14. [P2] Backend failures can look like a successful empty inbox

Location: [backend/routes/notifications.py:144](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:144)

The inner reminder-generation catch omits rollback; a failed transaction can poison the following inbox query. The outer catch returns notifications:[] with a normal response. Cleanup endpoints also return error objects with successful HTTP status.

Correction: Rollback failed transactions and return a non-success status; isolate generation failures from inbox reads.

## 15. [P2] Create-notification input is not validated

Location: [backend/routes/notifications.py:225](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:225)

A raw dict accepts empty text, arbitrary types and arbitrary notification_type. Missing fields reach NOT NULL constraints and become 500s instead of validation errors; oversized strings behave differently between SQLite and constrained databases.

Correction: Use a bounded request schema with required nonempty strings and supported types.

## 16. [P2] Two endpoints swallow authorization errors

Location: [backend/routes/notifications.py:287](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:287)

debug_notifications and check_reminder_notifications catch HTTPException in a generic handler. Reproduced: requesting another username in the reminder checker returns an ordinary error object instead of raising 403. Data is not disclosed, but status handling and monitoring are wrong.

Correction: Re-raise HTTPException before generic handlers.

## 17. [P2] Polling repeatedly scans already-processed reminders

Location: [backend/routes/notifications.py:94](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:94)

Every poll loads all incomplete dated reminders, including notified ones, then searches notification message text for each due reminder. This repeats every 30 seconds per tab and runs synchronous database work inside async routes. Cost grows with historical incomplete reminders.

Correction: Restrict the candidate set to pending occurrences, use indexed occurrence columns, and run blocking database work outside the event loop.

## 18. [P2] Forced refresh bypasses rate-limit backoff

Location: [src/contexts/NotificationContext.js:127](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:127)

refreshNotifications and settings-change events pass force=true, bypassing both Retry-After protection and the five-second guard. There is also no in-flight request guard.

Correction: Respect server backoff even for manual refreshes, and coalesce concurrent refresh requests.

## 19. [P2] Web inbox has no loading or failure state

Location: [src/contexts/NotificationContext.js:149](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:149)

Failed reads and mutation failures return silently. The dashboard initially says No notifications yet during the initial 3.5-second delay and fetch, and cannot explain failed deletion/read actions.

Correction: Expose loading/error status and retry or mutation feedback in the notification UI.

## 20. [P2] Notification preferences are inconsistent across surfaces

Location: [src/pages/QuizBattle.js:41](/Users/adityalanka/BrainwaveAI/src/pages/QuizBattle.js:41)

Battle modal and native browser notifications ignore notificationsEnabled. On web the setting also empties historical inbox data. On mobile the Push Notifications toggle only saves a profile field; no push registration/delivery integration was found, and the inbox does not consult this setting.

Correction: Define separate inbox, popup, sound, and push behavior and enforce the chosen preferences consistently.

## 21. [P2] Classroom and some battle alerts navigate to the wrong page

Location: [src/components/SlideNotification.js:107](/Users/adityalanka/BrainwaveAI/src/components/SlideNotification.js:107)

Producers emit class_assignment, class_grade, class_message and other class_* types plus battle_tied, but neither the slide switch nor dashboard routing handles them; they fall back to the learner dashboard. The emitted milestone type is also unmapped.

Correction: Centralize type-to-destination mapping and include classroom role-aware routes, battle ties, and mastery milestones.

## 22. [P2] Notifications do not identify the target resource

Location: [backend/models/notifications.py:7](/Users/adityalanka/BrainwaveAI/backend/models/notifications.py:7)

Notification records have no target entity ID or action URL. View details opens a generic list, not the specific battle, shared content, assignment or feedback. Classroom notifications likewise only offer Mark read.

Correction: Store a typed target reference and expose an appropriate detail action.

## 23. [P2] Mobile HTTP errors are converted into an empty inbox

Location: [mobile/src/services/api.ts:1441](/Users/adityalanka/BrainwaveAI/mobile/src/services/api.ts:1441)

getNotifications returns an empty array for every non-OK response. NotificationsScreen then clears loadError, hiding 401, 429 and server errors behind no notifications yet.

Correction: Throw a typed API error so the existing screen error state can render.

## 24. [P2] Mobile optimistic changes are never rolled back on failure

Location: [mobile/src/screens/NotificationsScreen.tsx:74](/Users/adityalanka/BrainwaveAI/mobile/src/screens/NotificationsScreen.tsx:74)

Read, delete and mark-all immediately change the screen; catch handlers keep the false state. Failed delete appears successful until manual refresh. ProfileScreen’s notification preference toggle has the same silent persistence failure.

Correction: Rollback or refetch on failure and display retry feedback.

## 25. [P2] Mobile notification text is truncated with no way to read it fully

Location: [mobile/src/screens/NotificationsScreen.tsx:74](/Users/adityalanka/BrainwaveAI/mobile/src/screens/NotificationsScreen.tsx:74)

Rows limit titles to one line and messages to two. Tapping only marks read and returns immediately for an already-read item; it never opens details or expands the text.

Correction: Provide an accessible full-text/detail view and resource navigation.

## 26. [P2] Mobile inbox and profile badge become stale

Location: [mobile/src/screens/NotificationsScreen.tsx:67](/Users/adityalanka/BrainwaveAI/mobile/src/screens/NotificationsScreen.tsx:67)

Inbox load runs on mount/username changes and manual refresh only; ProfileScreen’s badge has a separate one-time fetch at line 79. No shared state or focus refresh reconciles read/delete changes when returning to the profile.

Correction: Refresh on focus and reconcile a shared notification store.

## 27. [P2] Keyboard activation of Delete opens the notification instead

Location: [src/pages/DashboardCerbyl.js:1598](/Users/adityalanka/BrainwaveAI/src/pages/DashboardCerbyl.js:1598)

The nested delete button’s Enter/Space keydown bubbles to the parent row, which preventDefaults and calls openNotification. Only click propagation is stopped.

Correction: Ignore keyboard events originating from child controls or use separate sibling action buttons.

## 28. [P2] Battle notification modal lacks keyboard and dialog accessibility

Location: [src/pages/BattleNotification.js:6](/Users/adityalanka/BrainwaveAI/src/pages/BattleNotification.js:6)

The overlay has no dialog semantics, labelled title, focus placement/trap/restore, or Escape handler. Its icon-only close button has no accessible label. Keyboard focus can remain behind the modal.

Correction: Use the established accessible modal primitive with labelled controls and focus handling.

## 29. [P2] Popups expire while users are reading or interacting

Location: [src/components/SlideNotification.js:63](/Users/adityalanka/BrainwaveAI/src/components/SlideNotification.js:63)

Slides dismiss after 12 seconds regardless of hover/focus; toast messages dismiss after five seconds. A focused control can disappear mid-action.

Correction: Pause dismissal during hover/focus, and make critical messages persistent or recoverable.

## 30. [P2] All queued slide notifications appear and expire simultaneously

Location: [src/components/GlobalNotifications.js:13](/Users/adityalanka/BrainwaveAI/src/components/GlobalNotifications.js:13)

Every queued item is rendered immediately. A burst of 12 fills a scrollable stack and starts all 12-second timers together; off-screen items can expire before the user reaches them.

Correction: Limit visible items and start each dismissal timer only when that item is presented.

## 31. [P2] Transient toasts are not announced to screen readers

Location: [src/contexts/ToastContext.js:37](/Users/adityalanka/BrainwaveAI/src/contexts/ToastContext.js:37)

The toast container and ToastNotification lack a live region/status role. Rate-limit errors sent through this path may only be visually perceptible.

Correction: Use a persistent polite status region, with assertive announcement only for urgent errors.

## 32. [P2] Battle alert handling loses concurrent challenges and lacks action feedback

Location: [src/pages/QuizBattle.js:41](/Users/adityalanka/BrainwaveAI/src/pages/QuizBattle.js:41)

Each incoming challenge overwrites the single pendingBattle. A failed decline only logs to console; Accept and Decline remain enabled while requests run, allowing repeated or conflicting actions.

Correction: Queue pending challenges and expose disabled/pending/error states for each action.

## 33. [P3] Raw internal metadata appears on mobile

Location: [mobile/src/screens/NotificationsScreen.tsx:152](/Users/adityalanka/BrainwaveAI/mobile/src/screens/NotificationsScreen.tsx:152)

Mobile renders n.message directly, unlike the web formatter. Reminder ID/due markers and login_return markers become user-visible when not clipped.

Correction: Return structured metadata separately from display text or share the formatter.

## 34. [P3] Toast IDs can collide

Location: [src/contexts/ToastContext.js:18](/Users/adityalanka/BrainwaveAI/src/contexts/ToastContext.js:18)

Date.now() is the entire toast ID. Two events within one millisecond create duplicate React keys, and closing either removes every toast with that ID.

Correction: Use a monotonic sequence or UUID.

## 35. [P3] First-load recency is measured from provider mount, not login/fetch

Location: [src/contexts/NotificationContext.js:166](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:166)

The provider exists on the public/login pages too. After a long time there, the two-minute cutoff remains anchored to the earlier mount, so old unread items can be replayed as recent.

Correction: Reset the recency baseline for each authenticated session.

## 36. [P3] Popup dismissal is forgotten on reload

Location: [src/contexts/NotificationContext.js:91](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:91)

Seen/queued identifiers live only in memory. Dismiss a recent unread popup and reload within the two-minute first-load window: it is eligible to appear again.

Correction: Persist session-scoped presentation/dismissal state if dismiss is intended to suppress replay.

## 37. [P3] Displayed notification times and countdowns can be misleading

Location: [src/components/SlideNotification.js:353](/Users/adityalanka/BrainwaveAI/src/components/SlideNotification.js:353)

Every slide says Just now regardless of created_at. NOW follow-ups reuse the original message, which can still contain (in 15 min). The alternate endpoint can also emit In 0 min for a reminder less than one minute away.

Correction: Format actual timestamps and calculate time-relative copy at presentation time.

## 38. [P3] Deduplication sets contain incompatible key formats

Location: [src/contexts/NotificationContext.js:290](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:290)

Poll logic checks id:created_at strings; read/delete handlers add numeric IDs. Those additions cannot match later lookups and provide no deduplication protection.

Correction: Use the same key helper for reads, writes and removals.

## 39. [P3] Notification bookkeeping grows for the full session

Location: [src/contexts/NotificationContext.js:190](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:190)

queuedSlideIds and queuedDueSlideKeys accumulate historical keys without pruning until logout, disabling, or unmounting. Long-running sessions retain every displayed notification.

Correction: Use bounded/expiring session history and prune obsolete keys.

## 40. [P3] Browser battle notifications request permission on page initialization and use a missing icon

Location: [src/pages/QuizBattle.js:46](/Users/adityalanka/BrainwaveAI/src/pages/QuizBattle.js:46)

Notification.requestPermission is called from an effect instead of an explicit user action; browsers may suppress such prompts. Both browser notifications reference /battle-icon.png, which is absent from public. Browser prompts were not exercised in this audit.

Correction: Request permission from a clear opt-in interaction and use an existing icon.

## 41. [P3] Notification counts in the debug endpoint are mislabeled

Location: [backend/routes/notifications.py:274](/Users/adityalanka/BrainwaveAI/backend/routes/notifications.py:274)

The endpoint limits rows to 200 and returns len(rows) as total_notifications. Accounts with more rows receive an incorrect total.

Correction: Return a true count or label the field returned_count.

## 42. [P3] Core notification regression coverage is missing

Location: [src/contexts/NotificationContext.js:83](/Users/adityalanka/BrainwaveAI/src/contexts/NotificationContext.js:83)

The searched test suites contain classroom notification assertions and a settings fixture, but no dedicated core inbox/reminder-provider lifecycle, race, timezone or pagination tests. The audit probes are isolated and do not replace durable tests.

Correction: Add focused regression coverage for the reproduced failures and occurrence generation.

## Suggested order

Address account isolation, stale responses, reminder occurrence identity/timer cancellation and accurate counts first. Then standardize scheduling, errors, preferences, routing and mobile state. Finally correct interaction/accessibility and presentation details.

For UI work: `$impeccable harden` for async/error/interaction handling, `$impeccable adapt` for presentation across devices, and `$impeccable polish` after functional regressions pass. Re-run `$impeccable audit` after fixes. Backend changes need focused engineering fixes and regression tests.

You can request these fixes together or in any preferred order.