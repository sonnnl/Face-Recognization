import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  UserGroupIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  ArrowLeftOnRectangleIcon,
  UserIcon,
  AcademicCapIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";

function Navbar() {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Đăng xuất thành công");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Có lỗi xảy ra khi đăng xuất");
    }
  };

  // Menu cho admin
  const adminMenu = () => (
    <div className="flex items-center space-x-4">
      <Link
        to="/admin"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <HomeIcon className="h-5 w-5 mr-2" />
        Dashboard
      </Link>
      <Link
        to="/admin/teachers"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <UserIcon className="h-5 w-5 mr-2" />
        Quản lý giảng viên
      </Link>
      <Link
        to="/admin/classes"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <AcademicCapIcon className="h-5 w-5 mr-2" />
        Quản lý lớp học
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
        Đăng xuất
      </button>
      <div className="flex items-center px-3 py-2 bg-purple-100 text-purple-800 rounded">
        <Cog6ToothIcon className="h-5 w-5 mr-2" />
        <span className="font-semibold">Admin</span>
      </div>
    </div>
  );

  // Menu cho giảng viên
  const teacherMenu = () => (
    <div className="flex items-center space-x-4">
      <Link
        to="/classes"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <HomeIcon className="h-5 w-5 mr-2" />
        Lớp học
      </Link>
      <Link
        to="/attendance"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <UserGroupIcon className="h-5 w-5 mr-2" />
        Điểm danh
      </Link>
      <Link
        to="/register"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <UserPlusIcon className="h-5 w-5 mr-2" />
        Đăng ký sinh viên
      </Link>
      <Link
        to="/history"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
        Lịch sử điểm danh
      </Link>
      <Link
        to="/students"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <UserGroupIcon className="h-5 w-5 mr-2" />
        Danh sách sinh viên
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
        Đăng xuất
      </button>
      <span className="text-blue-600 font-semibold px-3 py-2">
        {currentUser.name || currentUser.email}
      </span>
    </div>
  );

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              to={currentUser ? (isAdmin() ? "/admin" : "/") : "/"}
              className="text-xl font-bold text-gray-800"
            >
              Face Attendance
            </Link>
          </div>

          {currentUser ? (
            isAdmin() ? (
              adminMenu()
            ) : (
              teacherMenu()
            )
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Đăng nhập
              </Link>
              <Link
                to="/admin-register"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Đăng ký Admin
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
