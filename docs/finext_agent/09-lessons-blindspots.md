# 09 — Bài Học Từ Hệ Thống Thực Tế & Những Điều Chưa Lường Tới

> **Vai trò trong lộ trình:** file "quét điểm mù" — đối chiếu thiết kế của mình với các hệ thống chat AI đã chạy production (ChatGPT, Claude, thực tiễn LLM observability) và pháp lý VN, ghi lại những thứ CHƯA có trong các file 00-08, kèm quyết định làm/không-làm và làm ở đâu.
> Nghiên cứu 2026-07-12. Mỗi mục có nhãn: 🔴 phải làm trước go-live · 🟡 nên làm sớm sau go-live · ⚪ ghi nhận, làm khi có nhu cầu thật.

---

## 1. Bảng Tổng — điểm mù → quyết định

| # | Điểm mù | Nhãn | Quyết định | File bị ảnh hưởng |
|---|---------|------|-----------|-------------------|
| 1 | **Nghị định 13/2023/NĐ-CP** — chat log + memory = dữ liệu cá nhân; gửi chat sang nhà cung cấp AI (bất kỳ nhà nào — đều là bên xử lý nước ngoài) | 🔴 | consent modal lần đầu + cập nhật privacy policy + minimize dữ liệu gửi đi (§2) | 04, 06, 08 |
| 2 | **Feedback loop 👍👎** — không có thì không biết agent trả lời tệ ở đâu để sửa pack | 🔴 (rẻ, giá trị lớn) | thumbs up/down + lý do 1 chạm, gắn vào `message_id` (§3) | 03 (schema), 04 (UI), 07 (dùng số liệu) |
| 3 | **Provider rate limit / overload (429, 529)** — nhóm chat đồng thời có thể chạm RPM/TPM tier thấp | 🔴 | retry-backoff trong adapter + thông báo FE tử tế; kiểm tra tier account trước go-live (§4) | 02 |
| 4 | **Model deprecation lifecycle** — Anthropic deprecate model đều đặn (Opus 4.1, Sonnet 4 đã deprecated/retired) | 🟡 | pin model id đầy đủ + lịch review quý + eval lại khi đổi model (§5) | 05, 07 |
| 5 | **Pack/prompt version gắn vào từng message** — không có thì không so được chất lượng trước/sau khi sửa pack | 🟡 | thêm `meta.pack_version` vào `chat_messages` (§3) | 03, 08 |
| 6 | **Memory cần toggle TẮT + chỉ báo "đã ghi nhớ"** — chuẩn UX từ ChatGPT memory | 🟡 | bổ sung vào thiết kế memory (§6) | 08 |
| 7 | **Empty state + suggested prompts** — màn hình trắng là nơi user bỏ đi | 🟡 | 3-4 câu gợi ý sinh từ briefing ngày (§7) | 04 |
| 8 | **Câu hỏi trùng lặp hàng ngày** ("thị trường hôm nay?") đốt tool call giống nhau | ⚪ | KHÔNG build answer-cache; dạy pack trả lời từ briefing không cần tool (§7) | pack |
| 9 | **Resumable stream** (OpenAI background mode) khi user refresh giữa chừng | ⚪ | giữ quyết định không-resume của file 04 R3; ghi upgrade path (§8) | 04 |
| 10 | **Observability chuyên dụng** (Langfuse/LangSmith self-host) | ⚪ | log-based trước (file 05 §6 đủ cho quy mô nhóm); Langfuse chỉ khi VPS có RAM + user tăng bậc (§8) | 05 |

---

## 2. 🔴 Pháp Lý Dữ Liệu Cá Nhân — Nghị định 13/2023/NĐ-CP (điểm mù lớn nhất)

**Vấn đề:** [NĐ 13/2023](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-13-2023-ND-CP-bao-ve-du-lieu-ca-nhan-465185.aspx) (hiệu lực 01/07/2023) yêu cầu: thông báo rõ mục đích thu thập/xử lý + có sự đồng ý; lưu trữ đúng thời gian với mục đích; bảo mật + giới hạn truy cập. Chat log của agent chứa những gì user gõ — thực tế nhóm NĐT sẽ gõ **vị thế, số vốn, kế hoạch tài chính cá nhân** → dữ liệu cá nhân, có phần nhạy cảm. Và mỗi lượt chat, nội dung được gửi sang **Anthropic API (bên xử lý thứ 3, ngoài lãnh thổ VN)** — điểm chưa từng xuất hiện trong bất kỳ doc nào trước.

Việc phải làm (mức nội bộ invite-only — tương xứng, không over-engineer):

1. **Consent modal lần đầu vào `/assistant`** (1 lần/user, lưu cờ): nói rõ 4 điều — (a) hội thoại được lưu để hiển thị lịch sử **và đội ngũ Finext có thể xem để đảm bảo chất lượng** (điều kiện của admin review — file 08 §3); (b) nội dung chat được gửi tới nhà cung cấp AI bên thứ ba (nêu tên nhà đang dùng — cập nhật khi đổi provider) để tạo câu trả lời; (c) đừng nhập thông tin định danh nhạy cảm (CMND, tài khoản ngân hàng); (d) thông tin tham khảo, không phải khuyến nghị đầu tư. Nút "Đồng ý & bắt đầu".
2. **Cập nhật `/policies/privacy`** thêm mục AI assistant (trang đã có sẵn — sửa content).
3. **Minimize dữ liệu gửi đi:** payload sang provider CHỈ gồm nội dung chat + dữ liệu thị trường — **không bao giờ** đính email/tên/user_id thật vào prompt (user_id chỉ sống trong JWT/context server). Kiểm bằng test: dump request body, grep PII.
4. **Retention thành chính sách viết ra:** prune 50 hội thoại/user (file 08 §5) + quota 90 ngày chính là "lưu đúng thời gian với mục đích" — ghi rõ vào privacy policy để khớp luật.
5. **Quyền xoá:** user xoá hội thoại = xoá thật (file 03 R4) + xoá tài khoản kéo theo 5 collection agent (file 08 §7) — đã thiết kế, giờ có thêm lý do pháp lý.
6. ⚪ Khi mở rộng ra ngoài nhóm thân thiết / bắt đầu thu phí: cân nhắc hồ sơ đánh giá tác động xử lý dữ liệu (DPIA) + đánh giá chuyển dữ liệu ra nước ngoài theo NĐ 13 — gộp vào cùng đợt tham vấn luật sư đã ghi ở file 06 §3.

*Lưu ý: chính sách "không train trên API data" phải **verify cho TỪNG provider** trước khi trỏ production (đa số API thương mại lớn mặc định không train, nhưng không phải tất cả — đặc biệt các nhà giá rẻ). Đây là tiêu chí chọn model #4 ở file 03 §3; ghi rõ vào privacy policy và cập nhật khi đổi nhà.*

## 3. 🔴 Feedback Loop — thứ mọi hệ thống production đều có mà thiết kế mình đang thiếu

Bài học chuẩn ngành: gắn feedback (explicit: 👍👎; implicit: bấm "thử lại", copy text) vào **đúng trace/message sinh ra nó** — đây là nguồn dữ liệu số 1 để biết sửa pack chỗ nào ([Vellum](https://www.vellum.ai/blog/a-guide-to-llm-observability), [Comet](https://www.comet.com/site/blog/llm-observability/)).

Thiết kế tối giản cho Finext:

```jsonc
// thêm vào user_db.chat_messages (assistant msg):
"feedback": { "rating": 1 | -1, "reason": "sai_so_lieu" | "khong_tra_loi_dung_cau" | "cham" | "khac", "at": ISODate }
// thêm (từ điểm mù #5):
"meta": { "pack_version": "v2.1", "model": "claude-sonnet-5", "gateway_policy_version": 3 }
```

- FE: 2 icon nhỏ dưới mỗi bubble assistant; bấm 👎 hiện 4 chip lý do (1 chạm, không form). REST thường `POST /chat/messages/{id}/feedback`.
- Implicit signals ghi tự động: `retried: true` khi user bấm thử lại sau message đó.
- Khai thác (file 07 §5): mỗi tuần grep message 👎 + lý do + `pack_version` → sửa pack có địa chỉ, và so tỷ lệ 👎 giữa 2 pack version = A/B thô nhưng đủ dùng ở quy mô nhóm.
- Vì sao 🔴: thêm SAU go-live là mất trắng dữ liệu của giai đoạn học nhiều nhất (vòng 1-2).

## 4. 🔴 Provider Rate Limit & Overload

Điều chưa lường: MỌI provider đều có rate limit (RPM/TPM theo tier account) và lỗi quá tải (`429`, Anthropic còn có `529 overloaded`). Nhóm 10 người chat cùng lúc buổi tối sau EOD là burst thật.

- Adapter xử lý `429/5xx`: retry với exponential backoff (tối đa 2 lần, CHỈ khi chưa nhả token nào — nhất quán file 02 §6); hết retry → `error` event message tử tế: "Hệ thống AI đang quá tải, thử lại sau ít phút".
- **Trước go-live:** kiểm tra tier/limits của account provider đã chọn — tier khởi điểm thường không đủ TPM cho burst nhóm; nâng tier là việc hành chính, làm trước còn hơn phát hiện tối go-live.
- Metric thêm vào file 07 §3: tỷ lệ lỗi 429/5xx từ provider (phân biệt với 429 quota nội bộ).

## 5. 🟡 Model Lifecycle — model sẽ bị khai tử dưới chân mình (mọi nhà đều vậy)

Vòng đời model là thật ở mọi provider (VD Anthropic: Opus 4.1 deprecated, Sonnet 4 retired; OpenAI/Google cũng khai tử model đều đặn). Model đang dùng hôm nay sẽ có ngày nhận thư deprecation — và với chiến lược vendor-free thì tần suất "cân nhắc đổi model" còn cao hơn (đổi vì giá/chất lượng chứ không chỉ vì bị ép).

- Pin model id đầy đủ trong env (không dùng alias "latest" của bất kỳ nhà nào).
- Lịch review quý (file 07 §5): check trang deprecation + bảng giá của provider đang dùng.
- **Đổi model/provider = bắt buộc chạy lại eval smoke (file 07 §2) trước khi trỏ production** — model mới/nhà mới không đồng nghĩa tốt hơn cho use case tiếng Việt + viết query Mongo; `meta.model` trong message (§3) cho phép so chất lượng trước/sau. Đây là "chi phí thật của tự do vendor-free" — chấp nhận và quy trình hoá, không né được.

## 6. 🟡 Memory — chuẩn hoá theo bài học ChatGPT

Đối chiếu [thiết kế memory của ChatGPT](https://openai.com/index/memory-and-new-controls-for-chatgpt/) ([FAQ](https://help.openai.com/en/articles/8590148-memory-faq)) với file 08 §4 — thiết kế của mình đã đúng hướng (user xem/sửa/xoá, extraction tách khỏi hội thoại), bổ sung 3 điều production đã chứng minh cần:

1. **Toggle tắt cá nhân hoá** per-user (trong drawer "Cá nhân hoá"): tắt → không nhúng profile/notes vào prompt + không chạy extraction. Bắt buộc có từ ngày đầu của Tầng 2 — vừa UX chuẩn vừa khớp tinh thần "đồng ý" của NĐ 13.
2. **Chỉ báo "Đã ghi nhớ"** — khi extraction sinh note mới, hội thoại kế tiếp hiện chip nhỏ "Đã cập nhật ghi nhớ · Xem" trỏ vào drawer. Không có nó user không biết máy đang nhớ → mất lòng tin khi phát hiện.
3. **Danh mục cấm ghi nhớ** trong prompt extraction: không lưu thông tin định danh (số giấy tờ, tài khoản NH), tình trạng sức khoẻ, hay bất kỳ thứ gì ngoài phạm vi đầu tư — ChatGPT làm chính xác điều này ("sensitive info excluded unless explicitly asked").

## 7. 🟡 UX Nhỏ Mà Hệ Thống Thật Nào Cũng Có (bổ sung vào file 04)

- **Empty state:** logo + 3-4 **suggested prompts sinh từ briefing ngày** ("Thị trường đang ở pha nào?", "Có tin gì về {mã hot nhất hôm nay}?", "Danh mục của tôi hôm nay ra sao?" nếu có watchlist) — chip bấm là gửi. Server trả kèm trong `GET /conversations` hoặc endpoint config nhỏ.
- **Nút copy** trên bubble assistant (NĐT sẽ paste vào Zalo nhóm — chấp nhận thực tế đó, xem như kênh lan truyền).
- **"AI có thể nhầm lẫn — kiểm tra số liệu quan trọng"** 1 dòng cạnh disclaimer đầu tư (chuẩn ngành, giảm kỳ vọng sai).
- **Regenerate** = đã có qua "Thử lại"; không cần nút riêng ở v1.
- **Câu hỏi trùng hàng ngày:** KHÔNG build answer-cache (độ phức tạp invalidation không đáng ở quy mô này); thay vào đó pack dạy: câu tổng quan thị trường trả lời TRỰC TIẾP từ briefing_core + market_phase trong context, không cần gọi thêm tool → tự nhiên rẻ cho chính các câu phổ biến nhất.

## 8. ⚪ Ghi Nhận — không làm v1, để sẵn đường

| Thứ | Vì sao chưa | Upgrade path khi cần |
|---|---|---|
| Resumable stream (kiểu OpenAI background mode: server chạy tiếp, client poll lại) | phức tạp đáng kể; message partial + "Thử lại" đủ cho nhóm nội bộ | tách agent task khỏi request lifecycle (chạy trong task registry, stream = view vào task) — kiến trúc queue per-request hiện tại cho phép nâng mà không đập lại |
| Langfuse/LangSmith self-host | thêm container + Postgres trên VPS đang kín RAM; log-based (file 05 §6) đủ điều tra ở quy mô nhóm | khi user tăng bậc hoặc chuyển VPS: Langfuse self-host, point adapter emit trace — code đã có `request_id` xuyên suốt nên gắn vào là chạy |
| Đánh giá tự động (LLM-as-judge trên sample traffic) | eval tay + feedback 👍👎 đủ ở quy mô này | promptfoo/script chạy bộ eval §2 file 07 định kỳ khi pack đổi thường xuyên |
| Multi-conversation summarize (nén history dài) | cửa sổ 10 message + hội thoại ngắn là đủ | thêm bước summarize khi `msg_count > N` — chỉ đụng `build_history()`, không đụng kiến trúc |

---

## 9. Việc Cập Nhật Ngược Vào Các File Khác — ✅ ĐÃ ĐỒNG BỘ (audit 2026-07-12)

- ✅ File 08 §3: field `feedback` + `meta{pack_version, model, gateway_policy_version}` + `retried` trong schema `chat_messages`.
- ✅ File 04 §5/§7: consent modal · empty state + suggested prompts · feedback 👍👎 · nút copy · dòng "AI có thể nhầm lẫn".
- ✅ File 02 §6: adapter retry-backoff 429/5xx.
- ✅ File 06 §3: tham chiếu NĐ 13/2023.
- ✅ File 07 §3/§5: metric lỗi provider + tỷ lệ 👎 theo pack_version + quy trình "1 chính + 1 dự phòng đã eval" + review quý.

*Nguồn tham khảo chính: [OpenAI Memory](https://openai.com/index/memory-and-new-controls-for-chatgpt/) · [Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) · [Vellum LLM Observability](https://www.vellum.ai/blog/a-guide-to-llm-observability) · [Comet LLM Observability](https://www.comet.com/site/blog/llm-observability/) · [NĐ 13/2023/NĐ-CP](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-13-2023-ND-CP-bao-ve-du-lieu-ca-nhan-465185.aspx) · [Pháp lý chatbot AI VN](https://nkk.com.vn/vi/lap-trinh-chatbot-ai-phap-ly-va-bao-mat-du-lieu/) · [Anthropic Pricing/Deprecations](https://platform.claude.com/docs/en/about-claude/pricing)*
