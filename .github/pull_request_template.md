<!--
Every section below is required. A reviewer who did not write this code decides
merge / no-merge from this body alone, so write for that reader.

Rules:
- Claims need evidence. "Tests pass" is not evidence; pasted command output is.
- Say what you did NOT check. An honest gap is cheap; a discovered surprise is not.
- If you changed UI, behavioural evidence is required, not optional.
-->

## What this changes

Closes #<!-- issue number -->

<!-- One paragraph, plain language, no jargon. What was wrong or missing, and
     what the change does about it. A reader who has never opened this file
     should understand it. -->

## Why this way

<!-- Only if a real choice was made: what else was considered and why this won.
     If there was no choice to make, write "Only one sensible approach." -->

## Verified

<!-- Paste real output. Replace the placeholders; do not leave them. -->

```
npm --prefix app run lint   → <result>
npm --prefix app run build  → <result>
npm --prefix app test       → <result>
```

Behaviour actually observed (required if any UI changed, otherwise write "No UI change"):

<!-- What you did, and what you saw happen. Not what you expect to happen. -->

## Not verified

<!-- What a reviewer should look at with their own eyes, and any risk you are
     aware of but did not resolve. Write "Nothing" only if that is true. -->

## Scope

- [ ] Touches `app/` only — not `src/core`, not `preview/`, not repo root
- [ ] No unrelated file changed (no drive-by reformatting, no dependency bumps)
- [ ] Tests added for the behaviour this adds, or a stated reason none apply
- [ ] Commit subject carries the role tag (`[coder]` / `[fixer]`)
