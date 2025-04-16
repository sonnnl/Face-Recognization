import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../config/axios";
import { toast } from "react-toastify";

const RegisterFirstAdmin = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const navigate = useNavigate();

  // Kiểm tra xem đã có admin nào hay chưa
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await axios.post("/api/auth/check-admin-exists");

        if (response.data.exists) {
          toast.info("Admin đã tồn tại. Vui lòng đăng nhập");
          navigate("/login");
        }
      } catch (error) {
        console.error("Error checking admin:", error);
        // Nếu lỗi là 404, có thể API chưa tồn tại hoặc chưa có admin
        // Cho phép tạo admin đầu tiên
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdmin();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axios.post("/api/auth/register-first-admin", {
        name,
        email,
        password,
      });

      toast.success("Tạo tài khoản admin thành công");

      // Chuyển đến trang đăng nhập
      navigate("/login");
    } catch (error) {
      console.error("Registration error:", error);

      if (error.response) {
        setError(error.response.data.message || "Đăng ký thất bại");
      } else {
        setError("Lỗi kết nối server. Vui lòng thử lại sau");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Tạo tài khoản Admin đầu tiên
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Họ tên
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập họ tên"
              required
            />
          </div>

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

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Xác nhận mật khẩu
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-full"
            >
              {loading ? "Đang xử lý..." : "Tạo tài khoản Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterFirstAdmin;
