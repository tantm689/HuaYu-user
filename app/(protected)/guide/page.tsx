import { BookOpenText, Keyboard, Mic, PenSquare } from 'lucide-react'
import GuideAccordionItem from '@/components/GuideAccordionItem'

const upcoming = [
  {
    icon: Mic,
    title: 'Hội thoại (Shadowing)',
    description: 'Luyện nghe và nói theo hội thoại trong bài, chấm điểm phát âm tự động.',
  },
  {
    icon: PenSquare,
    title: 'Quiz',
    description: 'Làm bài kiểm tra ngắn để tự đánh giá mức độ nắm bài.',
  },
  {
    icon: Keyboard,
    title: 'Gõ phản xạ',
    description: 'Luyện gõ lại chữ Hán và câu hội thoại để ghi nhớ mặt chữ.',
  },
]

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          <BookOpenText className="h-3.5 w-3.5" strokeWidth={2.5} />
          Hướng dẫn học
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Cách sử dụng HuaYu</h1>
        <p className="mt-2 text-sm font-medium text-ink-faint">Bấm vào từng mục bên dưới để xem chi tiết.</p>
      </div>

      <section className="mb-5">
        <h2 className="mb-3 px-1 font-han-title text-xl font-bold text-ink">Học từ mới bằng Flashcard</h2>

        <div className="flex flex-col gap-2.5">
          <GuideAccordionItem title="Cách dùng" defaultOpen>
            <p>
              Vào 1 bài học → tab &quot;Từ mới&quot; → chọn bộ từ theo hội thoại → bấm &quot;Bắt đầu học với
              FlashCard&quot;. Chỉ xem bảng từ mà chưa bấm nút này thì <strong>không tính</strong> là đang học, cứ
              thoải mái xem trước không sợ bị tính nhầm.
            </p>
            <p className="mt-2 font-semibold text-brand-red">
              Lưu ý: chỉ bấm &quot;Bắt đầu học với FlashCard&quot; cho những bài bạn thực sự đã học tới trên lớp.
              Bấm vào bài chưa học tới (kể cả để thử cho biết) sẽ kích hoạt toàn bộ từ trong bộ đó vào hệ thống
              ôn tập, khiến chúng bị cộng dồn vào &quot;Ôn hôm nay&quot; dù bạn chưa thực sự học.
            </p>
            <p className="mt-2">
              Mỗi thẻ: xem chữ Hán, tự đoán nghĩa, bấm/lật (phím{' '}
              <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">Space</kbd>) để xem
              pinyin, nghĩa, cách viết nét chữ và nghe phát âm. Sau đó tự đánh giá{' '}
              <strong>← Chưa thuộc</strong> hoặc <strong>Đã thuộc →</strong>. Lỡ đánh giá nhầm thì bấm nút mũi tên
              cong (góc dưới trái) để quay lại thẻ vừa rồi, kể cả đã lưu.
            </p>
          </GuideAccordionItem>

          <GuideAccordionItem title="Cơ chế đằng sau: vì sao có từ hiện lại sớm, có từ hiện lại rất muộn">
            <p>
              Mỗi từ được xếp vào 1 trong 6 &quot;hộp&quot; (box 0 → box 5). Hộp càng cao nghĩa là bạn nhớ từ đó
              càng chắc, và khoảng cách trước khi web nhắc ôn lại càng dài:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-ink-faint">
                    <th className="py-1.5 pr-3 font-semibold">Hộp (box)</th>
                    <th className="py-1.5 font-semibold">Lần tới sẽ được nhắc ôn sau</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-card-border/60">
                    <td className="py-1.5 pr-3">Box 0 — từ mới, chưa thuộc</td>
                    <td className="py-1.5">Ngay lập tức (hiện lại trong lượt học hiện tại)</td>
                  </tr>
                  <tr className="border-b border-card-border/60">
                    <td className="py-1.5 pr-3">Box 1</td>
                    <td className="py-1.5">1 ngày</td>
                  </tr>
                  <tr className="border-b border-card-border/60">
                    <td className="py-1.5 pr-3">Box 2</td>
                    <td className="py-1.5">3 ngày</td>
                  </tr>
                  <tr className="border-b border-card-border/60">
                    <td className="py-1.5 pr-3">Box 3</td>
                    <td className="py-1.5">7 ngày</td>
                  </tr>
                  <tr className="border-b border-card-border/60">
                    <td className="py-1.5 pr-3">Box 4</td>
                    <td className="py-1.5">14 ngày</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">Box 5 — đã thuộc chắc</td>
                    <td className="py-1.5">30 ngày</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3">Quy tắc lên/xuống hộp mỗi khi bạn đánh giá 1 thẻ:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Từ mới (box 0)</strong> chưa lên box 1 ngay cả khi bạn đánh giá &quot;Đã thuộc&quot; —
                phải đánh giá đúng <strong>3 lần liên tiếp</strong> (không được sai lần nào ở giữa) mới chính thức
                lên box 1. Đánh giá &quot;Chưa thuộc&quot; dù chỉ 1 lần sẽ làm mất hết số lần đúng đã tích, về lại
                0/3 nhưng vẫn ở box 0, và từ đó hiện lại ngay trong lượt học hiện tại để bạn học lại từ đầu.
              </li>
              <li>
                <strong>Từ đã ở box 1 trở lên</strong>: đánh giá &quot;Đã thuộc&quot; thì lên thêm đúng 1 hộp (ví
                dụ box 2 → box 3). Đánh giá &quot;Chưa thuộc&quot; thì rớt thẳng về <strong>box 1</strong> (không
                về box 0), tức là dù đã học lâu, quên 1 lần cũng chỉ lùi về mốc &quot;ôn lại sau 1 ngày&quot; chứ
                không phải học lại từ đầu.
              </li>
              <li>Box 5 là hộp cao nhất — đánh giá đúng ở box 5 vẫn giữ nguyên box 5, chỉ dời lịch ôn tiếp thêm 30 ngày.</li>
            </ul>
          </GuideAccordionItem>

          <GuideAccordionItem title="Trộn thẻ & Đặt lại thẻ">
            <p>
              Nút bánh răng (góc dưới phải) mở 2 tuỳ chọn: <strong>Trộn thẻ</strong> — xáo thứ tự các thẻ chưa học
              tới (thẻ đang xem giữ nguyên), bật/tắt được, tắt là quay lại thứ tự ban đầu; và{' '}
              <strong>Đặt lại thẻ</strong> — bỏ lượt học đang dở, học lại từ thẻ đầu tiên của cả bộ.
            </p>
          </GuideAccordionItem>

          <GuideAccordionItem title={'"Ôn hôm nay" ở trang chủ là gì?'}>
            <p>
              Ngay khi bạn bấm &quot;Bắt đầu học với FlashCard&quot; ở bất kỳ bài nào, mỗi từ trong bộ đó được gán
              vào box 0 và có 1 mốc thời gian &quot;đến hạn ôn&quot; riêng, tính theo đúng bảng box ở mục trên. Web
              tự theo dõi mốc này cho từng từ, không cần bạn nhớ.
            </p>
            <p className="mt-2">
              Khối màu vàng nhạt <strong>&quot;Ôn hôm nay&quot;</strong> ở Trang chủ đếm tất cả các từ đã &quot;đến
              hạn&quot; (mốc thời gian đã tới hoặc đã qua), gộp chung từ TẤT CẢ các bài bạn từng học — không chỉ 1
              bài. Bấm vào đó để ôn lại toàn bộ số từ này trong 1 phiên, thao tác lật thẻ và đánh giá giống hệt
              mục &quot;Cách dùng&quot;.
            </p>
            <p className="mt-2">
              Nói cách khác: từ càng lâu chưa quên (box cao) thì càng lâu mới xuất hiện lại ở đây; từ mới học hoặc
              vừa bị đánh giá &quot;Chưa thuộc&quot; thì sẽ xuất hiện lại sớm hơn nhiều.
            </p>
          </GuideAccordionItem>
        </div>
      </section>

      <section className="rounded-card border border-card-border bg-white p-6 shadow-sm">
        <h2 className="font-han-title text-xl font-bold text-ink">Các tính năng khác</h2>
        <p className="mt-1 text-sm font-medium text-ink-faint">Đang được xây dựng, sẽ có hướng dẫn khi ra mắt.</p>

        <ul className="mt-4 flex flex-col gap-3">
          {upcoming.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.title}
                className="flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-ink">{item.title}</span>
                  <span className="text-sm font-medium text-ink-faint">{item.description}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
