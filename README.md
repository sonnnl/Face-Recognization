# Face Recognition Attendance System

## Giới thiệu

Hệ thống điểm danh bằng nhận diện khuôn mặt giúp quản lý và theo dõi việc điểm danh sinh viên tự động thông qua công nghệ nhận diện khuôn mặt. Hệ thống cho phép tạo lớp học, đăng ký sinh viên với dữ liệu khuôn mặt và điểm danh tự động bằng camera.

## Tính năng chính

- **Quản lý lớp học**: Tạo, xem và xóa lớp học
- **Đăng ký sinh viên**: Đăng ký sinh viên mới với thông tin cá nhân và dữ liệu khuôn mặt
- **Điểm danh tự động**: Nhận diện khuôn mặt và điểm danh tự động cho sinh viên
- **Xem danh sách sinh viên**: Xem danh sách sinh viên theo lớp học
- **Xem lịch sử điểm danh**: Theo dõi lịch sử điểm danh của từng lớp học

## Công nghệ sử dụng

- **Frontend**: React.js, TailwindCSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Nhận diện khuôn mặt**: face-api.js (dựa trên TensorFlow.js)

## Hướng dẫn cài đặt

### Yêu cầu hệ thống

- Node.js (>= 14.x)
- MongoDB
- Webcam hoạt động
- Trình duyệt hiện đại (Chrome, Firefox, Edge)

### Cài đặt

1. Clone repository:

```
git clone https://github.com/yourusername/face-attendance-system.git
cd face-attendance-system
```

2. Cài đặt dependencies:

```
npm install
cd client
npm install
```

3. Cấu hình môi trường:
   Tạo file `.env` trong thư mục gốc:

```
MONGODB_URI=mongodb://localhost:27017/(tên database ở local)
PORT=5000
```

4. Khởi động ứng dụng:

```
# Terminal 1 - Start server
npm run server

# Terminal 2 - Start client
npm run client
```

5. Truy cập ứng dụng: http://localhost:3000

## Hướng dẫn sử dụng

### Quản lý lớp học

1. Truy cập trang "Quản lý lớp học"
2. Nhập tên lớp và bấm "Thêm lớp" để tạo lớp mới
3. Xem danh sách lớp học và số lượng sinh viên trong mỗi lớp
4. Xóa lớp học (chỉ có thể xóa các lớp chưa có sinh viên)

### Đăng ký sinh viên

1. Truy cập trang "Đăng ký"
2. Nhập thông tin sinh viên: họ tên, mã số sinh viên
3. Chọn lớp học muốn đăng ký
4. Bấm "Chụp khuôn mặt" để chụp và lưu đặc trưng khuôn mặt
5. Xem khuôn mặt đã chụp với các landmarks được hiển thị
6. Nếu không hài lòng, bấm "Chụp lại"
7. Khi hài lòng, bấm "Đăng ký" để hoàn tất

### Điểm danh

1. Truy cập trang "Điểm danh"
2. Chọn lớp học từ dropdown
3. Đảm bảo camera được kích hoạt
4. Khi học sinh đặt khuôn mặt trước camera, bấm "Nhận diện khuôn mặt"
5. Hệ thống sẽ tự động nhận diện và điểm danh học sinh
6. Xem danh sách học sinh và trạng thái điểm danh

### Xem danh sách sinh viên

1. Truy cập trang "Danh sách sinh viên"
2. Chọn lớp học từ dropdown
3. Xem danh sách và thông tin sinh viên trong lớp học đó

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

### Cấu trúc thư mục

```
/
|-- server/         # Backend code
|-- src/            # Frontend code
|   |-- components/ # React components
|   |-- config/     # Configuration files
|   |-- models/     # Data models
|-- public/         # Static files
|   |-- models/     # face-api.js model files
```

### API Endpoints

- `GET /api/classes` - Lấy danh sách lớp học
- `POST /api/classes` - Tạo lớp học mới
- `DELETE /api/classes/:id` - Xóa lớp học
- `GET /api/students/class/:classId` - Lấy danh sách sinh viên theo lớp
- `POST /api/students` - Đăng ký sinh viên mới
- `POST /api/attendance` - Tạo bản ghi điểm danh
- `GET /api/attendance/:classId` - Lấy điểm danh trong ngày theo lớp
