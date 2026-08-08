# Hội thoại & Shadowing — Design (lần làm lại, chỉnh chu)

## Bối cảnh

Đây là lần làm lại thứ 4 của tính năng Shadowing. Ba lần trước (xem `docs/superpowers/plans/2026-08-07-scope-4*.md`) đều bị revert vì UI không đúng ý và, quan trọng hơn, **cơ chế chấm điểm phát âm sai về mặt kỹ thuật**: so khớp transcript ASR với câu mẫu bằng pinyin CÓ dấu thanh tuyệt đối, trong khi:

- Web Speech API được set `lang='zh-CN'` nên luôn trả về chữ **giản thể**, trong khi toàn bộ DB (`dialogues.lines.text_zh`, `.pinyin`) là **phồn thể (zh-TW)**.
- Nhiều cặp chữ đồng âm (他/她 → đều "tā") không thể phân biệt qua giọng nói, nhưng vẫn bị chấm dựa trên mặt chữ.
- Một số cụm (他們/他们 → "tā mén" vs "tā men") có cách đánh dấu thanh kỹ thuật khác nhau dù đọc giống hệt nhau, khiến so khớp tuyệt đối theo dấu thanh trượt sai dù người dùng đọc đúng.

Việc quay lại từ đầu (branch `shadowing-redo`, worktree tại `.worktrees/shadowing-redo`, base = commit `d4babeb`, trước mọi code Shadowing) là để làm lại có kế hoạch rõ ràng, tránh lặp lại 3 vòng sửa-không-ưng.

Toàn bộ commit "Shadowing" trước đó (bao gồm cả fix `title_zh/title_vi`) đã bị loại khỏi branch mới; `main` giữ nguyên không đổi.

## Mục tiêu

1. Cấu trúc màn hình: picker chọn bài hội thoại → 2 tab lớn **Nghe hội thoại** / **Shadowing** (không đổi so với 3 lần trước — đây không phải điểm gây khó chịu).
2. Tab **Nghe hội thoại**: port gần nguyên UI/UX từ `easy-chinese/app/lessons/[id]/dialogue/` (DialogueClient), dùng field DB hiện tại.
3. Tab **Shadowing**: build UI mới theo ảnh mẫu người dùng cung cấp (audio player gọn, khối transcript câu hiện tại, 2 nút GHI ÂM / PHÁT LẠI GHI ÂM, kết quả chấm hiện ra tự động sau khi ghi xong — không có nút "chấm phát âm" riêng).
4. **Sửa triệt để cơ chế chấm điểm**: chấm theo pinyin không dấu ở cấp độ âm tiết (syllable-level), không phải so khớp ký tự hay pinyin có dấu tuyệt đối. Không bao giờ trừ điểm chỉ vì khác mặt chữ giản/phồn hoặc khác vị trí dấu thanh kỹ thuật.
5. `recognition.lang = 'zh-TW'` (không phải `zh-CN`) để hiển thị transcript gần với phồn thể hơn (chỉ ảnh hưởng hiển thị "bạn đã nói gì", không ảnh hưởng logic chấm).

## Kiến trúc & luồng dữ liệu

```
app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/
├── page.tsx                      # Picker: danh sách dialogues của bài học
├── [dialogueId]/
│   ├── page.tsx                  # Server component: fetch dialogue theo id
│   └── DialogueDetailPage.tsx    # Client: 2 tab (Nghe hội thoại | Shadowing)
├── ListenTab.tsx                 # Tab "Nghe hội thoại" — port từ DialogueClient.tsx
├── ShadowingScreen.tsx           # Tab "Shadowing" — 1 màn hình, UI mới theo ảnh mẫu
lib/db/getDialogueById.ts         # Query dialogue + lines (giữ nguyên nếu còn hợp lệ)
lib/db/dialogueDisplayName.ts     # Tính display name (kind: dialogue/passage), giữ nguyên
lib/shadowing/pinyinGrading.ts    # MỚI — logic chấm theo âm tiết, thay thế hoàn toàn code cũ
lib/shadowing/useSpeechRecognition.ts  # Hook wrap Web Speech API, lang='zh-TW'
```

Dữ liệu dùng field có sẵn trong `lib/db/types.ts`:
- `DialogueLine.text_zh`, `.pinyin` (pinyin có sẵn trong DB, dùng làm target hiển thị — KHÔNG dùng để chấm, chỉ dùng pinyin tính từ `pinyin-pro` để đảm bảo nhất quán thuật toán)
- `DialogueLine.audio_url` — audio mẫu từng câu
- `Dialogue.kind` + `dialogueDisplayName()` — tên hiển thị (không dùng `title_zh/title_vi`, cột này đã bị drop)

## Chấm điểm phát âm — thuật toán mới (`lib/shadowing/pinyinGrading.ts`)

**Nguyên tắc cốt lõi: chấm ở cấp độ âm tiết pinyin không dấu, không chấm theo ký tự hay pinyin có dấu tuyệt đối.**

```ts
gradeSyllables(target: string, transcript: string): {
  status: 'correct' | 'almost' | 'incorrect'
  accuracy: number          // 0..1
  targetSyllables: string[] // pinyin không dấu, dùng pinyin-pro type:'array'
  transcriptSyllables: string[]
  targetSyllablesToned: string[]  // pinyin có dấu — chỉ để HIỂN THỊ, không chấm
  transcriptSyllablesToned: string[]
}
```

Các bước:
1. `pinyin(target, { toneType: 'none', type: 'array' })` và tương tự cho transcript → mảng âm tiết không dấu.
2. Levenshtein distance trên mảng âm tiết (so từng âm tiết, không so từng ký tự Latin — tránh việc 1 âm tiết dài "zhuang" bị tính nhiều lỗi so với 1 âm tiết ngắn "a").
3. `accuracy = (maxLen - distance) / maxLen`.
4. Ngưỡng: `accuracy === 1` → `correct`; `accuracy >= 0.7` → `almost`; còn lại → `incorrect`.
5. Pinyin có dấu (`toneType: 'symbol'`) chỉ tính thêm để hiển thị debug (so sánh trực quan mẫu vs bạn đọc trong UI kết quả), **không** tham gia quyết định correct/almost/incorrect.

Vì so sánh luôn diễn ra ở cấp pinyin, việc ASR trả về giản thể hay phồn thể không ảnh hưởng đến độ chính xác chấm — đây là điểm khác biệt cốt lõi so với code cũ vốn so cả ký tự.

`recognition.lang` đổi thành `'zh-TW'` để trình duyệt ưu tiên trả transcript phồn thể (khớp cảm quan với DB khi hiển thị "bạn đã nói"), nhưng đây chỉ là cosmetic — không phải cơ chế chấm.

## UI Shadowing (theo ảnh mẫu)

Một màn hình duy nhất, theo layout: **cả câu + pinyin cả câu** (không tách từng từ như app tiếng Anh mẫu — tiếng Trung không tách từ tự nhiên như tiếng Anh).

Cấu trúc trên xuống:
1. **Audio player mẫu** (thu gọn, không cần lớn như video): nút play/pause, thanh tiến trình, tốc độ phát (1x/1.25x/0.75x, giữ hành vi từ easy-chinese), toggle "Tự động dừng" (auto-pause sau mỗi câu vs tự chuyển câu tiếp).
2. **Khối câu hiện tại**: chữ Hán phồn thể lớn, pinyin cả câu bên dưới, nghĩa tiếng Việt dưới cùng — giữ đúng bố cục thẻ câu như `ShadowingClient.tsx` (không cần tách từ).
3. **2 nút hành động** (theo đúng ảnh mẫu, bỏ nút "Chấm phát âm" riêng):
   - `PHÁT LẠI GHI ÂM` — disabled cho tới khi có bản ghi, nghe lại giọng mình.
   - `GHI ÂM` — bấm để bắt đầu ghi (MediaRecorder) + đồng thời khởi động SpeechRecognition (khắc phục bug thứ tự đã gặp ở lần làm trước: phải start cùng lúc, không start sau khi recorder đã stop). Bấm lại để dừng ghi → tự động chấm điểm ngay, hiển thị kết quả (đúng/gần đúng/sai) không cần thao tác thêm.
4. **Kết quả chấm** hiện dưới 2 nút, dạng thẻ giống easy-chinese (icon + màu theo status), có so sánh âm tiết mẫu vs bạn đọc (dùng pinyin có dấu để hiển thị, không dùng để chấm).
5. Danh sách các câu còn lại hiển thị mờ hơn bên dưới (giống easy-chinese), bấm vào để nhảy tới câu đó.

## Testing

- Unit test cho `gradeSyllables()`: các case đã biết chính xác qua xác minh trực tiếp bằng `pinyin-pro` trong phiên làm việc trước (không đoán ngữ âm học):
  - `他` vs `她` → cả hai đều "tā" → phải chấm `correct` khi transcript và target khác mặt chữ nhưng cùng âm.
  - `她們` (target) vs `他们` (giả lập ASR trả giản thể) → cùng "tā men" ở dạng không dấu → `correct`.
  - Câu sai hẳn 1 âm tiết → rơi vào `almost` hoặc `incorrect` tùy % khớp, verify bằng số liệu thực tế từ `pinyin-pro`, không tự đoán.
  - **Không** đưa vào test case dựa trên giả định ngữ âm chưa xác minh (bài học từ lần trước: 妳 bị pinyin-pro đọc "nǎi" thay vì "nǐ" — nếu dùng phải verify bằng `node -e` trước).
- Component test cho `ShadowingScreen`: luồng ghi âm → dừng → hiện kết quả tự động (mock MediaRecorder + SpeechRecognition).
- Giữ nguyên baseline 157 test hiện có, không phá vỡ.

## Ngoài phạm vi

- Không thay đổi cấu trúc picker hay routing đã có.
- Không thêm tab con trong Shadowing.
- Không đổi schema DB.
