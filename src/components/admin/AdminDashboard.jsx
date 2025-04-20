import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import axios from "../../config/axios";
import {
  FaUsers,
  FaChalkboardTeacher,
  FaBuilding,
  FaUserGraduate,
  FaClipboardList,
  FaUserFriends,
} from "react-icons/fa";

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    teachers: 0,
    classes: 0,
    students: 0,
    departments: 0,
    adminClasses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [
          teachersResponse,
          classesResponse,
          studentsResponse,
          departmentsResponse,
          adminClassesResponse,
        ] = await Promise.all([
          axios.get("/api/admin/teachers"),
          axios.get("/api/classes"),
          axios.get("/api/admin/students"),
          axios.get("/api/departments"),
          axios.get("/api/admin-classes"),
        ]);

        setStats({
          teachers: teachersResponse.data.length,
          classes: classesResponse.data.length,
          students: studentsResponse.data.length,
          departments: departmentsResponse.data.length,
          adminClasses: adminClassesResponse.data.length,
        });
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-800">
          Quản trị hệ thống điểm danh
        </h1>
        <p className="text-gray-600 mt-2">
          Xin chào, {currentUser?.name || "Admin"}! Đây là trang quản trị hệ
          thống.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="rounded-full bg-blue-100 p-3 mr-4">
                <FaChalkboardTeacher className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Giảng viên</p>
                <p className="text-2xl font-bold">{stats.teachers}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="rounded-full bg-green-100 p-3 mr-4">
                <FaClipboardList className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Lớp học</p>
                <p className="text-2xl font-bold">{stats.classes}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="rounded-full bg-yellow-100 p-3 mr-4">
                <FaUserGraduate className="text-yellow-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sinh viên</p>
                <p className="text-2xl font-bold">{stats.students}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="rounded-full bg-purple-100 p-3 mr-4">
                <FaBuilding className="text-purple-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Khoa</p>
                <p className="text-2xl font-bold">{stats.departments}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className="rounded-full bg-indigo-100 p-3 mr-4">
                <FaUserFriends className="text-indigo-600 text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Lớp chính</p>
                <p className="text-2xl font-bold">{stats.adminClasses}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center">
                <FaUsers className="mr-2" /> Quản lý giảng viên
              </h2>
              <p className="text-gray-600 mb-4">
                Quản lý tài khoản và thông tin giảng viên trong hệ thống.
              </p>
              <Link
                to="/admin/teachers"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block"
              >
                Quản lý giảng viên
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center">
                <FaUserGraduate className="mr-2" /> Quản lý sinh viên
              </h2>
              <p className="text-gray-600 mb-4">
                Quản lý tài khoản và thông tin sinh viên trong hệ thống.
              </p>
              <Link
                to="/admin/students"
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 inline-block"
              >
                Quản lý sinh viên
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center">
                <FaClipboardList className="mr-2" /> Quản lý lớp học
              </h2>
              <p className="text-gray-600 mb-4">
                Quản lý thông tin lớp học và phân công giảng viên.
              </p>
              <Link
                to="/admin/classes"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block"
              >
                Quản lý lớp học
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center">
                <FaBuilding className="mr-2" /> Quản lý khoa
              </h2>
              <p className="text-gray-600 mb-4">
                Quản lý thông tin về các khoa trong trường.
              </p>
              <Link
                to="/admin/departments"
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 inline-block"
              >
                Quản lý khoa
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center">
                <FaUserFriends className="mr-2" /> Quản lý lớp chính
              </h2>
              <p className="text-gray-600 mb-4">
                Quản lý thông tin lớp chính/lớp quản lý sinh viên.
              </p>
              <Link
                to="/admin/admin-classes"
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 inline-block"
              >
                Quản lý lớp chính
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
