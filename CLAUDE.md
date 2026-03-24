# Project Context

Web app: Python backend + TypeScript/Node.js frontend.

## Stack
- Backend: Python (FastAPI / Django — update as needed)
- Frontend: TypeScript / Node.js
- DB: [specify: PostgreSQL / MongoDB / etc.]
- Infra: [specify: Docker / K8s / etc.]

## Project Structure
```
/
├── backend/        # Python
├── frontend/       # TypeScript
├── shared/         # shared types / contracts
└── tests/
```

---

# MiniMax Working Rules

## Context Management (Critical)

**Start every session by stating the task scope explicitly.**
Bad: "fix the auth bug"
Good: "fix JWT expiry not refreshing in backend/auth/middleware.py — only touch that file"

**One task per session.** Do not chain unrelated work in the same conversation.
When a task is done, stop. Start a new session for the next task.

**Scope file reads explicitly.** Do not explore the codebase freely.
Bad: "look through the project and find..."
Good: "read backend/auth/middleware.py and backend/models/user.py, then..."

**Compact early.** Run `/compact` with instructions before context fills:
```
/compact Keep: files modified, current task state, error messages. Discard: file contents already committed, exploration history.
```
Do this after every major milestone (feature done, bug fixed), not when forced.

**When context is polluted (model repeating itself, mixing files, reverting fixes),
stop immediately. Run `/clear` and start fresh with a tight prompt.**

---

# Task Protocols

## Writing New Features

1. State the feature scope in one sentence before starting.
2. List files that will be created or modified — nothing else should be touched.
3. Write backend first, confirm it compiles/runs, then frontend.
4. Do not add unrequested features, abstractions, or "nice to haves."

Prompt template:
```
Task: [one sentence]
Files to modify: [explicit list]
Files to read for context: [explicit list — keep short]
Do NOT touch: [list anything off-limits]
```

## Debugging

1. Provide the exact error message and stack trace.
2. Point to the specific file and line number if known.
3. Do not ask the model to "look around for related issues."

Prompt template:
```
Error: [paste exact error]
File: [path:line]
Expected: [what should happen]
Actual: [what happens]
Only fix this specific error. Do not refactor surrounding code.
```

## Refactoring

Refactors must be scoped to a single module per session.
State the goal precisely: extract function / rename / split file / remove duplication.

Prompt template:
```
Refactor: [specific goal]
Scope: [file or directory only]
Constraint: behavior must not change — no new logic, no new dependencies.
```

---

# Code Constraints

## Output Formatting
- **Diff Blocks:** When modifying code, always present the detailed changes (removed and added lines) using a Markdown `diff` block directly in your response. Show the specific lines modified with `+` and `-` syntax. Do not just silently execute the edit or report "Modified X lines".

## Python
- Type hints on all function signatures.
- No bare `except:` — catch specific exceptions.
- No `print()` for debugging — use logging.
- Functions max ~40 lines. Split if longer.
- Tests go in `tests/` mirroring source structure.

## TypeScript
- `strict: true` — no `any` without explicit comment explaining why.
- No `// @ts-ignore` without explanation.
- Async functions must handle errors explicitly.
- Components max ~150 lines. Split if longer.

## Both
- Do not add dependencies without asking first.
- Do not change unrelated files.
- Do not delete commented code — mark with `# TODO: remove` instead.
- Keep diffs minimal. The smaller the change, the better.

---

# Compaction Preservation Rules

When compacting, always preserve:
- List of files modified in this session
- Current task state (done / in-progress / blocked)
- Any error messages not yet resolved
- Architectural decisions made (even if brief)
- Test commands that work

Discard:
- Full file contents already committed to disk
- Exploration steps that led nowhere
- Conversation filler

---

# Session State Tracking

At the start of each session, paste this block and fill it in:

```
## Session State
Task: 
Files in scope:
Files already modified:
Current blocker (if any):
Next step:
```

Update this block before running `/compact`.

---

# Warning Signs — Stop and Reset

If any of these happen, run `/clear` immediately:
- Model modifies a file not in the stated scope
- Model suggests adding a new dependency mid-task
- Model reverts a fix it made earlier in the same session
- Model asks a question it already answered
- Output becomes verbose and repetitive
- Test is hardcoded to pass instead of testing real logic
