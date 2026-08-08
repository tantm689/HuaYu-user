import { BookOpenText } from 'lucide-react'
import GuideAccordionItem from '@/components/GuideAccordionItem'

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

      <section className="mb-5">
        <h2 className="mb-3 px-1 font-han-title text-xl font-bold text-ink">Hội thoại</h2>

        <div className="flex flex-col gap-2.5">
          <GuideAccordionItem title="2 tab: Nghe hội thoại & Shadowing" defaultOpen>
            <p>
              Vào 1 bài học → tab &quot;Hội thoại&quot; → chọn bài hội thoại (hoặc đoạn văn, với sách từ quyển 2)
              → 2 tab nhỏ bên trong:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Nghe hội thoại</strong> — mỗi câu hiện dạng bong bóng tin nhắn, avatar tròn theo từng
                người nói. Bấm vào 1 câu để nghe phát âm chuẩn của câu đó. Nút &quot;Ẩn/Hiện pinyin &amp;
                nghĩa&quot; ở đầu trang giúp ẩn cả pinyin lẫn nghĩa tiếng Việt cùng lúc cho toàn bộ danh sách —
                dùng để tự luyện nghe hiểu chỉ bằng chữ Hán trước khi đối chiếu lại.
              </li>
              <li>
                <strong>Shadowing</strong> — luyện nói theo, có ghi âm và chấm điểm phát âm tự động.
              </li>
            </ul>
          </GuideAccordionItem>

          <GuideAccordionItem title="Cách phát audio mẫu ở Shadowing">
            <p>
              Nhóm 4 nút tròn — <strong>Câu trước</strong>, <strong>Phát lại từ đầu</strong> (quay về câu 1 và tự
              phát), <strong>Play/Tạm dừng</strong>, <strong>Câu sau</strong> — cùng với công tắc{' '}
              <strong>&quot;Tự động dừng&quot;</strong> nằm chung 1 hàng.
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Bật &quot;Tự động dừng&quot;</strong> (mặc định): audio phát hết 1 câu thì tự dừng lại,
                chờ bạn ghi âm luyện theo câu đó rồi mới qua câu tiếp — có chấm điểm.
              </li>
              <li>
                <strong>Tắt &quot;Tự động dừng&quot;</strong>: audio phát nối tiếp hết cả bài không dừng, giống
                nghe 1 bản ghi liền mạch. Vẫn ghi âm và nghe lại giọng mình được, nhưng{' '}
                <strong>không chấm điểm</strong> vì không xác định được bạn đang luyện đúng câu nào.
              </li>
            </ul>
            <p className="mt-2">
              Thanh thời gian phía trên tính gộp cho cả bài (không phải riêng từng câu) và kéo được để nhảy tới
              bất kỳ câu nào; nút <strong>1x</strong> đổi tốc độ phát lần lượt 1x → 1.25x → 0.75x → 1x.
            </p>
          </GuideAccordionItem>

          <GuideAccordionItem title="Cách chấm điểm phát âm">
            <p>
              Bấm <strong>&quot;Ghi âm&quot;</strong> → đọc theo câu mẫu → bấm <strong>&quot;Dừng ghi âm&quot;</strong>{' '}
              → kết quả hiện ra tự động, không cần bấm thêm nút nào khác. Bấm{' '}
              <strong>&quot;Phát lại ghi âm&quot;</strong> để nghe lại chính giọng mình vừa ghi.
            </p>
            <p className="mt-2">
              Chấm dựa theo <strong>pinyin không dấu</strong> ở từng âm tiết, không so khớp mặt chữ hay dấu
              thanh tuyệt đối — nên đọc đúng âm nhưng chọn nhầm chữ đồng âm (ví dụ 他/她 đều đọc &quot;tā&quot;)
              vẫn được tính đúng. 3 mức kết quả:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong className="text-success-text">Phát âm chính xác</strong> — khớp hoàn toàn.
              </li>
              <li>
                <strong className="text-ink-gold-text">Gần đúng, cố lên</strong> — phần lớn âm tiết khớp, sai
                một vài âm hoặc thanh điệu.
              </li>
              <li>
                <strong className="text-error-text">Chưa chính xác</strong> — sai nhiều âm tiết, nên đọc lại.
              </li>
            </ul>
          </GuideAccordionItem>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 px-1 font-han-title text-xl font-bold text-ink">Ngữ pháp</h2>

        <div className="flex flex-col gap-2.5">
          <GuideAccordionItem title="Cách dùng" defaultOpen>
            <p>
              Vào 1 bài học → tab &quot;Ngữ pháp&quot; → mỗi điểm ngữ pháp lớn của bài là 1 mục có thể bấm mở/thu
              gọn, đánh số <strong>I, II, III...</strong> theo đúng thứ tự trong sách. Bên trong, nếu điểm ngữ
              pháp có nhiều cách dùng nhỏ hơn, chúng được chia tiếp thành đề mục <strong>A, B, C...</strong>, và
              các nhãn viết hoa in đậm màu đỏ như <strong>CHỨC NĂNG</strong>, <strong>CẤU TRÚC</strong>,{' '}
              <strong>CÁCH DÙNG</strong> đánh dấu từng phần giải thích lấy nguyên văn từ sách.
            </p>
            <p className="mt-2 font-semibold text-brand-red">
              Mẹo học: với mỗi câu ví dụ, thử tự che phần dịch tiếng Việt lại, đọc chữ Hán/pinyin trước và đoán
              nghĩa — chỉ mở phần dịch ra để đối chiếu sau khi đã thử. Đọc suông một lượt không giúp nhớ lâu bằng
              tự đoán trước.
            </p>
            <p className="mt-2">
              Sau khi đọc xong 1 điểm ngữ pháp, sang tab <strong>Quiz → Phần 2</strong> làm thử vài câu liên quan
              để tự kiểm tra xem đã hiểu đúng cách dùng hay chưa, thay vì chỉ đọc qua rồi bỏ đó.
            </p>
          </GuideAccordionItem>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 px-1 font-han-title text-xl font-bold text-ink">Gõ phản xạ</h2>

        <div className="flex flex-col gap-2.5">
          <GuideAccordionItem title="2 chế độ luyện gõ" defaultOpen>
            <p>
              Vào 1 bài học → tab &quot;Gõ phản xạ&quot; → chọn 1 trong 2 chế độ:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Gõ từ mới</strong> — danh sách toàn bộ từ vựng của bài hiện dưới dạng bảng, gõ lại từng
                từ vào ô tương ứng.
              </li>
              <li>
                <strong>Gõ câu hội thoại</strong> — gõ lại từng câu trong bài khoá theo đúng thứ tự xuất hiện,
                từng câu một.
              </li>
            </ul>
          </GuideAccordionItem>

          <GuideAccordionItem title="Cách chấm điểm & phím tắt">
            <p>
              Chấm đúng/sai bằng cách so khớp <strong>chính xác từng chữ Hán</strong> bạn gõ với đáp án — không
              cần gõ đúng pinyin, chỉ cần đúng mặt chữ. Dấu câu gõ kiểu nửa-độ-rộng (<code>,</code> <code>.</code>{' '}
              <code>?</code> <code>!</code>) được tự động đổi sang toàn-độ-rộng (
              <span className="font-han-body">，。？！</span>) khi chấm, nên không cần lo gõ sai kiểu dấu.
            </p>
            <p className="mt-2">
              Bấm <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">Enter</kbd> để
              chấm câu đang gõ; bấm <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">Enter</kbd>{' '}
              lần nữa sau khi đã có kết quả để chuyển sang câu/từ tiếp theo.
            </p>
          </GuideAccordionItem>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 px-1 font-han-title text-xl font-bold text-ink">Quiz</h2>

        <div className="flex flex-col gap-2.5">
          <GuideAccordionItem title="Các dạng câu hỏi" defaultOpen>
            <p>
              Vào 1 bài học → tab &quot;Quiz&quot; → chọn Phần 1 hoặc Phần 2, mỗi phần gồm 15 câu:
            </p>
            <p className="mt-2 font-semibold text-ink">Phần 1 — Nhận biết từ vựng &amp; phát âm:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>
                <strong>Chọn pinyin/chữ Hán</strong> — cho chữ Hán hỏi pinyin đúng, hoặc ngược lại.
              </li>
              <li>
                <strong>Nghe và chọn</strong> — nghe audio phát âm 1 từ, chọn đúng nghĩa/chữ Hán.
              </li>
              <li>
                <strong>Chọn thanh điệu</strong> — cho chữ Hán và pinyin không dấu, chọn đúng thanh điệu.
              </li>
            </ul>
            <p className="mt-2 font-semibold text-ink">Phần 2 — Vận dụng câu &amp; ngữ pháp:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>
                <strong>Nối từ</strong> — nối chữ Hán với đúng nghĩa tiếng Việt.
              </li>
              <li>
                <strong>Điền vào chỗ trống</strong> — chọn đúng từ chức năng ngữ pháp (trợ từ, phó từ...) để hoàn
                thành câu.
              </li>
              <li>
                <strong>Sắp xếp câu</strong> — sắp xếp lại các từ/cụm từ đã xáo trộn thành câu đúng.
              </li>
            </ul>
          </GuideAccordionItem>

          <GuideAccordionItem title="Làm lại để luyện thêm">
            <p>
              Mỗi lần bấm <strong>&quot;Làm lại&quot;</strong> ở màn kết quả, cả thứ tự 15 câu lẫn vị trí các
              lựa chọn trong từng câu đều được xáo lại từ đầu — nên có thể làm đi làm lại nhiều lần mà không lo
              học thuộc vị trí đáp án thay vì thuộc kiến thức thật.
            </p>
          </GuideAccordionItem>
        </div>
      </section>

    </div>
  )
}
