import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import axios from "../../config/axios";

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    teachers: 0,
    classes: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Lấy số lượng giáo viên
        const teachersResponse = await axios.get("/api/admin/teachers");

        // Lấy số lượng lớp học
        const classesResponse = await axios.get("/api/classes");

        // Tổng số sinh viên có thể lấy từ phía server, nhưng hiện tại chưa có API, có thể xây dựng sau

        setStats({
          teachers: teachersResponse.data.length,
          classes: classesResponse.data.length,
          students: 0, // Placeholder
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-blue-800">
        Trang quản trị Admin
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Dashboard cards */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-700">Giảng viên</h3>
          <p className="text-3xl font-bold mt-2">
            {loading ? "..." : stats.teachers}
          </p>
          <Link
            to="/admin/teachers"
            className="text-blue-500 mt-4 inline-block hover:underline"
          >
            Quản lý giảng viên →
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-700">Lớp học</h3>
          <p className="text-3xl font-bold mt-2">
            {loading ? "..." : stats.classes}
          </p>
          <Link
            to="/admin/classes"
            className="text-green-500 mt-4 inline-block hover:underline"
          >
            Quản lý lớp học →
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <h3 className="text-lg font-semibold text-gray-700">Sinh viên</h3>
          <p className="text-3xl font-bold mt-2">{loading ? "..." : "—"}</p>
          <span className="text-gray-500 mt-4 inline-block">
            Quản lý qua lớp học
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-blue-800">
            Quản lý giảng viên
          </h2>
          <p className="text-gray-600 mb-4">
            Quản lý tài khoản giảng viên, phân quyền, và phân công lớp học.
          </p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Thêm, sửa, xóa tài khoản giảng viên
            </li>
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Phân quyền admin/giảng viên
            </li>
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Vô hiệu hóa tài khoản
            </li>
          </ul>
          <Link
            to="/admin/teachers"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block transition duration-200"
          >
            Đi đến quản lý giảng viên
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-blue-800">
            Quản lý lớp học
          </h2>
          <p className="text-gray-600 mb-4">
            Quản lý thông tin lớp học, phân công giảng viên và theo dõi thống
            kê.
          </p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Chỉnh sửa thông tin lớp học
            </li>
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Phân công giảng viên phụ trách
            </li>
            <li className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Xem thống kê điểm danh
            </li>
          </ul>
          <Link
            to="/admin/classes"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block transition duration-200"
          >
            Đi đến quản lý lớp học
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
