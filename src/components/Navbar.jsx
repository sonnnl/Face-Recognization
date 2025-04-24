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
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import { SiGoogleclassroom } from "react-icons/si";
import { CameraIcon, ClockIcon } from "@heroicons/react/24/outline";

function Navbar() {
  const { currentUser, logout, isAdmin, isTeacher } = useAuth();
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

  // Teacher Menu
  const teacherMenu = [
    {
      text: "Lớp học",
      path: "/classes",
      icon: <SiGoogleclassroom className="w-5 h-5" />,
      tooltip: "Quản lý lớp học",
    },
    {
      text: "Điểm danh",
      path: "/attendance",
      icon: <CameraIcon className="w-5 h-5" />,
      tooltip: "Điểm danh sinh viên",
    },
    {
      text: "Lớp quản lý",
      path: "/mainclasses",
      icon: <UserGroupIcon className="w-5 h-5" />,
      tooltip: "Quản lý lớp hành chính",
    },
    {
      text: "Sinh viên",
      path: "/students",
      icon: <AcademicCapIcon className="w-5 h-5" />,
      tooltip: "Danh sách sinh viên",
    },
    {
      text: "Lịch sử điểm danh",
      path: "/history",
      icon: <ClockIcon className="w-5 h-5" />,
      tooltip: "Lịch sử điểm danh",
    },
  ];

  // Menu cho admin
  const adminMenu = () => (
    <div className="flex items-center space-x-4">
      <Link
        to="/admin"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <HomeIcon className="h-5 w-5 mr-2" />
        Trang chủ
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
      <Link
        to="/admin/campuses"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <BuildingOfficeIcon className="h-5 w-5 mr-2" />
        Quản lý cơ sở
      </Link>
      <Link
        to="/admin/rooms"
        className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
      >
        <BuildingStorefrontIcon className="h-5 w-5 mr-2" />
        Quản lý phòng
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
  const teacherMenuComponent = () => (
    <div className="flex items-center space-x-4">
      {teacherMenu.map((item, index) => (
        <Link
          key={index}
          to={item.path}
          className={`flex items-center px-4 py-2 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 ${
            window.location.pathname === item.path
              ? "bg-blue-50 text-blue-600"
              : ""
          }`}
        >
          <span className="text-lg mr-3">{item.icon}</span>
          <span className="text-sm font-medium">{item.text}</span>
        </Link>
      ))}
      <div className="flex items-center px-3 py-2 bg-blue-100 text-blue-800 rounded ml-2">
        <UserIcon className="h-5 w-5 mr-2" />
        <span className="font-semibold">
          {currentUser?.name || "Giảng viên"}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center px-4 py-2 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600"
      >
        <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
        <span className="text-sm font-medium">Đăng xuất</span>
      </button>
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
              teacherMenuComponent()
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
