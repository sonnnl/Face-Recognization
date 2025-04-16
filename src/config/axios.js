import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Thêm token vào header nếu tồn tại trong localStorage
const token = localStorage.getItem("token");
if (token) {
  instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// Interceptor để xử lý lỗi
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Xử lý các lỗi xác thực (401)
    if (error.response && error.response.status === 401) {
      // Chỉ xóa token và redirect nếu đã có token (đã đăng nhập trước đó)
      // và không phải đang ở trang đăng nhập
      const token = localStorage.getItem("token");
      const isLoginPage = window.location.pathname === "/login";

      if (token && !isLoginPage) {
        // Xóa token nếu hết hạn hoặc không hợp lệ
        localStorage.removeItem("token");
        localStorage.removeItem("teacher");
        delete instance.defaults.headers.common["Authorization"];

        // Chuyển hướng đến trang đăng nhập
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
