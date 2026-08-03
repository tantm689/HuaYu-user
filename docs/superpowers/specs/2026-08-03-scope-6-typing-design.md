# Scope 6: Gõ phản xạ — Design Spec

**Ngày:** 2026-08-03
**Trạng thái:** Approved

## 1. Bối cảnh

Tính năng và schema cho "Gõ phản xạ" đã được chốt từ trước trong
`docs/superpowers/specs/2026-07-31-user-app-design.md` (mục 8: chức năng,
mục 9.3: bảng `typing_progress`). Bảng đã tồn tại trong DB
(`supabase/migrations/0001_progress_tables.sql`), có RLS, chưa có UI nào
dùng tới. Spec này chỉ bổ sung phần UI/UX chưa thiết kế (mục 10 của spec
gốc để ngỏ việc này) — **không đổi logic chức năng đã chốt.**

Vị trí trong lộ trình: Quiz (Scope 5) đã xong. Theo thứ tự "dễ trước khó
sau" người dùng chọn: Gõ phản xạ tiếp theo, Shadowing làm cuối.

## 2. Chức năng (nhắc lại từ spec gốc, không đổi)

2 tab con tách biệt hoàn toàn:

- **Gõ từ:** dạng danh sách, ẩn `word_zh`, hiện `meaning_vi`, người dùng gõ
  lại chữ Hán. Auto-check từng dòng, không next tuần tự — làm cả danh sách
  cùng lúc, thứ tự tùy ý. Nguồn: toàn bộ `vocabulary` của bài (qua các
  dialogue), lấy lại đầy đủ mỗi lần vào tab.
- **Gõ câu:** next tuần tự từng câu `dialogue_lines.text_zh` của bài (chỉ
  dialogue thật, không dùng câu ví dụ ngữ pháp). Hiện `translation_vi`, gõ
  lại `text_zh`, có nút nghe `audio_url` gợi ý không giới hạn số lần (không
  hiện pinyin — ép luyện phản xạ mặt chữ). Lấy lại toàn bộ câu mỗi lần vào
  tab (không lọc theo streak — luyện tự do).
- Chấm: so khớp **chính xác tuyệt đối**, không AI, không đồng nghĩa.
- **Chuẩn hoá trước khi so khớp** (dùng chung cho cả 2 tab):
  1. `trim()`.
  2. Convert dấu câu nửa-ngắt → toàn-ngắt: `,`→`，` `.`→`。` `?`→`？`
     `!`→`！` `:`→`：` `;`→`；`.
  3. So khớp trên chuỗi đã chuẩn hoá.
- Ghi tiến độ: `typing_progress` — **upsert trạng thái mới nhất, không phải
  log**. Mỗi lần chấm 1 từ/câu → `upsert (user_id, kind, target_id)`:
  đúng → `streak += 1`, `is_correct = true`; sai → `streak = 0`,
  `is_correct = false`.

## 3. UI/UX (mới thiết kế trong spec này)

### 3.1 Entry point

`app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` — mode
`typing` đổi từ:
```ts
{ key: 'typing', label: 'Gõ câu', description: 'Luyện gõ lại câu hội thoại', icon: Keyboard, enabled: false }
```
thành:
```ts
{ key: 'typing', label: 'Gõ phản xạ', description: 'Luyện gõ từ và câu', icon: Keyboard, enabled: true }
```

Route: `/books/[bookId]/lessons/[lessonId]/typing`.

### 3.2 Cấu trúc trang

Server Component `page.tsx` fetch song song `vocabulary` (qua
`getLessonVocabulary`, đã có sẵn) và `dialogue_lines` (helper mới,
§4) của bài, truyền cho Client Component `TypingPage.tsx`.

`TypingPage` quản lý 2 tab con bằng state cục bộ (không cần URL query —
không có gì cần deep-link hay giữ khi back, khác Quiz), mặc định mở tab
"Gõ từ". Style tab: tái dùng pattern pill-tab đã có (giống Quiz's
part-select nếu có, hoặc 2 nút pill đơn giản `Gõ từ` | `Gõ câu`).

### 3.3 Tab "Gõ từ" (`VocabTypingTab.tsx`)

- Danh sách dọc, mỗi dòng 1 từ vựng: `meaning_vi` bên trái (flex-1), input
  text bên phải (width cố định vừa đủ, full-width trên mobile — dòng có
  thể wrap 2 hàng trên màn hẹp: nghĩa ở trên, input ở dưới).
- `onBlur` và `onKeyDown` (Enter) đều trigger chấm — so khớp `word_zh` sau
  chuẩn hoá.
- Kết quả: viền + nền dòng đổi màu (`border-success-500 bg-success-50` nếu
  đúng, `border-error-500 bg-error-50` nếu sai) — dùng token màu đã có
  trong design system (dùng lại đúng token Quiz đã dùng cho đúng/sai).
  Không khoá input — người dùng gõ lại bất kỳ lúc nào, mỗi lần blur/Enter
  chấm lại và upsert lại.
- Không có progress tổng, không có nút "hoàn thành" — trang luyện tự do,
  rời đi lúc nào cũng được, tiến độ đã lưu ngay theo từng dòng.
- Từ chưa gõ: input trống, không tô màu.

### 3.4 Tab "Gõ câu" (`SentenceTypingTab.tsx`)

- Next tuần tự, 1 câu tại 1 thời điểm, theo đúng `order` gốc trong
  `dialogue_lines` của bài (nối các dialogue theo `dialogues.order`, trong
  mỗi dialogue theo `dialogue_lines.order`).
- Hiện: `translation_vi` (câu tiếng Việt), input text, nút icon 🔊 phát
  `audio_url` (nếu null, ẩn nút — không mọi dòng có audio).
- Nút "Kiểm tra" (hoặc Enter) chấm câu:
  - **Đúng:** tô xanh, input khoá (readonly), hiện nút "Tiếp".
  - **Sai:** tô đỏ, input khoá (readonly), hiện đáp án đúng (`text_zh` gốc)
    ngay dưới input dạng text tĩnh, hiện nút "Tiếp". Không cho sửa lại tại
    chỗ — phải qua câu rồi mới luyện lại từ đầu tab nếu muốn.
- Mỗi câu (đúng hoặc sai) upsert `typing_progress` ngay khi chấm, không
  đợi bấm "Tiếp".
- Hết danh sách: màn nhỏ "Đã luyện xong N câu" + nút "Về danh sách" (quay
  lại `lessons/[lessonId]` hoặc về tab Gõ từ — chọn quay lại trang lesson
  detail, đơn giản nhất) — không cần vòng tròn %, không phải bài kiểm tra.

### 3.5 Lỗi mạng khi lưu tiến độ

Theo nguyên tắc chung của spec gốc (mục 2 — không im lặng nuốt lỗi):
upsert `typing_progress` thất bại → hiện banner lỗi nhỏ cục bộ ("Không lưu
được, kiểm tra kết nối mạng") gần dòng/câu đó, không chặn tiếp tục luyện
(kết quả tô màu vẫn hiện dựa trên so khớp local, chỉ việc lưu DB bị lỗi) —
giống cách Flashcard xử lý lỗi lưu.

## 4. File chính

- `lib/typing/normalize.ts` — `normalizeForMatch(s: string): string`
  (trim + convert dấu câu), `isExactMatch(input: string, target: string): boolean`.
- `lib/db/getDialogueLines.ts` (mới) — `getDialogueLines(supabase, lessonId): Promise<DialogueLineForTyping[]>`,
  join `dialogues` → `dialogue_lines`, trả về mảng phẳng đã sort theo
  `dialogues.order` rồi `dialogue_lines.order`. Type mới trong
  `lib/db/types.ts`:
  ```ts
  export interface DialogueLineForTyping {
    id: string
    text_zh: string
    translation_vi: string | null
    audio_url: string | null
  }
  ```
- `lib/db/typingProgress.ts` (mới) — `upsertTypingProgress(supabase, kind: TypingKind, targetId: string, isCorrect: boolean, prevStreak: number): Promise<void>`
  (tính `streak` mới = `isCorrect ? prevStreak + 1 : 0`, upsert theo
  `(user_id, kind, target_id)` — `user_id` tự điền qua default
  `auth.uid()`, không cần truyền). Không cần hàm `getTypingProgress` riêng
  cho v1 — không hiển thị streak trong UI theo quyết định ở mục 3 (chỉ tô
  màu đúng/sai theo phiên hiện tại, không load lại trạng thái cũ khi vào
  trang — đơn giản hoá, tránh phải fetch thêm 1 bảng chỉ để tô màu ban
  đầu mà spec không yêu cầu).
- `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/page.tsx` (mới)
  — Server Component, fetch `getLesson` + `getLessonVocabulary` +
  `getDialogueLines`, empty-state nếu bài không có từ vựng/câu nào.
- `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage.tsx`
  (mới) — Client, quản lý tab state.
- `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab.tsx` (mới)
- `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab.tsx` (mới)
- `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` — sửa
  `modes` array (§3.1).

## 5. Việc KHÔNG làm trong scope này

- Không hiển thị streak/tiến độ lũy kế trong UI (chỉ lưu DB cho tương lai,
  ví dụ nếu sau này cần thống kê tổng — không có yêu cầu cụ thể hiện tại).
- Không lọc câu/từ theo streak đã cao — luôn luyện lại toàn bộ mỗi lần vào.
- Không giới hạn số lần nghe audio gợi ý.
- Không tự xây bộ gõ pinyin→Hán — dựa hoàn toàn vào IME hệ điều hành.
- Không resume trạng thái "đang làm dở" — mỗi lần vào tab là luyện từ đầu.
