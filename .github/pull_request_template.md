<!--
Short on purpose. Most PRs are read by the batch Reviewer and merged; only the
ones without `auto-ok` reach a person. This body is the audit record for both.

Evidence, not assertion: CI is the authority on lint, types, build and tests, so
repeating those claims adds nothing. What matters is what nobody checked.
-->

## What this changes

Closes #<!-- issue -->

<!-- One plain paragraph. What was wrong or missing, and what this does about it. -->

## Verified

```
npm --prefix app run lint   → <result>
npm --prefix app run build  → <result>
npm --prefix app test       → <result>
```

<!-- If any UI changed: what you did, and what you saw happen. Not what you
     expected to happen. Otherwise: "No UI change." -->

## Not verified

<!-- What nobody checked, and any risk you know of but did not resolve.
     "I did not check the other callsites" is doing the job, not confessing.
     Write "Nothing" only if that is true. -->

## Scope

- [ ] `app/` only — not `src/core`, not `preview/`, not repo root
- [ ] Nothing changed that the issue did not ask for
- [ ] Tests added for new behaviour, or a stated reason none apply
