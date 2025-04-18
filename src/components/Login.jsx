import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("");
  const [error, setError] = useState("");

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

      await loginWithGoogle(googleToken);

      // Nếu thành công, chuyển hướng về trang chủ
      navigate("/");
    } catch (error) {
      console.error("Google login error:", error);

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

        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {authError}
          </div>
        )}

        {pendingMessage && (
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
            role="alert"
          >
            <p>{pendingMessage}</p>
            <p className="font-medium mt-2">
              Vui lòng liên hệ quản trị viên để kích hoạt tài khoản.
            </p>
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
      </div>
    </div>
  );
};

export default Login;
