# Thiết kế: Scope 5 — Quiz

Ngày: 2026-08-03
Trạng thái: đã chốt hướng thiết kế, chưa triển khai code.

Kế thừa từ: `docs/superpowers/specs/2026-07-31-user-app-design.md` mục 7 (Quiz) —
spec đó đã chốt nguồn dữ liệu, cách chấm điểm, thời điểm lưu lịch sử. Spec này
bổ sung chi tiết UI/UX và cấu trúc code cụ thể để implement.

Đây là Scope 5 trong 6 scope độc lập của User App (Scope 3 Flashcard SRS đã
xong và ổn định, Scope 4 Shadowing/Scope 6 Gõ phản xạ làm sau — thứ tự đã
thống nhất "dễ trước khó sau": Quiz → Gõ phản xạ → Shadowing).

## 1. Phạm vi

Chỉ đợt 1 (6 dạng câu hỏi "dễ") — đúng theo `2026-07-31-user-app-design.md`
mục 7 và `TaiwaneseEasy-admin` spec `2026-07-30-quiz-generation-design.md`:

1. `pinyin_choice` — chọn Pinyin ↔ Chữ Hán, trắc nghiệm 4 đáp án
2. `listening_choice` — nghe & chọn đáp án đúng, trắc nghiệm 4 đáp án
3. `tone_choice` — nhận biết thanh điệu, trắc nghiệm 4 đáp án
4. `matching` — ghép nghĩa/nối từ, 5 cặp chữ Hán ↔ nghĩa Việt
5. `fill_blank` — điền từ vào chỗ trống, trắc nghiệm 4 đáp án
6. `sentence_order` — sắp xếp từ thành câu

**KHÔNG làm ở scope này:**
- Đợt 2 Quiz (4 dạng khó: tìm lỗi sai, dịch câu, phân biệt từ gần nghĩa, chọn
  trợ từ/lượng từ)
- Trang xem lịch sử/biểu đồ tiến bộ theo thời gian (chỉ hiện điểm cao nhất ở
  trang chọn Part, không vẽ biểu đồ)
- Resume bài đang làm dở (đúng theo spec gốc — thoát giữa chừng không lưu gì)

**Nguồn dữ liệu:** bảng `quiz_questions` đã có thật ở Admin (migration
`0019_quiz_questions.sql`), User App chỉ đọc qua anon key + RLS
(`anon can read quiz questions of published lessons`) — không cần thêm
migration bảng nội dung. Bảng `quiz_attempts` (lịch sử điểm) đã có sẵn từ
migration `0001_progress_tables.sql` của chính User App — không cần
migration mới cho scope này.

## 2. Luồng màn hình

```
Trang bài học (Quiz mode: enabled)
        │
        ▼
Trang chọn Part (2 thẻ Part 1 / Part 2, kèm điểm cao nhất nếu đã làm)
        │  bấm 1 thẻ
        ▼
Làm bài — 15 câu tuần tự, chấm ngay sau mỗi câu, khoá đáp án
        │  làm xong câu 15
        ▼
Kết quả — điểm tổng X/15 + review lại toàn bộ 15 câu (đúng/sai, đáp án đúng)
        │  ghi 1 dòng vào quiz_attempts tại đây
        ├─ "Làm lại" → quay về câu 1, phiên mới (không tính lượt cũ)
        └─ "Về trang bài học" → quay lại trang chọn Part (điểm cao nhất
                                  đã cập nhật)
```

**Thoát giữa chừng** (đóng tab, back giữa lúc đang làm câu 1-14): không lưu
gì cả, đúng theo spec gốc — không có trạng thái "đang làm dở".

## 3. Chi tiết từng màn hình

### 3.1 Trang chọn Part

Route: `app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/page.tsx`
(Server Component).

- Fetch `quiz_questions` theo `lesson_id` (chỉ cần đếm/group theo `part`, số
  câu luôn cố định 15/part theo spec nên không cần validate số lượng runtime)
- Fetch điểm cao nhất mỗi part của user hiện tại: `MAX(score)` trong
  `quiz_attempts` where `lesson_id` + `part`, group by `part`
- 2 thẻ tĩnh:
  - **Phần 1** — mô tả "Nhận biết từ vựng & phát âm" (3 dạng:
    pinyin_choice/listening_choice/tone_choice)
  - **Phần 2** — mô tả "Vận dụng câu & ngữ pháp" (3 dạng:
    matching/fill_blank/sentence_order)
- Mỗi thẻ: nếu đã có điểm cũ, hiện "Điểm cao nhất: X/15"; nút bấm ghi
  "Bắt đầu" (chưa làm lần nào) hoặc "Làm lại" (đã có điểm) — cả 2 trường hợp
  đều dẫn vào chế độ làm bài từ câu 1, không phân biệt hành vi, chỉ khác
  nhãn nút.

### 3.2 Làm bài

Client Component `QuizPage.tsx`, state cấp cao:
`'select' | 'playing' | 'result'`, dùng URL query param `?part=1|2` để phản
ánh Part đang chọn (đúng convention `?dialogue=X&mode=Y` đã dùng ở trang Từ
mới, hỗ trợ back/forward trình duyệt đúng).

`QuizPlayer.tsx` render 1 câu tại 1 thời điểm theo `order`, không shuffle lại
thứ tự câu hỏi (giữ nguyên `order` từ DB — khác với Flashcard có tính năng
Trộn thẻ, quiz không có yêu cầu này trong spec gốc).

Progress hiển thị: `Câu {n}/15` + progress bar (tái dùng pattern progress
bar đã có ở `FlashcardReviewer`).

**Chấm điểm — chung cho mọi dạng:**
- Người dùng trả lời → chấm ngay, khoá đáp án đã chọn/đã nhập
- Nếu sai: hiện đáp án đúng bên cạnh (viền xanh) để học ngay, đáp án đã chọn
  hiện viền đỏ
- Nút "Tiếp" xuất hiện sau khi đã trả lời, đưa sang câu kế
- Không có cơ chế "thử lại đáp án khác" — chọn 1 lần là khoá, giống thi thật

**6 sub-component theo `type`** (thư mục
`.../quiz/questions/`), cùng interface
`{ payload: <shape riêng>; onAnswer: (isCorrect: boolean) => void }`:

- **`PinyinChoiceQuestion`** — 4 nút lựa chọn dạng list, giống Đúng/Sai
  buttons ở Flashcard nhưng 4 lựa chọn thay vì 2.
- **`ListeningChoiceQuestion`** — nút phát audio (tái dùng UI nút loa từ
  `FlashcardReviewer`) + 4 lựa chọn.
- **`ToneChoiceQuestion`** — hiện `wordZh` to, 4 lựa chọn là các biến thể
  pinyin có dấu.
- **`FillBlankQuestion`** — hiện `sentence` với `___` thay bằng ô trống
  visual, 4 lựa chọn để điền vào.
- **`MatchingQuestion`** — 2 cột (chữ Hán bên trái, nghĩa Việt bên phải, cột
  phải tự shuffle vị trí lúc render vì `pairs` gốc để đúng thứ tự sẽ lộ đáp
  án theo hàng ngang). Bấm 1 ô trái rồi bấm 1 ô phải để nối; nối đúng thì
  khoá cặp đó lại (viền xanh, không bấm lại được); nối sai thì rung nhẹ +
  đỏ trong khoảnh khắc rồi bỏ chọn để thử lại cặp khác (nối sai được phép
  thử lại vì đây là 1 câu hỏi duy nhất chứa 5 cặp, không phải "chọn 1 lần
  duy nhất" như trắc nghiệm — nối xong hết 5 cặp mới tính là trả lời xong
  câu này, điểm chấm nhị phân: đúng hết 5/5 mới tính đúng, sai bất kỳ cặp
  nào ở lần nối đầu tiên thì câu đó tính sai theo tổng thể dù sau đó nối lại
  đúng).
- **`SentenceOrderQuestion`** — 2 khu vực: "câu đang xây" (rỗng ban đầu) và
  "các từ còn lại" (`words` đã xáo trộn sẵn từ DB). Bấm 1 từ ở khu dưới để
  đẩy lên khu trên theo thứ tự bấm; bấm 1 từ đã ở khu trên để đẩy ngược lại
  xuống dưới (bỏ chọn). Có nút "Kiểm tra" xuất hiện khi đã chọn đủ số từ
  bằng `words.length` — so khớp thứ tự index đã bấm với `correctOrder`.

### 3.3 Kết quả

Sau câu 15: hiện điểm tổng `X/15` (đếm số `isCorrect === true` đã ghi nhận
trong phiên), rồi danh sách lại toàn bộ 15 câu đã làm — mỗi dòng tóm tắt câu
hỏi (rút gọn theo dạng, ví dụ pinyin_choice hiện `prompt`), icon đúng/sai, và
đáp án đúng nếu câu đó sai.

INSERT 1 dòng vào `quiz_attempts` (`lesson_id`, `part`, `score`, `total: 15`)
**tại thời điểm hiện màn kết quả** (đã làm xong 15/15 câu) — đúng theo spec
gốc "chỉ lưu khi hoàn thành toàn bộ part". Lỗi mạng khi insert: hiện banner
lỗi + nút "Thử lại" (đúng pattern lỗi mạng đã dùng ở Flashcard
`recordVocabularyReview`), không mất kết quả đã tính ở client.

2 nút cuối màn: **"Làm lại"** (reset về câu 1, tạo phiên `quiz_attempts` mới
khi hoàn thành, không ghi đè lượt cũ) và **"Về trang bài học"**.

## 4. Cấu trúc code

```
app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/
  page.tsx              — Server Component: fetch quiz_questions + điểm cao nhất
  QuizPage.tsx           — Client Component: state 'select'|'playing'|'result'
  QuizPlayer.tsx         — render 1 câu theo `order`, delegate theo `type`
  questions/
    PinyinChoiceQuestion.tsx
    ListeningChoiceQuestion.tsx
    ToneChoiceQuestion.tsx
    MatchingQuestion.tsx
    FillBlankQuestion.tsx
    SentenceOrderQuestion.tsx

lib/db/quiz.ts
  getQuizQuestions(supabase, lessonId, part): lấy 15 câu theo part, order asc
  getBestQuizScores(supabase, lessonId): { part1: number|null, part2: number|null }
  recordQuizAttempt(supabase, lessonId, part, score, total): insert 1 dòng
```

`app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` — đổi
`enabled: false` → `true` cho mục `quiz` trong mảng `modes` đã có sẵn.

## 5. Điểm cần lưu ý khi implement

- **`sentence_order`**: `correctOrder` là mảng hoán vị index vào `words` gốc
  — ví dụ `words: ["đi", "trường", "tôi"]`, `correctOrder: [2, 0, 1]` nghĩa
  là câu đúng là `words[2] words[0] words[1]`. So khớp mảng index người dùng
  đã bấm với `correctOrder` bằng so sánh phần tử theo thứ tự, không so
  sánh chuỗi ghép lại (tránh sai khi 2 từ trùng nội dung nhưng khác vị trí
  gốc).
- **`matching`**: xáo trộn vị trí hiển thị cột phải bằng Fisher-Yates
  (tái dùng `shuffleCards` pattern đã có trong `FlashcardReviewer.tsx`, tổng
  quát hoá thành helper dùng chung nếu cần) — chỉ xáo trộn thứ tự hiển thị,
  không đổi dữ liệu `pairs` gốc.
- **Chấm điểm client-side hoàn toàn** — `payload` đã chứa sẵn đáp án đúng
  (`correctIndex`/`correctOrder`/`pairs`), không cần gọi API/AI để chấm.
- **Test theo pattern đã dùng cho `FlashcardReviewer.test.tsx`**: Vitest +
  Testing Library, `waitFor()` cho mọi assertion phụ thuộc `useEffect`/state
  update bất đồng bộ, test riêng từng dạng câu hỏi trong
  `tests/components/quiz/questions/*.test.tsx`, và 1 file test luồng tổng
  `QuizPage.test.tsx` (chọn Part → làm 15 câu → xem kết quả → ghi
  `quiz_attempts`).
- **RLS**: `quiz_questions` đã có policy `anon` đọc (không cần `authenticated`
  riêng vì đây là bảng nội dung công khai như `vocabulary`/`dialogues`) —
  không cần thêm migration, nhưng cần verify thật trên Supabase Dashboard
  trước khi coi là xong (bài học từ Scope 1-2: đã dính bug "to anon" only 2
  lần, luôn kiểm tra `pg_policies` thay vì giả định đúng).

## 6. Việc chưa thiết kế (ngoài phạm vi)

- Đợt 2 Quiz (4 dạng khó)
- Biểu đồ tiến bộ điểm theo thời gian (dữ liệu đã có sẵn trong lịch sử
  `quiz_attempts` không update/delete, chỉ chưa có UI hiển thị)
- Trang preview quiz cho Admin xem lại sau khi import (thuộc phạm vi
  `TaiwaneseEasy-admin`, không phải User App)
