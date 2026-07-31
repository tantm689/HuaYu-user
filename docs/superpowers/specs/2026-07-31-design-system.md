# Design System — User App

Ngày: 2026-07-31
Trạng thái: Đã chốt (tham khảo từ mockup do người dùng cung cấp tại `E:\TaiwaneseEasy\theme tham khảo\`).
Nguồn: 5 file mockup HTML (`Buoc1-BaiKhoa.dc.html` → `Buoc5-LuyenCau.dc.html`) — dùng làm **tham khảo phong cách chung**, không phải khuôn cứng nhắc. Những phần mockup chưa có (đăng nhập, danh sách bài, Quiz 6 dạng thật, Shadowing, trang chủ) được tuỳ biến theo cùng ngôn ngữ thị giác, quyết định bởi implementer khi cần, hỏi lại người dùng nếu không chắc.

## Triết lý

"Thẻ bài học ấm áp, thân thiện, có game hoá nhẹ" — khác hẳn phong cách CRM/chuyên nghiệp lạnh của Admin CMS, vì đối tượng là người tự học ôn tập hàng ngày, không phải admin quản trị nội dung.

## Cách áp dụng kỹ thuật

**Tailwind theme tokens** (không dùng inline style như mockup gốc) — định nghĩa 1 lần trong cấu hình Tailwind, dùng class xuyên suốt mọi trang để dễ duy trì/đổi màu sau này.

### `app/globals.css` — theme tokens (Tailwind 4 dùng `@theme` trực tiếp trong CSS, không cần `tailwind.config.ts` riêng)

```css
@import "tailwindcss";

@theme {
  /* Màu nền */
  --color-cream: #FBF6EC;
  --color-card: #FFFDF8;
  --color-card-border: #EFE4CE;
  --color-accent-bg: #FBF4E4;
  --color-accent-border: #EFE1C4;

  /* Màu thương hiệu */
  --color-brand-red: #C1272D;
  --color-brand-red-dark: #A21E23;
  --color-brand-gold: #D4AF37;
  --color-brand-cream-text: #FFF3DC;
  --color-brand-cream-text-alt: #FFF6E4;

  /* Màu chữ */
  --color-ink: #2B2622;
  --color-ink-muted: #7C7263;
  --color-ink-faint: #9A8F7E;
  --color-ink-fainter: #A89C88;
  --color-ink-pinyin: #B9AD98;
  --color-ink-gold-text: #B08D2E;

  /* Feedback đúng/sai */
  --color-success-bg: #EAF6EC;
  --color-success-border: #7FBF8C;
  --color-success-text: #2E6B3A;
  --color-error-bg: #FCECEC;
  --color-error-border: #E09A9A;
  --color-error-text: #B23A3A;

  /* Font */
  --font-ui: "Nunito", system-ui, sans-serif;
  --font-han-title: "Noto Serif SC", serif;
  --font-han-body: "Noto Sans SC", sans-serif;

  /* Bo góc */
  --radius-card: 24px;
  --radius-card-sm: 22px;
  --radius-btn: 18px;
  --radius-pill: 999px;
}
```

Import font trong `app/layout.tsx` (Next.js `next/font/google`, KHÔNG dùng `<link>` thủ công như mockup — tránh render-blocking, đúng convention Next.js):

```tsx
import { Nunito, Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google'

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-ui' })
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-han-title' })
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-han-body' })
```

Áp `className` của cả 3 biến CSS vào thẻ `<html>` hoặc `<body>` trong root layout.

### Bảng tra cứu nhanh (dùng khi viết class Tailwind)

| Vai trò | Token | Giá trị gốc | Dùng cho |
|---|---|---|---|
| Nền trang | `bg-cream` | `#FBF6EC` | body/nền toàn trang |
| Nền card | `bg-card` | `#FFFDF8` | mọi card/box nội dung |
| Viền card | `border-card-border` | `#EFE4CE` | viền card |
| Nền box phụ (ví dụ, phân tích) | `bg-accent-bg` | `#FBF4E4` | box "Ví dụ", "Cách ghép câu" |
| Viền box phụ | `border-accent-border` | `#EFE1C4` | viền box phụ |
| Nút chính | `bg-brand-red` | `#C1272D` | nút "Tiếp theo", nút loa, nút xác nhận |
| Nút chính (hover/active) | `bg-brand-red-dark` | `#A21E23` | trạng thái nhấn |
| Nhấn phụ/badge | `text-brand-gold` / `border-brand-gold` | `#D4AF37` | badge số thứ tự, viền nhấn |
| Chữ chính | `text-ink` | `#2B2622` | tiêu đề, chữ Hán |
| Chữ phụ (nghĩa Việt) | `text-ink-muted` | `#7C7263` | nghĩa tiếng Việt |
| Chữ mờ (pinyin, ghi chú) | `text-ink-pinyin` / `text-ink-faint` | `#B9AD98` / `#9A8F7E` | pinyin, ghi chú nhỏ |
| Đúng | `bg-success-bg border-success-border text-success-text` | xanh lá nhạt | feedback câu đúng |
| Sai | `bg-error-bg border-error-border text-error-text` | đỏ nhạt | feedback câu sai |
| Font UI/tiếng Việt | `font-ui` | Nunito | toàn bộ text tiếng Việt, nút, label |
| Font tiêu đề Hán | `font-han-title` | Noto Serif SC | tiêu đề bài, số bài, icon-chữ trong badge tròn |
| Font nội dung Hán | `font-han-body` | Noto Sans SC | câu thoại, từ vựng, ví dụ chữ Hán |
| Bo góc card | `rounded-card` (24px) / `rounded-card-sm` (22px) | | card lớn / card nhỏ hơn (từ vựng, mẫu câu) |
| Bo góc nút | `rounded-btn` (18px) | | mọi nút chính |
| Bo góc viên (pill) | `rounded-pill` (999px) | | thanh tiến trình, dot, badge tròn |

### Shadow (dùng `shadow-[...]` arbitrary value của Tailwind, không cần token riêng vì ít chỗ dùng)

- Card: `shadow-[0_10px_30px_rgba(120,90,40,0.06)]` (card lớn) hoặc `shadow-[0_4px_16px_rgba(120,90,40,0.05)]` (card nhỏ trong danh sách)
- Nút đỏ: `shadow-[0_10px_24px_rgba(193,39,45,0.28)]`
- Nút loa tròn: `shadow-[0_4px_12px_rgba(193,39,45,0.22)]`

### Layout chung

- Container: `mx-auto max-w-[660px] px-5` (căn giữa, mobile-first, khớp `max-width:660px` của mockup — rộng hơn 1 chút so với Plan 1 hiện tại đang dùng `max-w-2xl`/`max-w-sm` generic, cần đồng bộ lại).
- Nền toàn trang: `min-h-screen bg-cream font-ui text-ink`.
- Thanh tiến trình 5 bước (Hội thoại/Từ mới/Ngữ pháp/Quiz/Gõ phản xạ — tên đã đổi so với 5 tên mockup gốc "Bài khóa/Từ vựng/Luyện từ/Câu mẫu/Luyện câu", xem mục "Khác biệt" dưới): dải 5 ô ngang `h-1.5 rounded-pill flex-1`, màu `bg-brand-gold` (đã qua) / `bg-brand-red` (đang ở) / `bg-card-border` (chưa tới) — component dùng chung `<ProgressSteps currentStep={n} />`.

## Khác biệt so với mockup gốc (điều chỉnh theo spec chức năng đã chốt)

Mockup được thiết kế cho **5 bước tuần tự bắt buộc** (Bài khóa → Từ vựng → Luyện từ → Câu mẫu → Luyện câu, có nút "Tiếp theo" nối tiếp). Spec chức năng (`2026-07-31-user-app-design.md` mục 3) đã chốt khác:

1. **5 khu vực NGANG HÀNG, tự do bấm, không có flow bắt buộc** — không phải 5 bước tuần tự có nút "Tiếp theo" nối cứng. Thanh tiến trình 5 ô vẫn dùng được (đẹp, quen thuộc) nhưng đóng vai trò **tab điều hướng** (bấm vào ô nào nhảy tới đó) thay vì thanh % tiến trình chỉ-đi-tới của mockup.
2. **Tên 5 khu vực khác:** Hội thoại (Shadowing) / Từ mới (Flashcard) / Ngữ pháp / Quiz / Gõ phản xạ — không phải Bài khóa/Từ vựng/Luyện từ/Câu mẫu/Luyện câu. Nội dung tương ứng gần nhất:
   - "Bài khóa" (mockup) ≈ phần đọc hội thoại tĩnh bên trong khu vực "Hội thoại" (spec mục 5) — nhưng khu vực Hội thoại còn có Shadowing (ghi âm, chấm điểm giọng nói) mà mockup không có.
   - "Từ vựng" (mockup) ≈ khu vực "Từ mới" (spec mục 4) — nhưng spec là Flashcard SRS (lật thẻ, tự đánh giá đúng/sai, thuật toán Leitner), không phải danh sách tĩnh có nút loa như mockup.
   - "Luyện từ" (mockup, trắc nghiệm 4 đáp án chọn nghĩa) ≈ gần với khu vực "Gõ phản xạ" tab "Gõ từ" (spec mục 8) về mặt vị trí trong flow, nhưng cơ chế khác hẳn (spec là gõ chữ Hán, không phải trắc nghiệm chọn nghĩa).
   - "Câu mẫu" (mockup, đọc công thức ngữ pháp) ≈ khu vực "Ngữ pháp" (spec mục 6) — khá khớp, cùng là hiển thị tĩnh + phân tích cấu trúc.
   - "Luyện câu" (mockup, sắp xếp từ thành câu) ≈ gần "Quiz" dạng `sentence_order` (1 trong 6 dạng quiz, spec mục 7) — nhưng Quiz thật có 6 dạng khác nhau, không chỉ sắp xếp câu.
3. **Kết luận:** style/component (card, nút, màu, font, box "Ví dụ"/"Phân tích") tái dùng trực tiếp; nhưng cấu trúc điều hướng và logic từng màn hình phải theo đúng spec chức năng đã chốt, KHÔNG copy nguyên luồng 5-bước-tuần-tự của mockup. Khi 1 màn hình cụ thể (ví dụ giao diện quiz `matching`/`tone_choice`) không có mockup tương ứng, implementer tự thiết kế theo đúng ngôn ngữ thị giác này (card kem, nút đỏ bo tròn, feedback xanh/đỏ nhạt) và hỏi người dùng nếu không chắc.

## Áp dụng cho Plan 1 (đã viết, cần cập nhật)

`docs/superpowers/plans/2026-07-31-scope-1-scaffold-auth-lessons.md` hiện dùng Tailwind generic (`bg-black`, `text-gray-500`, `max-w-2xl`...) — cần thay bằng token ở trên trước khi thực thi, để trang login/danh sách bài lên đúng phong cách ngay từ đầu thay vì phải sửa lại sau.
