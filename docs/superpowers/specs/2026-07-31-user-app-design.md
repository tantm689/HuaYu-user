# Thiết kế User App (ôn tập "Đương Đại") — v1

Ngày: 2026-07-31
Trạng thái: Đã chốt chức năng, chưa bàn UI (UI sẽ có spec/bàn riêng sau).
Kế thừa từ: `TaiwaneseEasy-admin/docs/superpowers/specs/2026-07-28-full-product-design.md` mục 4/6/7/8 (điều hướng, flashcard, shadowing, ngữ pháp, quiz, gõ phản xạ, kiến trúc, danh sách bài) — các quyết định đó được xác nhận lại và bổ sung chi tiết schema ở đây.

## 1. Bối cảnh và phạm vi

Admin CMS (`TaiwaneseEasy-admin`) đã build xong, đang publish dần các bài học của giáo trình "Đương Đại" (1/2/3) vào chung 1 Supabase project. User App là app ôn tập (không dạy lại từ đầu) cho chính người dùng đã đọc sách giấy, đọc trực tiếp dữ liệu `published` từ DB đó.

**Người dùng mục tiêu:** hiện tại chỉ 1 người dùng (chủ dự án), nhưng có ý định mở rộng thành sản phẩm nhiều người dùng sau này để tạo thu nhập. Vì vậy kiến trúc auth/data phải có khái niệm `user_id` thật ngay từ đầu, không hardcode single-user.

**Ngoài phạm vi bản v1 này** (ghi nhận, không thiết kế chi tiết ở đây):
- Subscription/gia hạn tài khoản, cron job nhắc hết hạn qua email — ý tưởng từ mentor, để làm sau khi 4 tính năng học chính đã ổn định. Không tạo bảng `subscriptions` trong migration này.
- Đợt 2 của Quiz (4 dạng "khó": tìm lỗi sai, dịch câu, phân biệt từ gần nghĩa, chọn trợ từ/lượng từ) — theo tài liệu gốc, vẫn chưa làm.
- Hoạt động lớp học, Văn hóa, bài tập gốc của sách — loại hẳn khỏi hệ thống (quyết định cũ, xem `project_book_structure_scope` memory).

## 2. Kiến trúc kỹ thuật

- **Stack:** Next.js (App Router) + TypeScript + Tailwind — giống Admin, tái dùng kinh nghiệm/pattern đã có (Supabase client setup, component style).
- **Data:** cùng 1 Supabase project với Admin. User App đọc qua **anon key + RLS**, chỉ được đọc lesson có `status = 'published'` (RLS đã có sẵn ở phía Admin). Không cần API trung gian cho dữ liệu đọc (lessons/dialogues/vocabulary/grammar/quiz_questions).
- **Auth:** Supabase Auth thật, 2 phương thức: Google OAuth **và** email/password (mentor gợi ý dùng email thật vì sau này cần gửi email tự động — nhắc gia hạn, v.v. — nên không thể chỉ dùng OAuth ẩn danh). `auth.uid()` làm khóa cho mọi bảng progress cá nhân (SRS, quiz_attempts, typing progress) qua RLS — mỗi người dùng chỉ đọc/ghi được dòng của chính mình.
- **Ghi dữ liệu progress:** User App ghi trực tiếp vào Supabase từ client (Supabase JS client, RLS chặn theo `auth.uid()`), không cần route API riêng cho các thao tác ghi đơn giản (điểm quiz, trạng thái flashcard, tiến độ gõ) — trừ khi sau này cần logic phức tạp hơn ở server (ví dụ tính SRS phức tạp hơn Leitner đơn giản).

**Trạng thái lỗi & mạng (áp dụng xuyên suốt mọi tính năng):**
- **Auth hết hạn giữa chừng:** dựa vào cơ chế auto-refresh access token có sẵn của Supabase JS client (`autoRefreshToken: true`, mặc định) — người dùng không bị gián đoạn miễn refresh token còn hợp lệ. Chỉ khi refresh token cũng hết hạn/bị thu hồi (ví dụ không mở app trong thời gian dài) thì mới redirect về trang đăng nhập, kèm thông báo ngắn giải thích lý do (không redirect câm lặng).
- **Lỗi mạng/Supabase timeout khi lưu tiến độ** (upsert `vocabulary_progress`/insert `quiz_attempts`/upsert `typing_progress` thất bại): hiện thông báo lỗi rõ ràng ("Không lưu được, kiểm tra kết nối mạng") kèm nút "Thử lại" — không âm thầm nuốt lỗi khiến người dùng tưởng đã lưu nhưng thực ra mất tiến độ. Không tự động retry ngầm (tránh double-submit nếu thao tác ghi không idempotent).
- **Audio load fail** (`dialogue_lines.audio_url`/`dialogues.audio_url`/`vocabulary.audio_url` không tải được, dùng cho Shadowing/Flashcard): hiện thông báo lỗi cục bộ (chỉ ở đúng câu/thẻ đó) kèm nút "Thử lại tải", nhưng **không chặn** toàn bộ phiên học — người dùng vẫn bấm được sang câu/thẻ tiếp theo.

## 3. Điều hướng

```
Đăng nhập (Google hoặc email/password)
  → Trang chủ
      - Khối "Ôn hôm nay": số từ vựng đến hạn ôn (SRS) gộp từ MỌI bài đã học,
        bấm vào vào thẳng phiên ôn (không cần tự chọn bài)
      - Danh sách quyển sách (Đương Đại 1/2/3) — chọn 1 quyển
  → Danh sách bài học của quyển đó (chỉ hiện bài `status = 'published'`)
  → Chọn 1 bài → Màn hình bài học, 5 khu vực/tab NGANG HÀNG, tự do bấm,
    không có flow bắt buộc:
      1. Hội thoại (Shadowing)
      2. Từ mới (Flashcard, nhóm theo dialogue)
      3. Ngữ pháp (chỉ đọc)
      4. Quiz (Phần 1 + Phần 2)
      5. Gõ phản xạ (2 tab con: Gõ từ / Gõ câu)
```

Không gộp Hội thoại+Từ mới thành luồng liền mạch (chấp nhận mất tính xen kẽ đúng sách, ưu tiên UI đơn giản) — quyết định giữ nguyên từ tài liệu gốc.

## 4. Flashcard từ vựng (SRS)

**Nguồn dữ liệu:** `vocabulary` (khóa theo `dialogue_id`, đã tách theo từng hội thoại từ Admin). Trong màn hình bài học, tab "Từ mới" nhóm các thẻ theo dialogue, đúng thứ tự sách (Từ mới I đi với Hội thoại I, v.v.).

**Thuật toán SRS — Leitner đơn giản, có trạng thái "Đang học"** (không dùng SM-2 phức tạp):
- Mỗi thẻ có 1 dòng tiến độ (bảng mới, xem mục 9.1) lưu `box` (**0-5**, 0 = "Đang học") và `due_at` (thời điểm đến hạn ôn lại).
- **Box 0 — Đang học (learning):** khi 1 thẻ được mở lần đầu (chưa có dòng tiến độ), nó vào Box 0 với `learning_streak = 0`. Trong Box 0, thẻ tiếp tục xuất hiện lặp lại cho tới khi người dùng trả lời đúng **3 lần liên tiếp** — lúc đó mới chính thức chuyển sang Box 1 (`due_at` = 1 ngày sau). Trả lời sai bất kỳ lúc nào khi đang ở Box 0 → `learning_streak` reset về 0.
  - **`learning_streak` lưu bền trong DB (cột `vocabulary_progress.learning_streak`), KHÔNG phải state RAM/React theo phiên.** Nghĩa là: refresh trang, đóng tab, quay lại hôm sau — `learning_streak` vẫn giữ nguyên giá trị đã đúng-liên-tiếp trước đó, không bị mất/reset. Chỉ 2 sự kiện làm thay đổi `learning_streak`: (a) trả lời đúng → +1 (và nếu đạt 3 thì chuyển Box 1 luôn); (b) trả lời sai → về 0. Refresh/đóng tab/thời gian trôi qua không phải là 1 trong 2 sự kiện đó, nên không ảnh hưởng.
  - Cụm từ "trong cùng phiên học" ở phần mô tả gốc chỉ mô tả trải nghiệm UI (thẻ được lặp lại ngay, không đẩy sang hôm sau) — không phải một khái niệm dữ liệu ("phiên") cần quản lý riêng. Không có bảng/cột nào theo dõi "phiên học đang diễn ra".
- **Box 1-5 (đã "tốt nghiệp" khỏi giai đoạn học):** trả lời đúng → tăng `box` lên 1 (tối đa 5), khoảng cách ôn tiếp theo: box 1 = 1 ngày, box 2 = 3 ngày, box 3 = 7 ngày, box 4 = 14 ngày, box 5 = 30 ngày. Trả lời sai (bất kỳ lúc nào) → về thẳng `box = 1`, `due_at` = ngày mai.
- Thẻ **có dòng tiến độ** với `due_at <= now()` → đến hạn ôn, hiện trong "Ôn hôm nay". Thẻ **chưa có dòng tiến độ** không tự động xuất hiện trong "Ôn hôm nay" — xem cơ chế "chủ động bắt đầu học 1 bài" ngay dưới.

**2 chế độ truy cập:**
1. **Theo bài** (trong tab "Từ mới" của 1 lesson): **quy tắc duy nhất — mở tab là insert, không cần bước xác nhận nào thêm.** Cụ thể:
   ```
   Người dùng mở tab "Từ mới" của 1 lesson
     → App query vocabulary_progress của user cho các vocabulary_id thuộc lesson đó
     → Nếu MỘT SỐ hoặc TẤT CẢ từ chưa có dòng tiến độ
         → INSERT các dòng còn thiếu, box = 0, due_at = now() (on conflict (user_id, vocabulary_id) do nothing — an toàn nếu gọi lại nhiều lần)
     → Hiển thị danh sách thẻ (đã có tiến độ + vừa insert)
   ```
   Không có màn hình/nút "Bắt đầu học" trung gian — chỉ cần mở tab, kể cả nếu người dùng thoát ngay sau đó không lật thẻ nào, các dòng `box = 0` vẫn đã được tạo (vô hại — thẻ đó sẽ xuất hiện trong "Ôn hôm nay" của những lần sau, đúng ý nghĩa "đã bắt đầu học"). Sau đó tab này luôn hiển thị đúng các thẻ thuộc bài, không lọc theo hạn — có thể ôn lại bất kỳ lúc nào kể cả chưa đến hạn (ôn tự do).
2. **Ôn hôm nay** (từ trang chủ): gộp mọi thẻ có `due_at <= now()` từ vocabulary_progress của người dùng — **chỉ những từ đã từng được "bắt đầu học"** (có dòng trong bảng), không quét/JOIN toàn bộ `vocabulary` published trên hệ thống. Truy vấn đơn giản là 1 `select` có index theo `(user_id, due_at)`, không cần LEFT JOIN.

**Giao diện lật thẻ** (chi tiết UI bàn sau): mặt trước `word_zh`, lật thấy `pinyin` + `meaning_vi` + phát `audio_url`. Sau khi xem đáp án, người dùng tự đánh giá Đúng/Sai (không có nút "khó vừa dễ" 3 mức như Anki thật — chỉ nhị phân theo quyết định Leitner đơn giản).

## 5. Shadowing hội thoại

**Bước 1 — Nghe cảm âm:** phát `dialogues.audio_url` (audio cả đoạn hội thoại), nghe lại tùy ý, không ghi âm.

**Bước 2 — chọn 1 trong 2 chế độ:**
- **"Nói liền mạch":** người dùng nghe/nói theo cả đoạn liền mạch, ghi âm lại bằng `MediaRecorder` (Web API trình duyệt), nghe lại để tự đối chiếu. Không chấm điểm tự động.
- **"Luyện phát âm từng câu":** phát từng `dialogue_lines.audio_url` (đã cắt sẵn ở Admin qua waveform trimmer) theo thứ tự `order`, dừng sau mỗi câu, người dùng nói lại, dùng **Web Speech API `SpeechRecognition`** (miễn phí, có sẵn trong Chrome, cần kết nối mạng vì Chrome gửi audio lên server Google nhận diện) với **`recognition.lang = 'zh-TW'`** (khớp định hướng phồn thể/Đài Loan của toàn dự án — không dùng `zh-CN`) nhận diện giọng nói và so khớp text nhận diện được với `text_zh` của dòng đó để chấm đúng/sai, tự động chuyển sang câu tiếp theo.

**Cách chấm đúng/sai (độ khớp tương đối, KHÔNG so khớp tuyệt đối):** ASR luôn có sai số nhỏ (ví dụ câu gốc "今天很好" nhưng nhận diện ra "今天很好啊" — thêm chữ đệm do cách phát âm/API tự thêm) — đòi khớp 100% như Gõ câu sẽ gây ức chế dù người dùng nói đúng. Quy trình chấm:
1. Chuẩn hoá cả 2 chuỗi (chuỗi nhận diện được và `text_zh` gốc): bỏ khoảng trắng, bỏ toàn bộ dấu câu (cả nửa-ngắt lẫn toàn-ngắt).
2. Tính đúng/sai theo ngưỡng độ tương đồng — ví dụ: coi là **đúng** nếu chuỗi đã chuẩn hoá của 1 trong 2 bên chứa trọn chuỗi kia (substring theo 1 trong 2 chiều), hoặc tỷ lệ ký tự khớp (Levenshtein similarity) ≥ 80%. Ngưỡng cụ thể để implementer tinh chỉnh khi test thật (khác với Gõ câu — nơi bắt buộc khớp tuyệt đối vì đó là input gõ tay chính xác, không phải nhận diện giọng nói có nhiễu).

**Fallback khi trình duyệt không hỗ trợ SpeechRecognition:** `SpeechRecognition` chỉ hoạt động ổn định trên Chrome (Desktop/Android) — **không được hỗ trợ trên Safari iOS/iPadOS** và chập chờn trên Firefox. Trước khi hiện nút "Luyện phát âm từng câu", kiểm tra `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`. Nếu không hỗ trợ: ẩn/disable nút này kèm dòng chú thích ngắn ("Trình duyệt này chưa hỗ trợ chấm điểm giọng nói — dùng Chrome để luyện theo câu, hoặc dùng chế độ Nói liền mạch"), chỉ cho phép "Nói liền mạch" (ghi âm tự đối chiếu — không phụ thuộc API này). Không được để app crash/vỡ UI khi API không tồn tại.

**Giả định về dữ liệu:** vì bạn xác nhận "khi xuất bản là đã có đủ audio, nếu không đủ sẽ không xuất bản", User App **không cần** logic dự phòng khi `dialogue_lines.start_time`/`end_time`/`audio_url` bị thiếu — nếu `lesson.status === 'published'`, coi như mọi dòng thoại trong mọi dialogue của bài đó đã có `audio_url` hợp lệ. Không ẩn/disable chế độ "Luyện phát âm từng câu" vì lý do thiếu dữ liệu audio (chỉ ẩn vì lý do trình duyệt không hỗ trợ SpeechRecognition, xem trên).

## 6. Ngữ pháp

Chỉ hiển thị lại đúng dữ liệu đã lưu ở Admin, không thêm tính năng:
- `grammar_points` (tiêu đề) → `grammar_sub_points` (nếu có, label A/B...) → `grammar_sections` (mỗi section có `label` gốc từ sách — "Chức năng"/"Cấu trúc"/"Cách dùng"..., `content`, có thể lồng nhau qua `parent_section_id`) → `grammar_examples` (mỗi ví dụ: `text_zh`, `pinyin`, `translation_vi` — **không có audio**, vì `grammar_examples.audio_url` đã bị bỏ hẳn ở Admin, câu ví dụ ngữ pháp không dùng cho luyện gõ/nghe).

## 7. Quiz

**Nguồn dữ liệu:** `quiz_questions` (đã có thật ở Admin, migration đã áp dụng) — `part` (1|2), `type` (`pinyin_choice` | `listening_choice` | `tone_choice` | `matching` | `fill_blank` | `sentence_order`), `order`, `payload` (jsonb, shape khác nhau theo `type`).

**Cách chơi:** người dùng làm Phần 1 (15 câu) và/hoặc Phần 2 (15 câu) riêng biệt, giống cấu trúc 2 sub-tab của Admin. Chấm điểm client-side, so khớp `payload` đã có sẵn đáp án đúng — không cần AI chấm lúc làm bài.

**Replay:** cho làm lại **không giới hạn số lần**, mỗi lần làm xong 1 part lưu 1 dòng lịch sử vào bảng `quiz_attempts` (mục 9.2) — không ghi đè, giữ lại toàn bộ lịch sử để sau này có thể vẽ biểu đồ tiến bộ theo thời gian. Đã đánh giá quy mô: mỗi lần làm chỉ 1 row tổng kết (không lưu từng câu trả lời), nên kể cả ở quy mô nhiều người dùng sau này (ước tính hàng trăm nghìn–1 triệu rows), bảng này vẫn nhỏ, không đáng lo về hiệu năng/dung lượng Supabase free tier.

**Thời điểm lưu — chỉ khi submit, không lưu trạng thái dang dở:** `quiz_attempts` chỉ được INSERT khi người dùng bấm nút "Nộp bài"/"Hoàn thành" sau khi đã trả lời xong toàn bộ 15 câu của 1 part. Nếu thoát giữa chừng (đóng tab, chuyển tab khác, chưa trả lời hết) — **không lưu gì cả**, không có trạng thái "đang làm dở" nào được ghi lại; lần sau vào lại phải làm từ câu đầu tiên của part đó (không resume).

## 8. Gõ phản xạ

2 tab con tách biệt hoàn toàn (theo đúng tài liệu gốc, không đổi):

**Tab "Gõ từ":** dạng bảng/sheet, ẩn `word_zh`, hiện `meaning_vi`, người dùng gõ lại chữ Hán, auto-check từng dòng ngay khi gõ xong (không cần next tuần tự, làm cả bảng cùng lúc). Nguồn: `vocabulary` của bài đang xem.

**Tab "Gõ câu":** next từng câu tuần tự. Hiện `translation_vi`, gõ lại `text_zh`, có nút nghe `audio_url` gợi ý nếu bí (không hiện pinyin, để ép luyện phản xạ mặt chữ). Nguồn: **CHỈ** `dialogue_lines.text_zh` của bài đang xem — không dùng câu ví dụ ngữ pháp.

Cả 2 tab: input text thường, dựa vào IME hệ điều hành có sẵn (không tự xây bộ gõ pinyin→Hán). Chấm: so khớp **chính xác tuyệt đối** với chữ/câu gốc — không chấp nhận từ đồng nghĩa khác, không dùng AI chấm.

**Chuẩn hoá trước khi so khớp:** so sánh `===` thô sẽ sai oan khi IME gõ ra dấu câu nửa-ngắt (`,` `.` `?` `!`) thay vì dấu câu Trung toàn-ngắt (`，` `。` `？` `！`) dù chữ Hán đúng 100%. Trước khi so khớp, cả chuỗi người dùng gõ và chuỗi gốc đều phải qua bước chuẩn hoá:
1. `trim()` bỏ khoảng trắng thừa đầu/cuối.
2. Convert dấu câu nửa-ngắt phổ biến sang toàn-ngắt tương ứng (`,`→`，`, `.`→`。`, `?`→`？`, `!`→`！`, `:`→`：`, `;`→`；`) trước khi so sánh.
3. So khớp trên chuỗi đã chuẩn hoá, không so khớp trên input thô.

## 9. Schema mới cần cho User App

Các bảng dưới đây là **mới hoàn toàn**, thuộc migration của User App (chạy trên cùng Supabase project với Admin, không đụng vào bảng nội dung có sẵn: `books/lessons/dialogues/dialogue_lines/vocabulary/grammar_*/quiz_questions`).

Mọi bảng dưới đây dùng `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` — client không cần tự truyền `user_id` khi insert/upsert (Postgres tự điền từ token RLS đang đăng nhập), giảm rủi ro quên truyền/truyền sai từ code JS.

### 9.1 `vocabulary_progress` (SRS flashcard — có trạng thái "Đang học")

```sql
create table vocabulary_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references vocabulary(id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  learning_streak smallint not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);

create index vocabulary_progress_due_idx
  on vocabulary_progress (user_id, due_at);
```

- `box = 0` = "Đang học" (learning), thẻ mới bắt đầu luôn ở box 0. `box 1-5` = đã "tốt nghiệp", theo lịch Leitner cố định (mục 4).
- `learning_streak`: chỉ có ý nghĩa khi `box = 0` — đếm số lần đúng liên tiếp lũy kế (bền trong DB, không reset khi refresh/đóng tab, xem mục 4). Đạt 3 → chuyển `box = 1`, `due_at = now() + 1 day`, `learning_streak` không còn dùng nữa (giữ nguyên giá trị cuối, không reset — vô hại vì chỉ đọc khi `box = 0`). Sai khi đang `box = 0` → `learning_streak = 0`, `due_at = now()` (thẻ lặp lại ngay, không đẩy sang hôm sau).
- `unique (user_id, vocabulary_id)`: mỗi người dùng có tối đa 1 dòng tiến độ / 1 từ vựng — cập nhật (`upsert`) mỗi lần ôn, không insert mới (trừ lần đầu "bắt đầu học" một bài, xem mục 4).
- RLS: user chỉ `select`/`insert`/`update`/`delete` được dòng có `user_id = auth.uid()`.
- "Ôn hôm nay" ở trang chủ = `select vocabulary.* join vocabulary_progress where user_id = auth.uid() and due_at <= now()` — **không** JOIN/quét bảng `vocabulary` gốc để tìm từ "chưa có tiến độ", vì tiến độ đã được tạo chủ động lúc mở bài lần đầu (mục 4).

### 9.2 `quiz_attempts` (lịch sử làm quiz)

```sql
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  part smallint not null check (part in (1, 2)),
  score smallint not null,
  total smallint not null,
  created_at timestamptz not null default now()
);

create index quiz_attempts_user_lesson_idx
  on quiz_attempts (user_id, lesson_id, part, created_at desc);
```

- Ghi 1 dòng mỗi lần người dùng hoàn thành 1 part của 1 lesson (không lưu chi tiết từng câu trả lời — chỉ tổng kết `score/total`).
- RLS: user chỉ đọc/ghi được dòng của chính mình.

### 9.3 `typing_progress` (Gõ phản xạ — trạng thái mới nhất, upsert, KHÔNG phải log)

```sql
create table typing_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vocabulary', 'dialogue_line')),
  target_id uuid not null,
  is_correct boolean not null default false,
  streak integer not null default 0,
  last_attempted_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);

create index typing_progress_user_kind_idx
  on typing_progress (user_id, kind);
```

- **Upsert trạng thái mới nhất, không phải nhật ký từng lần gõ** — mỗi lần người dùng gõ xong 1 từ/1 câu, `upsert` đúng 1 dòng (`on conflict (user_id, kind, target_id) do update`), không `insert` thêm dòng mới. Số dòng tối đa của bảng này luôn bằng đúng `số user × (tổng số vocabulary + tổng số dialogue_lines)`, không phình theo số lần luyện tập (khác với thiết kế "nhật ký" ban đầu, vốn sẽ ra hàng chục nghìn dòng/user chỉ sau vài chục lần luyện).
- `streak`: số lần gõ đúng liên tiếp gần nhất cho riêng mục tiêu đó (không dùng cho SRS, chỉ để hiển thị UI kiểu "đã thuộc"/tô đậm trong bảng Gõ từ nếu cần). Rule cập nhật đơn giản, áp dụng độc lập cho từng `target_id`: gõ **đúng** → `streak = streak + 1`; gõ **sai** → `streak = 0`. Ví dụ chuỗi Sai-Sai-Đúng-Sai cho cùng 1 từ: `streak` lần lượt là `0 → 0 → 1 → 0`.
- `target_id` trỏ tới `vocabulary.id` (khi `kind = 'vocabulary'`) hoặc `dialogue_lines.id` (khi `kind = 'dialogue_line'`) — không đặt foreign key cứng vì `target_id` thay đổi bảng tham chiếu theo `kind` (Postgres không hỗ trợ polymorphic FK trực tiếp; ràng buộc toàn vẹn xử lý ở tầng ứng dụng).
- RLS: user chỉ đọc/ghi được dòng của chính mình.

**Không tạo bảng `user_profiles`/`subscriptions` trong migration này** — nằm ngoài phạm vi v1 (xem mục 1).

## 10. Việc chưa thiết kế chi tiết (để sau)

- Toàn bộ UI/UX (layout, màu sắc, component) — bàn riêng sau khi spec chức năng này được duyệt.
- Subscription/gia hạn tài khoản + cron email nhắc hết hạn — spec riêng sau.
- Đợt 2 Quiz (4 dạng khó).
- Cách tính "đã học xong 1 bài" (nếu cần badge/progress tổng thể theo lesson) — chưa có yêu cầu cụ thể, không đoán thêm.
