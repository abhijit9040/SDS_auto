# PROJECT BUILD PIPELINE

> **Work on ONE stage at a time. Read PROGRESS.md first. Do not start the next stage until the user approves the gate. Update PROGRESS.md when a stage is done.**

---

## Stage 0 — Idea Brief

- **Goal:** Capture the core idea and context.
- **Output:** `BRIEF.md`
- **Gate:** The project is explainable in two sentences.

## Stage 1 — Requirements and Scope

- **Goal:** Define user stories, functional and non-functional requirements, MVP vs later vs out-of-scope, testable acceptance criteria, and open questions.
- **Output:** `SPEC.md`
- **Gate:** Every requirement is testable.

## Stage 2 — Architecture and Tech Stack

- **Goal:** Present 2 architecture options with trade-offs first, then define components, data flow, schema, API contracts, and folder structure.
- **Output:** `ARCHITECTURE.md`
- **Gate:** User agrees with every major decision.

## Stage 3 — Project Setup

- **Goal:** Scaffold the project; set up lint, format, tests, `.gitignore`, `.env.example`, and `README.md`.
- **Output:** Working scaffold with passing lint and tests.
- **Gate:** A fresh clone runs and lint/tests pass.

## Stage 4 — Plan and Task Breakdown

- **Goal:** Create an ordered checklist of tasks; each task lists files touched, dependencies, and a verification command.
- **Output:** `PLAN.md`
- **Gate:** Each task is finishable in one session.

## Stage 5 — Walking Skeleton

- **Goal:** Implement the thinnest end-to-end slice, test first.
- **Output:** Working skeleton with tests, committed.
- **Gate:** Works end to end and is committed.

## Stage 6 — Feature Loop (repeat per task)

- **Goal:** Implement one task at a time — implement, test, review diff, commit, update `PROGRESS.md`.
- **Output:** Completed task with passing tests.
- **Gate:** Tests pass, diff reviewed, committed.

## Stage 7 — Integration and Hardening

- **Goal:** Review error handling, validation, auth, logging, and security; rank gaps by severity; no code changes until user picks items.
- **Output:** Gap analysis and targeted fixes.
- **Gate:** No critical issues remain.

## Stage 8 — Testing and QA

- **Goal:** Map acceptance criteria to tests, add missing tests, report bugs before fixing.
- **Output:** Full test coverage of acceptance criteria.
- **Gate:** All acceptance criteria are covered by tests.

## Stage 9 — Refactor, Docs, Review

- **Goal:** Senior-reviewer critique of full diff; cleanup; update `README.md` and API docs.
- **Output:** Clean codebase with complete documentation.
- **Gate:** A new developer can run the project from the README alone.

## Stage 10 — Deploy and Release

- **Goal:** Deployment checklist, CI/CD config, env vars, migrations, rollback plan, smoke test, version tag.
- **Output:** Live deployment with rollback path.
- **Gate:** Live, smoke test passes, rollback path exists.

## Stage 11 — Monitor and Iterate

- **Goal:** Add logging, error tracking, metrics; write `BACKLOG.md` for v2; reset stage to 1.
- **Output:** Observability in place and `BACKLOG.md` ready.
- **Gate:** Failures are visible.
