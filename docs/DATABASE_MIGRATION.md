# Hướng dẫn Cải thiện và Di chuyển Cơ sở dữ liệu

## Vấn đề được xác định

Hệ thống điểm danh khuôn mặt trước đây có một số vấn đề cấu trúc:

1. **Không nhất quán trong tham chiếu**:

   - Sử dụng cả `Teacher` và `Account` để tham chiếu đến người dùng có vai trò giảng viên
   - Sử dụng tham chiếu không đúng trong các trường `createdBy` của model `Attendance`

2. **Dư thừa dữ liệu**:

   - Mô hình `Attendance` có mảng `students` nhúng trong khi cũng có mô hình riêng `AttendanceRecord`
   - Điều này dẫn đến dữ liệu điểm danh bị lưu trữ ở hai nơi khác nhau

3. **Lỗi khi khởi động**:
   - Hệ thống cố gắng xóa các chỉ mục trên collection không tồn tại, gây ra lỗi khi khởi động

## Các thay đổi đã được thực hiện

### 1. Cập nhật tham chiếu từ Teacher sang Account

- Đã cập nhật trường `createdBy` trong `Attendance` model để tham chiếu đến `Account` thay vì `Teacher`
- Đã cập nhật các API endpoint để sử dụng `Account` thay vì `Teacher`

### 2. Hợp nhất và loại bỏ dư thừa dữ liệu

- Đã loại bỏ mảng `students` nhúng trong `Attendance` model
- Đã cải thiện `Attendance` model để thêm các trường thống kê (`stats`) cho tổng kết điểm danh
- Đã đảm bảo rằng tất cả dữ liệu điểm danh đều được lưu trữ trong `AttendanceRecord` để tránh trùng lặp

### 3. Sửa lỗi khởi động liên quan đến chỉ mục

- Đã thêm kiểm tra sự tồn tại của collection trước khi thử xóa các chỉ mục
- Đảm bảo rằng các lỗi liên quan đến namespace không tìm thấy không còn xảy ra nữa

## Cách chạy Migration

Chúng tôi đã tạo một tập lệnh di chuyển để giúp di chuyển dữ liệu từ cấu trúc cũ sang cấu trúc mới. Để chạy migration:

```bash
node scripts/dataModelMigration.js
```

Script này sẽ thực hiện các hoạt động sau:

1. Cập nhật tham chiếu `createdBy` trong `Attendance` từ `Teacher` sang `Account`
2. Di chuyển dữ liệu sinh viên từ mảng `students` nhúng trong `Attendance` sang các bản ghi `AttendanceRecord` riêng lẻ
3. Kiểm tra và đảm bảo các lớp học tham chiếu đúng đến `Account` của giảng viên

## Các API bị ảnh hưởng

Các API endpoint sau đã được cập nhật:

1. `/api/teachers/profile/:accountId` - Bây giờ trả về thông tin từ `Account` thay vì `Teacher`
2. `/api/teacher/attendance/start` - Sử dụng `req.account._id` cho trường `createdBy`
3. Nhiều API khác đã được kiểm tra để đảm bảo nhất quán

## Lưu ý

- Mô hình `Teacher` vẫn được giữ lại cho khả năng tương thích ngược với các phần của ứng dụng có thể vẫn đang sử dụng nó
- Trong tương lai, chúng ta nên cân nhắc loại bỏ hoàn toàn mô hình `Teacher` và di chuyển các trường liên quan vào `Account`

## Hướng dẫn Kiểm tra

1. Khởi động ứng dụng và đảm bảo không có lỗi liên quan đến chỉ mục hoặc collection xuất hiện
2. Đăng nhập với tài khoản giảng viên và xác nhận bạn có thể xem thông tin lớp học và điểm danh
3. Thử bắt đầu một phiên điểm danh mới để đảm bảo chức năng này hoạt động đúng
4. Xác nhận dữ liệu điểm danh hiển thị chính xác trên giao diện người dùng
