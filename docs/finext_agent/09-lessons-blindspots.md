# 09 — Bài Học Từ Hệ Thống Thực Tế & Những Điều Chưa Lường Tới

> **Vai trò trong lộ trình:** file "quét điểm mù" — đối chiếu thiết kế của mình với các hệ thống chat AI đã chạy production (ChatGPT, Claude, thực tiễn LLM observability) và pháp lý VN, ghi lại những thứ CHƯA có trong các file 00-08, kèm quyết định làm/không-làm và làm ở đâu.
> Nghiên cứu 2026-07-12. Mỗi mục có nhãn: 🔴 phải làm trước go-live · 🟡 nên làm sớm sau go-live · ⚪ ghi nhận, làm khi có nhu cầu thật.
> **Đối chiếu runtime 2026-07-21:** đây là nghiên cứu/decision log có ngày. As-built đã có privacy policy Finext AI, consent ở đăng ký, feedback 👍/👎, retry provider, history/CRUD/quota và prompt gợi ý theo trang. Chưa có feedback reason UI, `meta.pack_version/model/policy_version`, memory, admin review API, quota-retention job hay resumable stream.

---

## 1. Bảng Tổng — điểm mù → quyết định

| # | Điểm mù | Nhãn | Quyết định | File bị ảnh hưởng |
|---|---------|------|-----------|-------------------|
| 1 | Dữ liệu cá nhân / provider bên thứ ba | 🔴 | ✅ policy + consent đăng ký; ❌ chưa có retention job/admin API audit | 04, 06, 08 |
| 2 | Feedback loop 👍👎 | 🔴 | ✅ rating gắn message; ❌ UI chưa thu lý do | 03, 04, 07 |
| 3 | **Provider rate limit / overload (429, 529)** — nhóm chat đồng thời có thể chạm RPM/TPM tier thấp | 🔴 | retry-backoff trong adapter + thông báo FE tử tế; kiểm tra tier account trước go-live (§4) | 02 |
| 4 | **Model deprecation lifecycle** — Anthropic deprecate model đều đặn (Opus 4.1, Sonnet 4 đã deprecated/retired) | 🟡 | pin model id đầy đủ + lịch review quý + eval lại khi đổi model (§5) | 05, 07 |
| 5 | Pack/model/policy version trên message | 🟡 | ❌ Chưa triển khai field `meta` | 03, 08 |
| 6 | **Memory cần toggle TẮT + chỉ báo "đã ghi nhớ"** — chuẩn UX từ ChatGPT memory | 🟡 | bổ sung vào thiết kế memory (§6) | 08 |
| 7 | Empty state + suggested prompts | 🟡 | ✅ Có pool tĩnh theo route/tab; không sinh từ briefing | 04 |
| 8 | **Câu hỏi trùng lặp hàng ngày** ("thị trường hôm nay?") đốt tool call giống nhau | ⚪ | KHÔNG build answer-cache; dạy pack trả lời từ briefing không cần tool (§7) | pack |
| 9 | **Resumable stream** (OpenAI background mode) khi user refresh giữa chừng | ⚪ | giữ quyết định không-resume của file 04 R3; ghi upgrade path (§8) | 04 |
| 10 | **Observability chuyên dụng** (Langfuse/LangSmith self-host) | ⚪ | dùng log/DB trước và bổ sung các metric còn thiếu ở file 05 §6; Langfuse chỉ khi VPS có RAM + user tăng bậc (§8) | 05 |

---

## 2. 🔴 Pháp Lý Dữ Liệu Cá Nhân — Nghị định 13/2023/NĐ-CP (điểm mù lớn nhất)

**Vấn đề (nhận diện 2026-07-12):** chat log có thể chứa vị thế/số vốn/kế hoạch tài chính và payload được gửi sang provider AI bên thứ ba. Snapshot `.env.production` trong workspace là MiniMax-M3, không phải Anthropic; đây không phải default code/xác nhận deploy live. Kiến trúc có thể đổi provider nên policy không được hard-code tên nhà cũ.

Việc phải làm (quy mô nhóm nhỏ/nội bộ — tương xứng, không over-engineer; registration hiện không enforce invite-only):

1. **Consent as-built:** không có modal `/chat`; form đăng ký bắt buộc checkbox đồng ý Chính sách nội dung + Bảo mật. Trang `/policies/privacy` mục 6 mô tả Finext AI.
2. **Privacy policy:** đã cập nhật nội dung chat, usage, feedback, mục đích, quyền xem/xoá và disclaimer.
3. **Minimize dữ liệu gửi đi:** payload sang provider CHỈ gồm nội dung chat + dữ liệu thị trường — **không bao giờ** đính email/tên/user_id thật vào prompt (user_id chỉ sống trong JWT/context server). Kiểm bằng test: dump request body, grep PII.
4. **Retention:** prune 50 hội thoại không-ghim đã có. Policy ghi usage khoảng 90 ngày nhưng runtime `chat_quota` chỉ giữ một doc/user và **chưa có job prune**; cần thống nhất lại policy/code.
5. **Quyền xoá:** user xoá hội thoại = xoá thật (file 03 R4) + xoá tài khoản kéo theo 5 collection agent (file 08 §7) — đã thiết kế, giờ có thêm lý do pháp lý.
6. Xoá tài khoản hiện chưa cascade ba collection chat; đây là gap phải xử lý nếu yêu cầu xoá toàn bộ dữ liệu.
7. ⚪ Khi mở rộng/thu phí: cân nhắc đánh giá tác động và tham vấn luật sư như file 06 §3.

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

- FE hiện có 2 icon dưới bubble assistant; gọi `PATCH /chat/messages/{id}/feedback`. Backend nhận `reason` tùy chọn nhưng UI chưa hiện chip lý do.
- Chưa có implicit field `retried` hay `meta{pack_version,model,gateway_policy_version}` trong persistence.
- Khai thác hiện tại: lọc message 👎 + lý do trong DB để sửa pack có địa chỉ. So sánh theo `pack_version` chỉ khả thi **sau khi** bổ sung field meta/version vào persistence.
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
- **Đổi model/provider = bắt buộc chạy lại eval smoke (file 07 §2) trước khi trỏ production** — model mới/nhà mới không đồng nghĩa tốt hơn cho use case tiếng Việt + viết query Mongo. Khi field `meta.model` ở §3 được triển khai mới có thể so chất lượng tự động theo model; hiện phải ghi model cùng báo cáo eval. Đây là "chi phí thật của tự do vendor-free" — chấp nhận và quy trình hoá, không né được.

## 6. 🟡 Memory — chuẩn hoá theo bài học ChatGPT

Đối chiếu [thiết kế memory của ChatGPT](https://openai.com/index/memory-and-new-controls-for-chatgpt/) ([FAQ](https://help.openai.com/en/articles/8590148-memory-faq)) với file 08 §4 — thiết kế của mình đã đúng hướng (user xem/sửa/xoá, extraction tách khỏi hội thoại), bổ sung 3 điều production đã chứng minh cần:

1. **Toggle tắt cá nhân hoá** per-user (trong drawer "Cá nhân hoá"): tắt → không nhúng profile/notes vào prompt + không chạy extraction. Bắt buộc có từ ngày đầu của Tầng 2 — vừa UX chuẩn vừa khớp tinh thần "đồng ý" của NĐ 13.
2. **Chỉ báo "Đã ghi nhớ"** — khi extraction sinh note mới, hội thoại kế tiếp hiện chip nhỏ "Đã cập nhật ghi nhớ · Xem" trỏ vào drawer. Không có nó user không biết máy đang nhớ → mất lòng tin khi phát hiện.
3. **Danh mục cấm ghi nhớ** trong prompt extraction: không lưu thông tin định danh (số giấy tờ, tài khoản NH), tình trạng sức khoẻ, hay bất kỳ thứ gì ngoài phạm vi đầu tư — ChatGPT làm chính xác điều này ("sensitive info excluded unless explicitly asked").

## 7. 🟡 UX Nhỏ Mà Hệ Thống Thật Nào Cũng Có (bổ sung vào file 04)

- **Empty state/chat bubble:** đã có suggested prompts từ pool tĩnh/page-aware ở `chatPageContext.ts`; server không trả prompt từ briefing và watchlist không nằm trong tool surface.
- **Nút copy** trên bubble assistant (NĐT sẽ paste vào Zalo nhóm — chấp nhận thực tế đó, xem như kênh lan truyền).
- **"AI có thể nhầm lẫn — kiểm tra số liệu quan trọng"** 1 dòng cạnh disclaimer đầu tư (chuẩn ngành, giảm kỳ vọng sai).
- **Regenerate** = đã có qua "Thử lại"; không cần nút riêng ở v1.
- **Câu hỏi trùng hàng ngày:** KHÔNG build answer-cache (độ phức tạp invalidation không đáng ở quy mô này); thay vào đó pack dạy: câu tổng quan thị trường trả lời TRỰC TIẾP từ briefing_core + market_phase trong context, không cần gọi thêm tool → tự nhiên rẻ cho chính các câu phổ biến nhất.

## 8. ⚪ Ghi Nhận — không làm v1, để sẵn đường

| Thứ | Vì sao chưa | Upgrade path khi cần |
|---|---|---|
| Resumable stream | chưa có; assistant partial không persist, chỉ user message còn để retry | tách agent task khỏi request lifecycle (task registry + stream/poll view) và lưu trạng thái tiến trình |
| Langfuse/LangSmith self-host | thêm container + Postgres trên VPS đang kín RAM; hiện ưu tiên log/DB và instrument thêm token/p95 theo file 05 §6 | khi user tăng bậc hoặc chuyển VPS: Langfuse self-host, point adapter emit trace — code đã có `request_id` xuyên suốt nên gắn vào là chạy |
| Đánh giá tự động (LLM-as-judge trên sample traffic) | eval tay + feedback 👍👎 đủ ở quy mô này | promptfoo/script chạy bộ eval §2 file 07 định kỳ khi pack đổi thường xuyên |
| Multi-conversation summarize (nén history dài) | cửa sổ hiện là 20 message + hội thoại ngắn là đủ | thêm bước summarize khi `msg_count > N`; runtime hiện không có `build_history()`, nên phải thêm bước nén vào store/router trước khi gọi loop |

---

## 9. Đối chiếu triển khai (audit lại 2026-07-21)

- ✅ `feedback` rating/reason có trong schema; ❌ `meta`/`retried` chưa có.
- ✅ Empty state, prompt gợi ý, feedback, copy, disclaimer; consent chuyển sang checkbox đăng ký + privacy policy, không có modal chat.
- ✅ File 02 §6: adapter retry-backoff 429/5xx.
- ✅ File 06 §3: tham chiếu NĐ 13/2023.
- 🟡 Metric/quy trình review nằm trong doc; chưa có dashboard/admin endpoint tự động theo pack version.

*Nguồn tham khảo chính: [OpenAI Memory](https://openai.com/index/memory-and-new-controls-for-chatgpt/) · [Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) · [Vellum LLM Observability](https://www.vellum.ai/blog/a-guide-to-llm-observability) · [Comet LLM Observability](https://www.comet.com/site/blog/llm-observability/) · [NĐ 13/2023/NĐ-CP](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Nghi-dinh-13-2023-ND-CP-bao-ve-du-lieu-ca-nhan-465185.aspx) · [Pháp lý chatbot AI VN](https://nkk.com.vn/vi/lap-trinh-chatbot-ai-phap-ly-va-bao-mat-du-lieu/) · [Anthropic Pricing/Deprecations](https://platform.claude.com/docs/en/about-claude/pricing)*
