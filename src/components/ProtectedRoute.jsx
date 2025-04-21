import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Component bảo vệ các route yêu cầu xác thực
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { currentUser, loading, isAdmin, isActive } = useAuth();
  const location = useLocation();

  // Đang kiểm tra trạng thái đăng nhập
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-700">Đang tải...</span>
      </div>
    );
  }

  // Nếu chưa đăng nhập, chuyển hướng đến trang đăng nhập
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Nếu tài khoản không hoạt động
  if (!isActive()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md text-center">
          <h2 className="font-bold text-lg mb-2">Tài khoản bị khóa</h2>
          <p>
            Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ quản trị
            viên để được hỗ trợ.
          </p>
        </div>
      </div>
    );
  }

  // Nếu route yêu cầu quyền admin nhưng người dùng không phải admin
  // Ngoại lệ: Cho phép giảng viên truy cập trang admin-classes
  const isAdminClassesPath =
    location.pathname === "/admin/admin-classes" ||
    location.pathname.startsWith("/admin/admin-classes/") ||
    location.pathname === "/teacher/admin-classes" ||
    location.pathname.startsWith("/teacher/admin-classes/");

  if (adminOnly && !isAdmin() && !isAdminClassesPath) {
    return <Navigate to="/classes" replace />;
  }

  // Đã đăng nhập và có đủ quyền
  return children;
};

export default ProtectedRoute;
