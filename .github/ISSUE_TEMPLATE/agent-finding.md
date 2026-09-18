---
name: Agent finding (evidence required)
about: A defect or gap found by a worker. No evidence, no task.
labels: scan:agent
---

<!--
An issue is a claim, not a fact. This template exists so the claim carries its proof at
creation time — a task without evidence gets "fixed" by a worker who cannot tell whether
it was ever real, and every gate downstream then ratifies an invention.

Delete a section only if it truly does not apply, and say why in one line.
-->

**Provenance** — who observed this, and how?
<!-- one of:
     reported:user      the user saw it (highest trust)
     measured:live      a worker observed it on a running build
     scan:agent         a code scan inferred it (a hypothesis until reproduced)
-->
- provenance:

**Evidence** — the reproduction and the observed value. This is the field that decides
whether the issue becomes a task.
- command / steps:
- observed: <!-- the actual value, DOM node, or behaviour you saw — not a description -->
- expected:
- file:line: <!-- where the code that would have to change lives -->

**RED on the parent** — how will a fix prove the defect existed? A claim nobody can make
red was never a defect.
- the test or measurement that must fail before the fix:

**Duplicate check** — output of `tools/orchestration/dupcheck.sh "<distinctive term>"`
(one line: no matches / the ids it found).

**Not verified** — anything you could not observe, with the reason. "Cannot verify" is a
legitimate result; filling the gap with a plausible guess is the one outcome the gates
cannot catch.
