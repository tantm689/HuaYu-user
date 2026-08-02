/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Toàn bộ app hiển thị dữ liệu cá nhân hóa (tiến độ SRS, danh sách ôn hôm nay...)
    // thay đổi liên tục do chính người dùng tương tác — client-side router cache mặc
    // định (30s cho route dynamic) khiến quay lại 1 trang qua <Link>/router.back()
    // hiện số liệu cũ cho đến khi hết hạn cache hoặc refresh thủ công. Tắt hẳn để mọi
    // lần điều hướng đều fetch lại dữ liệu mới nhất từ server.
    staleTimes: {
      dynamic: 0,
    },
  },
}

export default nextConfig
