import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../config/axios";

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra mật khẩu nhập lại
    if (formData.password !== formData.confirmPassword) {
      toast.error("Mật khẩu nhập lại không khớp");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Thử đăng ký với API register-first-admin trước (nếu chưa có admin nào)
      try {
        const response = await axios.post("/api/auth/register-first-admin", {
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
        });

        toast.success("Tạo tài khoản admin đầu tiên thành công");
        navigate("/login");
        return;
      } catch (firstAdminError) {
        // Nếu đã có admin, API này sẽ trả về lỗi
        console.log("Admin đã tồn tại, thử đăng ký với API register");

        // Thử với API register thông thường (yêu cầu đăng nhập với quyền admin)
        try {
          const registerResponse = await axios.post("/api/auth/register", {
            name: formData.fullName,
            email: formData.email,
            password: formData.password,
            role: "admin",
          });

          toast.success("Đăng ký admin thành công");
          navigate("/login");
        } catch (registerError) {
          // Nếu cả hai cách đều không thành công, hiển thị lỗi từ API thứ hai
          if (registerError.response) {
            setError(registerError.response.data.message || "Đăng ký thất bại");
            toast.error(
              registerError.response.data.message || "Đăng ký thất bại"
            );
          } else {
            setError("Lỗi kết nối server");
            toast.error("Lỗi kết nối server");
          }
        }
      }
    } catch (error) {
      console.error("Register error:", error);

      if (error.response) {
        setError(error.response.data.message || "Đăng ký thất bại");
        toast.error(error.response.data.message || "Đăng ký thất bại");
      } else {
        setError("Lỗi kết nối server. Vui lòng thử lại sau");
        toast.error("Lỗi kết nối server. Vui lòng thử lại sau");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Đăng ký Admin
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Họ và tên
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập họ và tên"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập mật khẩu"
              required
              minLength={6}
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nhập lại mật khẩu
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập lại mật khẩu"
              required
              minLength={6}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-full"
            >
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminRegister;
