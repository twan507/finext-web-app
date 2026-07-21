# Project Context

Finext là web application full-stack phân tích và sàng lọc chứng khoán Việt Nam.

## Stack

- Backend: Python 3.13+, FastAPI 0.115+, Pydantic v2, Motor/PyMongo, UV.
- Frontend: Next.js 15.5 App Router, React 19, TypeScript 5.7 strict, MUI 7.
- Database: MongoDB standalone. Các vùng dữ liệu chính là `user_db`, `stock_db`, `ref_db` và `agent_db`.
- Realtime: SSE trên polling MongoDB; Mongo standalone không có change streams.
- Infrastructure: Docker Compose với `nginx`, `fastapi`, `nextjs`; MongoDB chạy ngoài Compose.
- AI runtime: Finext AI nằm trong backend hiện có, dùng provider adapter + policy-gated read-only gateway; không có container agent riêng.

## Project Structure

```text
/
├── finext-fastapi/
│   ├── app/
│   │   ├── routers/       # HTTP/SSE endpoints
│   │   ├── schemas/       # Pydantic DTOs
│   │   ├── crud/          # Business logic và Mongo queries
│   │   ├── auth/          # JWT, current user, RBAC dependencies
│   │   ├── core/          # Config, database, scheduler, seeding
│   │   └── agent/         # Loop, adapters, gateway, tools, runtime KB
│   └── tests/
├── finext-nextjs/
│   ├── app/               # (auth), (main), admin, auth/google
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── theme/
├── docs/
│   ├── architecture/      # Tài liệu hiện hành
│   ├── finext_agent/      # Thiết kế/trạng thái Finext AI
│   └── superpowers/       # Specs/plans có ngày, giữ như lịch sử
├── nginx/
├── docker-compose.yml
└── readme.md
```

## Source Of Truth

Khi tài liệu mâu thuẫn:

1. Ưu tiên code và config hiện tại.
2. Sau đó dùng `docs/architecture/` và phần cập nhật mới nhất trong `docs/finext_agent/00-web-roadmap.md`.
3. `docs/superpowers/specs/`, `docs/superpowers/plans/` và `.superpowers/sdd/` là hồ sơ theo thời điểm; không suy ra trạng thái hiện tại chỉ từ một plan cũ.
4. Các file `finext-fastapi/app/agent/kb/*.md` là runtime Knowledge Pack, tức một phần hành vi production chứ không chỉ là tài liệu tham khảo.

Trạng thái auth hiện tại: Google OAuth và đăng ký tự xác thực OTP đang bật. Routes bị block chỉ còn `/open-account` và `/profile/subscriptions`.

## Verification Baseline

```bash
# Backend
cd finext-fastapi
uv run pytest

# Frontend
cd finext-nextjs
npx tsc --noEmit
npm test
```

Không chạy `next build` đồng thời với dev server đang dùng cùng thư mục `.next`. Repository chưa có CI workflow hay Playwright E2E suite/config hoàn chỉnh; không được báo “CI xanh” nếu chỉ chạy kiểm tra local.

---

# Core Principles (Karpathy-style)

Nền tảng hành vi áp dụng cho **mọi task**, trước khi đi vào protocol cụ thể bên dưới.
Tradeoff: bias theo hướng cẩn trọng hơn tốc độ. Với task nhỏ, dùng judgment.

## 1. Think Before Coding

**Không giả định. Không giấu sự mơ hồ. Nêu rõ tradeoff.**

Trước khi implement:
- Nêu assumption của bạn một cách explicit. Nếu không chắc, hãy hỏi.
- Nếu có nhiều cách hiểu, trình bày tất cả — không tự chọn trong im lặng.
- Nếu có cách đơn giản hơn, nói ra. Push back khi hợp lý.
- Nếu có điều không rõ, dừng lại. Gọi tên điều đó. Hỏi.

## 2. Simplicity First

**Ít code nhất để giải quyết vấn đề. Không viết thứ suy đoán.**

- Không thêm feature ngoài phạm vi yêu cầu.
- Không abstraction cho code chỉ dùng 1 lần.
- Không "flexibility" hay "configurability" không được yêu cầu.
- Không error handling cho tình huống không thể xảy ra.
- Nếu viết 200 dòng mà có thể 50, viết lại.

Tự hỏi: "Senior engineer có nói cái này over-complicated không?" Nếu có, đơn giản hóa.

## 3. Surgical Changes

**Chỉ chạm cái bắt buộc phải chạm. Chỉ dọn dẹp thứ chính mình bày ra.**

Khi sửa code hiện có:
- Không "cải thiện" code, comment, hoặc formatting xung quanh.
- Không refactor thứ không hỏng.
- Theo style hiện có, dù bạn sẽ viết khác.
- Nếu thấy dead code không liên quan, nhắc — đừng xóa.

Khi thay đổi của bạn tạo ra orphan:
- Xóa import/variable/function mà thay đổi CỦA BẠN làm unused.
- Không xóa dead code đã tồn tại từ trước trừ khi được yêu cầu.

Test: Mỗi dòng đã sửa phải truy ngược được về yêu cầu của user.

## 4. Goal-Driven Execution

**Định nghĩa success criteria. Lặp cho đến khi verified.**

Biến task thành goal có thể verify được:
- "Add validation" → "Viết test cho invalid input, rồi làm nó pass"
- "Fix the bug" → "Viết test tái hiện bug, rồi làm nó pass"
- "Refactor X" → "Đảm bảo test pass cả trước và sau"

Với task nhiều bước, nêu plan ngắn:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Success criteria mạnh cho phép loop độc lập. Criteria yếu ("làm nó work") cần liên tục clarify.

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
