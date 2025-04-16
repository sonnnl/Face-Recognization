# Hệ thống điểm danh bằng nhận diện khuôn mặt (Face Recognition Attendance System)

## Giới thiệu

Hệ thống điểm danh bằng nhận diện khuôn mặt là một ứng dụng web hiện đại giúp quản lý và theo dõi việc điểm danh sinh viên tự động thông qua công nghệ nhận diện khuôn mặt. Hệ thống cho phép quản lý lớp học, đăng ký sinh viên với dữ liệu khuôn mặt và thực hiện điểm danh tự động bằng camera.

## Tính năng chính

- **Quản lý người dùng**: Phân quyền Admin và Giảng viên
- **Quản lý lớp học**: Tạo, xem, chỉnh sửa và xóa lớp học
- **Đăng ký sinh viên**: Đăng ký sinh viên mới với thông tin cá nhân và dữ liệu khuôn mặt
- **Điểm danh tự động**: Nhận diện khuôn mặt và điểm danh tự động cho sinh viên
- **Xem danh sách sinh viên**: Xem và quản lý danh sách sinh viên theo lớp học
- **Xem lịch sử điểm danh**: Theo dõi và xuất báo cáo lịch sử điểm danh của từng lớp học

## Công nghệ sử dụng

- **Frontend**:

  - React.js
  - TailwindCSS
  - Heroicons
  - face-api.js (Thư viện nhận diện khuôn mặt dựa trên TensorFlow.js)
  - React Router DOM
  - React Toastify
  - Axios

- **Backend**:

  - Node.js
  - Express.js
  - JWT (JSON Web Tokens)
  - Bcrypt

- **Database**:
  - MongoDB
  - Mongoose

## Hướng dẫn cài đặt

### Yêu cầu hệ thống

- Node.js (>= 14.x)
- MongoDB
- Webcam hoạt động
- Trình duyệt hiện đại (Chrome, Firefox, Edge)

### Cài đặt

1. Clone repository:

```bash
git clone https://github.com/yourusername/face-attendance-system.git
cd face-attendance-system
```

2. Cài đặt dependencies:

```bash
npm install
```

3. Cấu hình môi trường:
   Tạo file `.env` trong thư mục gốc:

```
MONGODB_URI=mongodb://localhost:27017/face_attendance_system
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

4. Tạo tài khoản admin gốc:

```bash
npm run create-admin
```

5. Khởi động ứng dụng:

```bash
# Khởi động server backend
npm run server

# Trong terminal khác, khởi động frontend
npm run dev
```

6. Truy cập ứng dụng: http://localhost:3000

## Cấu trúc dự án

```
face-attendance-system/
├── public/                # Tài nguyên tĩnh
├── scripts/               # Script tiện ích
│   └── create-root-admin.js  # Tạo tài khoản admin gốc
├── server/                # Mã nguồn backend
│   └── index.js           # Server Express và API endpoints
├── src/                   # Mã nguồn frontend
│   ├── components/        # React components
│   │   ├── admin/         # Components cho giao diện admin
│   │   ├── Attendance.jsx # Component điểm danh
│   │   ├── Register.jsx   # Component đăng ký sinh viên
│   │   └── ...
│   ├── config/            # Cấu hình (axios, etc.)
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── middleware/        # Middleware
│   ├── models/            # Mô hình dữ liệu
│   ├── App.jsx            # Component gốc và định tuyến
│   ├── index.css          # Stylesheet
│   └── main.jsx           # Điểm khởi đầu ứng dụng
├── .env                   # Biến môi trường
├── .gitignore             # Git ignore file
├── index.html             # HTML template
├── package.json           # Cấu hình npm và dependencies
├── postcss.config.js      # Cấu hình PostCSS
├── tailwind.config.js     # Cấu hình TailwindCSS
└── vite.config.js         # Cấu hình Vite
```

## Hướng dẫn sử dụng

### Quản lý người dùng (Admin)

1. Đăng nhập với tài khoản admin
2. Truy cập "Quản lý giảng viên" để xem danh sách người dùng
3. Bạn có thể thêm, sửa, hoặc xóa tài khoản giảng viên
4. Mỗi tài khoản có thể được phân quyền admin hoặc giảng viên

### Quản lý lớp học

1. Truy cập "Lớp học" (dành cho giảng viên) hoặc "Quản lý lớp học" (dành cho admin)
2. Xem danh sách lớp học hiện có
3. Bạn có thể thêm lớp mới với thông tin: tên lớp, mô tả, ngày bắt đầu và số buổi học
4. Admin có thể chỉ định giảng viên phụ trách cho mỗi lớp học

### Đăng ký sinh viên

1. Truy cập trang "Đăng ký sinh viên"
2. Nhập thông tin sinh viên: họ tên, mã số sinh viên
3. Chọn lớp học muốn đăng ký
4. Bấm "Chụp khuôn mặt" để chụp và lưu đặc trưng khuôn mặt
5. Xem khuôn mặt đã chụp với các landmarks được hiển thị
6. Khi hài lòng, bấm "Đăng ký" để hoàn tất

### Điểm danh

1. Truy cập trang "Điểm danh"
2. Chọn lớp học từ dropdown
3. Đảm bảo camera được kích hoạt
4. Bấm "Bắt đầu điểm danh" để bắt đầu phiên điểm danh
5. Khi sinh viên đặt khuôn mặt trước camera, hệ thống sẽ tự động nhận diện và điểm danh
6. Sau khi điểm danh xong, bấm "Kết thúc" để lưu phiên điểm danh

### Xem lịch sử điểm danh

1. Truy cập trang "Lịch sử điểm danh"
2. Chọn lớp học và ngày cần xem
3. Xem danh sách sinh viên và trạng thái điểm danh của từng buổi học
4. Có thể xuất dữ liệu điểm danh ra file Excel để báo cáo

## API Endpoints chính

### Xác thực

- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký giảng viên
- `POST /api/auth/admin-register` - Đăng ký quản trị viên

### Classes (Lớp học)

- `GET /api/classes` - Lấy danh sách lớp học
- `POST /api/classes` - Tạo lớp học mới
- `PUT /api/classes/:id` - Cập nhật thông tin lớp học
- `DELETE /api/classes/:id` - Xóa lớp học

### Students (Sinh viên)

- `GET /api/students/class/:classId` - Lấy sinh viên theo lớp
- `POST /api/students` - Thêm sinh viên mới
- `PUT /api/students/:id` - Cập nhật thông tin sinh viên
- `DELETE /api/students/:id` - Xóa sinh viên

### Attendance (Điểm danh)

- `POST /api/attendance/start` - Bắt đầu phiên điểm danh
- `POST /api/attendance/mark` - Điểm danh cho sinh viên
- `GET /api/attendance/history/:classId` - Lấy lịch sử điểm danh
- `GET /api/attendance/export/:classId` - Xuất dữ liệu điểm danh

### Admin

- `GET /api/admin/teachers` - Lấy danh sách giáo viên (admin)
- `PUT /api/admin/teachers/:id` - Cập nhật thông tin giáo viên (admin)
- `DELETE /api/admin/teachers/:id` - Xóa tài khoản giáo viên (admin)
- `PUT /api/admin/classes/:id/teacher` - Đổi giáo viên phụ trách lớp (admin)

## Cập nhật và chuyển đổi mô hình

Hệ thống đã cập nhật từ mô hình `Teacher` sang mô hình `Account` để quản lý người dùng tốt hơn. Thay đổi này cho phép:

1. Quản lý tất cả các loại người dùng (Admin và Giáo viên) trong một mô hình thống nhất
2. Phân quyền linh hoạt thông qua trường `role`
3. Hỗ trợ cho việc mở rộng vai trò người dùng trong tương lai

Các API endpoint và thành phần UI đã được cập nhật để phản ánh thay đổi này, sử dụng `req.account` thay vì `req.teacher` trong các middleware xác thực.

## Xử lý sự cố

### Camera không hiển thị

- Đảm bảo bạn đã cấp quyền truy cập camera cho trang web
- Kiểm tra xem thiết bị có camera hoạt động không
- Tải lại trang và thử lại

### Không thể nhận diện khuôn mặt

- Đảm bảo khuôn mặt hiển thị rõ ràng và đủ ánh sáng
- Thử điều chỉnh góc camera hoặc vị trí khuôn mặt
- Kiểm tra xem sinh viên đã được đăng ký với hình ảnh khuôn mặt chưa

### Không thể xóa lớp học

- Chỉ có thể xóa các lớp học chưa có sinh viên đăng ký
- Nếu lớp có sinh viên, cần chuyển sinh viên sang lớp khác trước khi xóa

### Lỗi 404 khi truy cập API

- Kiểm tra xem server backend đã được khởi động chưa
- Đảm bảo đường dẫn API endpoint đúng
- Kiểm tra quyền người dùng hiện tại có phù hợp không

## Phát triển

Dự án sử dụng:

- Vite làm development server và build tool
- TailwindCSS để styling
- MongoDB làm cơ sở dữ liệu

Để phát triển:

```bash
# Khởi động dev server với hot reload
npm run dev
```
