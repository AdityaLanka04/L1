# Production chat prompting fix — 15 September 2026

Deployed and restarted the backend. Public API readiness returned ready at 18:08 UTC. All ten deployed source-file hashes matched the intended release. Remote rollback copies: `/home/ubuntu/brainwave-backend/prompt-fix-backups/20260915T180722Z`.

## Behavior

- Explain conceptual requests before offering a numerical example.
- Give full worked steps only when requested or when the immediately preceding offer is accepted.
- Honor explicit exclusions such as no numericals or derivations.
- Preserve the current topic for recall and document-search follow-ups; a new topic replaces the old one.
- Keep hint, answer-check and quiz modes distinct from Teach.
- Use the same request-first content policy for generation, format repair and review.
- Keep internal JSON out of normal chat; do not render optional offers as student exercises.
- Use provider-enforced JSON for tutor responses and return a temporary busy error for transient provider throttling.

## Verification

114 backend regression tests passed across recall/Teach, prompt priority, comprehension, quality, and formatting suites. Seven synthetic live scenarios were inspected during iteration. `live-cases.json` records those responses; the final renderer correction was verified separately by a regression test and the postdeployment live response.

`postdeploy-live-response.jsonl` is a request executed through the actual deployed tutor code: “Explain nuclear physics” produced a 337-word conceptual explanation followed by an optional numerical offer, without performing an unsolicited calculation.

The live tests make provider calls but create no chat sessions. Groq organization-level minute throttling occurred during batch testing; the smoke harness waits and retries temporary throttles. Model outputs remain stochastic; these checks establish the tested behavior, not a guarantee for every future answer.
