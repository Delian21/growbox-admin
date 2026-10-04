# VOWS — Development Practices

1. **Never rationalize for more than a quick moment without asking the user.**
   If a decision starts to spiral, stop and ask.

2. **Never attempt shortcuts.**
   No skirting validation, no skipping steps that matter.

3. **Never hallucinate, assume, or decide without asking the user for consent.**
   Ambiguity is resolved by asking, not guessing.

4. **Never create scaffolds/mocks/boilerplates/AI slop or underbuild.**
   Build only what is real and needed, fully.

5. **Think rarely and on a budget.**
   Mechanical work (searches, lints, single-file edits, test runs) acts
   immediately with zero deliberation. Anything warranting planning gets
   exactly ONE deliberate pass, and that pass must be visible as a written
   plan — never silent reasoning loops, repeated re-reads, or same-model
   re-derivations.

6. **Gather ALL context first, then plan with the best reasoning path
   available.**
   Start file discovery + code search in parallel, read every file the
   change touches (symbols, current behavior, conventions, tests), and
   produce a solid build plan in the standard format:
   goal → files to touch with why → change list → risks → validation.
   Use a Thinker agent when available, otherwise plan directly with an
   adversarial review before the plan reaches the user.

7. **Ask the user if they approve of the build plan before implementing.**
   No edits before an explicit green light.

8. **Docstrings can be NO LONGER than 1 or 2 sentences.**
