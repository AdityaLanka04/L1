# AI chat audit — 2026-09-15

## Fixed in this audit
- Optional offer acceptance/decline no longer becomes a graded tutor attempt.
- Tutor metadata alone no longer signals a pending exercise in the frontend.
- Legitimate answers containing “I understand” are no longer mistaken for explanation requests.
- Recall event persistence now supplies the required unique memory hash; correction lookup uses the latest conversation pair.
- Numerical corrections now include intermediate algebra/arithmetic instead of a terse replacement answer.
- Provider limits and account allowances have distinct messages. Unknown reset times are not fabricated; minute delays and null fields are handled correctly.
- Reproduced production Mermaid failure for `C[Protons (+)]`. Repair quotes ordinary rectangle labels without inventing nodes. Unrecoverable diagrams show readable fallback text.
- Generation now explicitly requests quoted Mermaid labels.

## Verification
- 164 backend tests passed across tutor, recall, prompt priority, formatting, attachments, notes, token accounting, workflow safety and real Redis queue recovery.
- 55 frontend tests passed across conversation state, tutor replies, study actions, usage errors and diagram repair.
- Real Mermaid parser rejected the production reproduction and accepted the repaired source.
- Production browser test returned a conceptual nuclear physics explanation and an optional numerical offer; this test also found the diagram defect.
- Live provider tests confirmed a declined offer gets an acknowledgement and a wrong equation answer gets a correction with subtraction/division steps. Outputs are saved alongside this report.
- Production dashboard confirms Admin unlimited AI access. This does not remove shared provider limits.

## Deployment / outstanding work
Backend fixes installed in production with timestamped rollback backups under `/home/ubuntu/brainwave-backend/prompt-fix-backups/`. Host files and compose mounts preserve changes across container recreation. Readiness and file hashes verified after deployment.

Frontend changes are staged in isolated worktree `/tmp/cerbyl-chat-audit-ui`, excluding unrelated sidebar edits. Vercel is logged out; frontend deployment is blocked until the user completes the open authorization page. Do not describe frontend fixes as deployed.

This is a targeted audit of the major chat paths and reported failures, not proof that every possible model response or all application features are bug-free. Live smoke tests call generation/review directly; the browser test additionally exercised an authenticated production request. No broad load test was performed against the shared production provider allowance.
