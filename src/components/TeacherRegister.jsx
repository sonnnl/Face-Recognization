import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../config/axios";
import { useAuth } from "../contexts/AuthContext";
import {
  UserIcon,
  PhoneIcon,
  XCircleIcon,
  AcademicCapIcon,
  MapPinIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";

const TeacherRegister = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [step, setStep] = useState(1); // 1: Form điền thông tin, 2: Hoàn tất
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    departmentId: "",
    phone: "",
    address: "",
    title: "Giảng viên", // Chức danh: Giảng viên, Giáo sư, Tiến sĩ...
    bio: "", // Mô tả ngắn về giảng viên
  });

  // Lấy danh sách khoa
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get("/api/departments");
        setDepartments(response.data);
      } catch (error) {
        console.error("Error fetching departments:", error);
        toast.error("Không thể tải danh sách khoa");
      }
    };

    fetchDepartments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCancel = async () => {
    if (
      window.confirm(
        "Bạn có chắc muốn hủy quá trình đăng ký? Mọi dữ liệu sẽ bị xóa."
      )
    ) {
      console.log("Bắt đầu quá trình hủy đăng ký giảng viên");

      // Sử dụng logout() thay vì xóa thủ công
      toast.success("Đã hủy đăng ký thành công");
      logout();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (
      !formData.name ||
      !formData.departmentId ||
      !formData.phone ||
      !formData.address
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);

    try {
      // Gửi thông tin giảng viên lên server
      const response = await axios.post("/api/teachers/register", formData);

      toast.success("Đăng ký thông tin giảng viên thành công");

      // Chuyển sang bước hoàn tất
      setStep(2);

      // Cập nhật thông tin người dùng trong localStorage
      localStorage.setItem("account", JSON.stringify(response.data));

      // Bỏ đoạn code tự động chuyển hướng đến trang pending
      // setTimeout(() => {
      //   navigate("/pending-account");
      // }, 5000);
    } catch (error) {
      console.error("Error registering teacher:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi đăng ký thông tin giảng viên"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Bạn cần đăng nhập trước</h2>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      {/* Simple header to replace navbar */}
      <div className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-blue-600">
            Hệ thống điểm danh khuôn mặt
          </h1>
          {step === 1 && (
            <button
              onClick={handleCancel}
              className="text-red-500 hover:text-red-700 font-medium flex items-center"
            >
              <XCircleIcon className="h-5 w-5 mr-1" />
              Hủy đăng ký
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-blue-500 px-6 py-4">
            <h1 className="text-xl font-bold text-white">
              Đăng ký thông tin giảng viên
            </h1>
            <p className="text-blue-100">
              Vui lòng cung cấp thông tin chi tiết để hoàn tất đăng ký
            </p>
          </div>

          <div className="p-6">
            {step === 1 ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    <UserIcon className="inline-block w-4 h-4 mr-1" />
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập họ và tên"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    <AcademicCapIcon className="inline-block w-4 h-4 mr-1" />
                    Khoa
                  </label>
                  <select
                    name="departmentId"
                    value={formData.departmentId}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                  >
                    <option value="">Chọn khoa</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    <InformationCircleIcon className="inline-block w-4 h-4 mr-1" />
                    Chức danh
                  </label>
                  <select
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  >
                    <option value="Giảng viên">Giảng viên</option>
                    <option value="Giáo sư">Giáo sư</option>
                    <option value="Phó Giáo sư">Phó Giáo sư</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    <PhoneIcon className="inline-block w-4 h-4 mr-1" />
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập số điện thoại"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    <MapPinIcon className="inline-block w-4 h-4 mr-1" />
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập địa chỉ"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Giới thiệu ngắn
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Giới thiệu ngắn về bản thân"
                    rows="3"
                  />
                </div>

                <div className="mt-6 flex space-x-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 w-1/2"
                  >
                    Hủy đăng ký
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-1/2 disabled:opacity-50"
                  >
                    {loading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8">
                <div className="mb-6 text-green-500">
                  <CheckCircleIcon className="h-20 w-20 mx-auto" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Đăng ký thành công!</h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-left">
                  <p className="text-yellow-700 font-medium">
                    Tài khoản của bạn đang chờ phê duyệt
                  </p>
                  <p className="text-gray-600 mt-2">
                    Cảm ơn bạn đã đăng ký. Tài khoản của bạn đã được tạo và đang
                    chờ phê duyệt từ quản trị viên. Bạn sẽ nhận được thông báo
                    qua email khi tài khoản được kích hoạt.
                  </p>
                </div>
                <p className="text-gray-600 mb-6">
                  Vui lòng đợi quản trị viên phê duyệt trước khi đăng nhập lại.
                </p>
                <button
                  onClick={() => {
                    // Sử dụng hàm logout từ AuthContext
                    logout();
                  }}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Về trang đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherRegister;
