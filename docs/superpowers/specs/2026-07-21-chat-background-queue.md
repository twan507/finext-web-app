# Chat chạy nền + hàng đợi per-user — Spec (2026-07-21)

## Mục tiêu
Khi user rời trang/tắt tab giữa lúc agent trả lời, **turn vẫn chạy tiếp trên BE tới hết và ghi câu trả lời vào DB** (thay vì cancel + mất như hiện tại). Mỗi user chỉ 1 turn chạy đồng thời; câu gửi thêm khi đang bận thì **xếp hàng FIFO (tối đa 3)**. FE quay lại chỉ hiển thị "đang suy nghĩ" + đọc DB.

## Hiện trạng (điểm sửa)
`routers/chat.py::_event_stream`: khi `request.is_disconnected()` → `finally: task.cancel()` → `_produce` vào `except CancelledError` → **KHÔNG** `_persist_answer` → mất câu dở. Cần đổi: disconnect KHÔNG cancel; turn chạy nền tới hết + persist.

## Quyết định owner (đã chốt)
1. **FE khi quay lại**: chỉ đọc DB; nếu tin cuối là user chưa có assistant reply → hiện indicator "đang suy nghĩ" mặc định (giống lúc chờ ban đầu) + **poll** DB tới khi có reply. KHÔNG cần reconnect SSE nhả chữ live.
2. **Hàng đợi**: tối đa **3** câu chờ/user; vượt → báo "đang bận, thử lại sau".
3. **In-memory**: registry per-user trong RAM; server restart → mất turn đang chạy + đang chờ (câu đã xong vẫn trong DB). Chấp nhận.

## Thiết kế BE
### Registry per-user (in-memory, module-level, có lock)
```
_runners: dict[user_id, UserRunner]
UserRunner = { current: asyncio.Task | None, queue: deque[QueuedTurn] (maxlen kiểm tay = 3) }
QueuedTurn = { body: ChatStreamRequest, conversation_id, is_new }
```
- Cap ĐỒNG THỜI = 1 task/user; queue tối đa 3.

### Luồng /stream (POST)
1. check_quota (giữ nguyên) → 429/503 nếu chặn.
2. `start_turn` lưu user-msg + conversation_id (giữ nguyên).
3. Lấy/ tạo UserRunner cho user (dưới lock):
   - **Rảnh** (`current is None`): tạo detached task chạy turn (xem dưới), gán `current`. SSE relay LIVE từ frame-queue của turn này (như hiện tại).
   - **Bận** (`current` đang chạy): nếu `len(queue) < 3` → enqueue QueuedTurn; SSE trả 1 frame `queued` (báo "đang xếp hàng, sẽ xử lý sau") rồi kết thúc stream (FE poll DB). Nếu `queue` đầy (3) → raise HTTPException 429 "Đang bận, thử lại sau."
4. FE (khi rảnh) nhận SSE live như cũ; khi disconnect → KHÔNG cancel (xem task lifecycle).

### Turn task (detached background)
- Chạy `_produce` (build gateway/system/run_agent/emit) → ghi frame vào turn frame-queue (cho SSE relay) + collector.
- **Khi FE disconnect: KHÔNG cancel** — task cứ chạy tới hết. `_persist_answer` ghi DB (nhánh `else`, như hiện tại nhưng nay luôn tới đích).
- Xong turn (persist xong) → dưới lock: pop QueuedTurn kế trong queue của user → chạy tiếp (gán `current`); nếu queue rỗng → `current=None`, xoá runner nếu rỗng hẳn.
- Giữ nguyên cầu dao `MAX_TURN_TOKENS` (1 turn không vô hạn) + circuit breakers.
- Lỗi trong turn: log + vẫn dequeue tiếp (không kẹt hàng đợi).

### SSE relay tách khỏi task lifecycle
- Hiện `_event_stream` tạo task + relay + finally cancel. Đổi: task thuộc registry (không do generator sở hữu); generator chỉ **relay** frame từ turn frame-queue tới khi disconnect/STREAM_END. **Bỏ `task.cancel()`** ở finally. Khi user rảnh và turn chạy: generator relay live. Khi turn được lấy từ queue (user đã rời): không có SSE nào relay — task vẫn chạy + persist.
- Cần cơ chế frame-queue cho phép relay live cho turn hiện tại (multi tab hiếm — chấp nhận: turn frame-queue single-consumer; nếu không consumer thì task vẫn chạy, frame drop, cuối cùng persist DB).

### Test BE (pytest, reverse-check)
- Disconnect giữa chừng → task KHÔNG bị cancel → `_persist_answer` được gọi → assistant reply có trong DB.
- Gửi turn khi đang bận → enqueue; turn hiện xong → turn kế tự chạy (FIFO).
- Queue đầy (3) → turn thứ 4 bị 429.
- Turn nền lỗi → dequeue tiếp không kẹt.
- Dùng fake mongo + fake adapter (echo) để không gọi LLM thật.

## Thiết kế FE
- `/chat/{id}` load: đọc messages từ DB (đã có). Nếu **tin cuối = user, chưa có assistant reply sau nó** → coi như turn đang chạy nền → render indicator "đang suy nghĩ" mặc định (tái dùng component chờ hiện có) + **poll** GET messages mỗi ~2.5s cho tới khi assistant reply xuất hiện → render + dừng poll.
- Luồng gửi mới (khi rảnh) vẫn dùng SSE live như cũ.
- Khi nhận frame `queued` từ SSE (đang xếp hàng) → hiện "đang suy nghĩ" + poll (giống trên). Khi 429 bận → toast "đang bận, thử lại sau".
- KHÔNG dựng lại nhả chữ live cho câu chạy nền (owner OK "đang suy nghĩ").

## Ngoài phạm vi
- Bền qua restart (cần worker/queue riêng) — KHÔNG làm.
- Multi-tab relay đồng thời cùng turn — không đảm bảo nhả chữ live ở tab thứ 2; đọc DB khi xong.
