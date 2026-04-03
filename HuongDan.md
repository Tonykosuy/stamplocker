# Hướng Dẫn Cấu Hình Google Apps Script Backend (StampLocker)

Để ứng dụng StampLocker có thể lưu ảnh và thông tin trực tiếp vào Google Sheets (không cần qua Google Drive), bạn cần làm theo các bước dưới đây:

## Bước 1: Tạo Google Sheets
1. Truy cập [Google Sheets](https://sheets.google.com) và tạo một Bảng tính (Spreadsheet) trống mới. Đặt tên tùy ý (VD: `StampLocker Database`).
2. Ở dòng đầu tiên (Header), hãy nhập 3 cột để dễ nhìn (Mã nguồn sẽ tự động tạo nếu bạn để trống):
   - Cột A: `Timestamp` (Thời gian chụp)
   - Cột B: `ImageData` (Dữ liệu ảnh dạng chuỗi ký tự)
   - Cột C: `Caption` (Lời nhắn)

> [!IMPORTANT]
> **Lưu ý về dung lượng**: Vì ảnh được lưu trực tiếp vào ô trong Sheet dưới dạng văn bản (Base64), tôi đã lập trình để ứng dụng tự động giảm dung lượng ảnh trước khi gửi. Bạn không nên thay đổi code resize để tránh vượt quá giới hạn 50.000 ký tự của một ô trong Google Sheets.

## Bước 2: Dán Code Google Apps Script (GAS)
1. Ở giao diện Google Sheets, chọn menu **Tiện ích mở rộng (Extensions)** > **Apps Script**.
2. Một tab mới mở ra. Đổi tên dự án ở góc trên bên trái thành "StampLocker Backend".
3. Xóa nội dung có sẵn trong file `Code.gs` và dán toàn bộ nội dung từ file `Code.gs` trong thư mục dự án này vào.
4. Bấm **Ctrl + S** (hoặc biểu tượng Đĩa mềm) để lưu lại.

## Bước 3: Deploy làm Web App (Triển khai ứng dụng)
1. Tại góc trên cùng bên phải giao diện Apps Script, bấm vào nút **Triển khai (Deploy)** > **Triển khai mới (New deployment)**.
2. Bấm vào biểu tượng Bánh răng (⚙️) kế bên "Chọn loại (Select type)" và đánh dấu tích vào **Ứng dụng web (Web app)**.
3. Trong phần cấu hình hiện ra:
   - Thêm mô tả: (Có thể bỏ qua)
   - **Thực thi dưới dạng (Execute as)**: Chọn **Tôi (You - email của bạn)**.
   - **Ai có quyền truy cập (Who has access)**: **Cực kỳ quan trọng**, bạn PHẢI chọn **Bất kỳ ai (Anyone)**.
4. Bấm **Triển khai (Deploy)**.
5. Google sẽ yêu cầu Cấp Quyền (Authorize access). Bấm xem xét quyền, chọn tài khoản Google của bạn, bấm Advanced (Nâng cao) và chọn **Đi tới (Go to) StampLocker (không an toàn)**, sau đó bấm **Cho phép (Allow)**.

## Bước 4: Lấy Web App URL và Dán vào Script
1. Sau khi cấp quyền thành công, màn hình sẽ hiển thị 1 đường dẫn gọi là **Web app URL** (bắt đầu bằng `https://script.google.com/macros/s/.../exec`).
2. Bấm **Sao chép (Copy)** URL này.
3. Quay lại code của ứng dụng StampLocker, mở file `script.js`.
4. Tìm dòng trên cùng có chứa: `const SCRIPT_URL = "YOUR_WEB_APP_URL_HERE";`
5. Thay thế `"YOUR_WEB_APP_URL_HERE"` bằng Web app URL mà bạn vừa copy vào (nhớ giữ nguyên hai dấu ngoặc kép `" `).

## Xong!
Bây giờ bộ mã đã sẵn sàng chạy.

> **Lưu ý để chạy Camera:** Để trình duyệt cho phép bật Camera, file `index.html` của bạn phải được mở trên một máy chủ cục bộ (Live Server) hoặc được host trên mạng internet bằng giao thức HTTPS (ví dụ như ném lên Vercel, Github Pages). Bạn không thể trực tiếp click đúp mở file html dạng `file:///...` vì trình duyệt sẽ chặn quyền camera vì lý do bảo mật.
