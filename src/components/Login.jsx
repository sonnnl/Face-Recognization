import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import {
  UserIcon,
  AcademicCapIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("");
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("teacher"); // "teacher", "student"

  const navigate = useNavigate();
  const {
    login,
    loginWithGoogle,
    error: authError,
    currentUser,
    isAdmin,
  } = useAuth();

  // Kiểm tra xem đã đăng nhập chưa
  useEffect(() => {
    if (currentUser) {
      console.log("CurrentUser in useEffect:", currentUser);
      console.log("Is admin?", isAdmin());

      // Không cần setTimeout vì currentUser đã có giá trị
      if (isAdmin()) {
        console.log("Redirecting to /admin");
        navigate("/admin");
      } else {
        console.log("Redirecting to /classes");
        navigate("/classes");
      }
    }
  }, [currentUser, navigate, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    try {
      setLoading(true);

      // login giờ trả về Promise được resolve sau khi currentUser được cập nhật
      const success = await login(email, password);

      if (success) {
        toast.success("Đăng nhập thành công");
        console.log("Login success, checking role");

        // Không cần setTimeout vì login đã đảm bảo currentUser được cập nhật
        console.log("Current user after login:", currentUser);
        console.log("Is admin after login?", isAdmin());

        // useEffect sẽ xử lý việc điều hướng khi currentUser thay đổi
      } else {
        toast.error(authError || "Đăng nhập thất bại");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Lỗi kết nối server. Vui lòng thử lại sau");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (response) => {
    try {
      setError("");
      setPendingMessage("");
      setLoading(true);

      console.log("Google login response received", response);

      // Lấy token từ response của Google
      const googleToken = response.credential;

      // Thêm role vào khi đăng nhập bằng Google
      const loginResponse = await loginWithGoogle(googleToken, userRole);

      // Nếu là sinh viên mới => chuyển đến trang đăng ký thông tin
      if (userRole === "student" && loginResponse.isNewUser) {
        navigate("/student-register");
      } else {
        // Nếu là giáo viên hoặc sinh viên đã có => chuyển hướng về trang chủ
        navigate("/");
      }
    } catch (error) {
      console.error("Google login error:", error);

      // Log chi tiết hơn về lỗi 500
      if (error.response && error.response.status === 500) {
        console.error("Lỗi server 500:", error.response.data);
        console.error(
          "Chi tiết lỗi:",
          JSON.stringify(error.response.data, null, 2)
        );
      }

      if (error.pendingAccount) {
        // Hiển thị thông báo tài khoản đang chờ duyệt
        setPendingMessage(error.message);
      } else if (error.response && error.response.data) {
        // Kiểm tra xem có phải tài khoản đang chờ duyệt từ response không
        if (error.response.data.isPending) {
          setPendingMessage(error.response.data.message);
        } else {
          // Hiển thị lỗi thông thường
          setError(error.response.data.message || "Đăng nhập thất bại");
          toast.error(error.response.data.message || "Đăng nhập thất bại");
        }
      } else {
        // Lỗi khác
        setError("Đăng nhập với Google thất bại. Vui lòng thử lại sau.");
        toast.error("Đăng nhập với Google thất bại");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Đăng nhập với Google thất bại");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Đăng nhập
        </h2>

        {/* Lựa chọn vai trò */}
        <div className="mb-6">
          <p className="text-gray-700 text-sm font-bold mb-3">Tôi là:</p>
          <div className="flex space-x-2">
            <button
              onClick={() => setUserRole("teacher")}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg border-2 ${
                userRole === "teacher"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <AcademicCapIcon className="h-5 w-5 mr-2" />
              Giảng viên
            </button>
            <button
              onClick={() => setUserRole("student")}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg border-2 ${
                userRole === "student"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              Sinh viên
            </button>
          </div>
        </div>

        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {authError}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {pendingMessage && (
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
            role="alert"
          >
            <div className="flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-bold">Tài khoản chờ duyệt</p>
                <p>{pendingMessage}</p>
                <p className="mt-2 text-sm">
                  Vui lòng liên hệ quản trị viên để kích hoạt tài khoản của bạn.
                  Bạn có thể thử đăng nhập lại sau khi tài khoản được duyệt.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập email"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập mật khẩu"
              required
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-full"
            >
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>
          </div>
        </form>

        <div className="mt-4">
          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-600">
              Hoặc đăng nhập với
            </span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="flex justify-center mt-2">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={handleGoogleError}
              theme="filled_blue"
              shape="rectangular"
              size="large"
              type="standard"
              text="signin_with"
              width="100%"
            />
          </div>
        </div>

        {/* Thông tin thêm dựa trên vai trò */}
        <div className="mt-6 text-center text-sm text-gray-600">
          {userRole === "teacher" ? (
            <p>
              Tài khoản giảng viên sẽ được admin xác nhận trước khi sử dụng.
            </p>
          ) : (
            <p>
              Sinh viên mới sẽ được hướng dẫn đăng ký thông tin và dữ liệu khuôn
              mặt.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
