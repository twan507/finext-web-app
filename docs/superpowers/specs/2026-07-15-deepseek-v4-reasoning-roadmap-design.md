# DeepSeek V4 migration + reasoning/model-selector — Design & Roadmap

> **Ngày:** 2026-07-15 · **Trạng thái:** brainstorm với owner xong trong phiên; chờ triển khai (owner sẽ compact rồi chạy tiếp).
> **Bối cảnh:** Agent v1 + Knowledge Pack đã xong ([[project_agent_v1_slice]], branch `feat/agent-v1-slice`, 190 test).
> Đang chạy `deepseek-chat` (V3) — output lộ ký hiệu (`VSI`, "bottom 3"), tuân K-hygiene chưa hoàn hảo.
> Reference API mới: [[reference_deepseek_v4_api]].

## 0. Phát hiện gấp (ràng buộc thời gian cứng)

**`deepseek-chat`/`deepseek-reasoner` KHAI TỬ 24/07/2026 15:59 UTC.** App đang dùng `deepseek-chat` → sau hạn là CHẾT.
→ **Phần 1 (migrate) là BẮT BUỘC, ưu tiên tuyệt đối, trước mọi thứ khác.**

## 1. Phần 1 — MIGRATE `deepseek-v4-flash` (GẤP, làm trước)

**Mục tiêu:** đổi model sang V4-flash non-thinking, app sống sau 24/07, K-hygiene được ĐO lại trên thế hệ mới.

- **Đổi env:** `LLM_MODEL=deepseek-v4-flash` (`.env.development` + `.env.production`). `base_url` giữ nguyên
  (`https://api.deepseek.com/v1`), OpenAI-compat như cũ.
- **Thêm `temperature: 0.2`** vào adapter payload (non-thinking hỗ trợ temperature; agent tài chính cần số ổn định +
  tuân luật ổn định). Configurable qua env `LLM_TEMPERATURE` (default 0.2).
- **Verify tool-calling còn chạy:** V4-flash có thể stream tool-call khác chút → chạy lại verify DeepSeek thật (như
  mốc Task 9 lát cắt: "FPT giá" + phase + HPG định giá) + bắt fixture bytes mới nếu format đổi.
- **ĐO K-hygiene:** chạy đúng 3 câu lộ lỗi (VSI, bottom-3) → xem V4-flash non-thinking đã tự dịch ký hiệu chưa.
  Đây là **dữ liệu quyết định** có cần Phần 2 (thinking) hay không. GHI kết quả vào ledger.
- **Rủi ro:** thấp (chỉ đổi model name + 1 param). Nếu tool-call format V4 khác → sửa adapter parse (đã có test fixture pattern).

## 2. Phần 2 — THINKING mode (làm NẾU Phần 1 đo thấy K-hygiene chưa đủ)

**Quyết định dựa trên dữ liệu Phần 1, KHÔNG làm mù.** Nếu V4-flash non-thinking đã tuân tốt → BỎ QUA phần này.

Nếu cần thinking (`v4-flash` hoặc `v4-pro`):
- **Adapter:** thêm `"thinking": {"type": "enabled"}` + `"reasoning_effort": "high"` (configurable env `LLM_THINKING`,
  `LLM_REASONING_EFFORT`). Khi thinking bật → BỎ `temperature` (V4 không hỗ trợ trong thinking mode — docs).
- **Đọc `reasoning_content`:** stream trả riêng (`delta.reasoning_content`). Adapter hiện chỉ đọc `delta.content`.
- **⚠ BREAKING — loop pass-back reasoning_content:** khi `finish_reason=tool_calls`, `reasoning_content` của lượt đó
  PHẢI được gửi lại trong messages các vòng sau (docs V4). `loop._assistant_tool_message` hiện KHÔNG mang
  reasoning_content → thinking + tool-calling nhiều vòng SẼ HỎNG nếu không sửa. Đây là công việc chính của Phần 2.
- **Test:** ScriptedAdapter mô phỏng reasoning_content + tool round-trip; verify DeepSeek thật thinking + tool.

## 3. Phần 3 — ROADMAP sau (brainstorm riêng khi tới, KHÔNG làm giờ)

### 3.1 Hiển thị chuỗi suy nghĩ (CoT) cho khách
- Kỹ thuật: adapter emit `reasoning_content` thành event SSE mới (vd `reasoning`) → FE hiển thị khối "đang suy nghĩ"
  collapsible như ChatGPT/Claude. Contract SSE hiện 6 event → thêm 1 event = bump version 2 phía.
- **⚠⚠ RỦI RO K-HYGIENE NGHIÊM TRỌNG (chốt để KHÔNG lỡ tay):** CoT là nơi model lý luận bằng KÝ HIỆU THÔ trước khi
  K-hygiene hoá (nó viết "vsi 2.5", "breadth_slow -0.57 dưới ngưỡng", và có thể SUY ĐOÁN công thức/tiêu chí xếp hạng
  của hệ — thứ pack `system_prompt` 8.5 + `agent_db_06` cấm TUYỆT ĐỐI lộ vì là bí mật sản phẩm Finext). K-hygiene chỉ
  áp cho câu trả lời cuối, KHÔNG áp cho CoT. **Stream CoT thô ra khách = phơi bí mật know-how.** Ba lối ra:
  (a) chỉ hiện indicator generic "Đang phân tích…" (an toàn, mất "thấy suy nghĩ"); (b) lọc/tóm tắt CoT qua 1 lượt
  model K-hygiene hoá (đắt/phức tạp); (c) chấp nhận lộ — KHÔNG khuyến nghị. **Phải chọn (a) hoặc (b) trước khi bật CoT display cho production.**

### 3.2 Model selector cho khách (think/không · flash/pro)
- FE selector + BE nhận param model/mode per-request + quota/chi phí RIÊNG theo model (pro đắt hơn flash nhiều lần —
  để khách tự chọn pro+thinking mọi câu = cháy token) + guard theo **tier hội viên** (gói cao mới được pro/thinking).
- Thuộc mảng persistence/quota/FE của roadmap — làm khi tới bước đó. Selector cũng là nơi quyết định thinking on/off
  per-request (thay vì global env).

## 4. Thứ tự thực thi (điểm khởi động sau compact)
1. **NGAY:** Phần 1 migrate v4-flash + temperature 0.2 + verify + đo K-hygiene (plan: `2026-07-15-deepseek-v4-migration.md`).
2. Đọc kết quả đo → quyết Phần 2 (thinking) có cần không.
3. Phần 2 nếu cần (sửa adapter + loop reasoning_content).
4. Phần 3 (CoT display + selector) → brainstorm riêng khi tới bước FE/quota.

## 5. Ngoài phạm vi ngay
- Model selector UI, quota per-model, tier gating (roadmap FE/persistence).
- CoT display (cần giải rủi ro K-hygiene trước).
- Web search tool (task riêng đã note ở spec pack).
