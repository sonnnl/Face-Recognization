import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { ClockIcon } from "@heroicons/react/24/outline";

const PendingAccountPage = () => {
  const { currentUser } = useAuth();

  // Xác định role của người dùng
  const isTeacher = currentUser?.role === "teacher";
  const isStudent = currentUser?.role === "student";

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      {/* Simple header to replace navbar */}
      <div className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
          <h1 className="text-xl font-semibold text-blue-600">
            Hệ thống điểm danh khuôn mặt
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-500 px-6 py-4">
            <h1 className="text-xl font-bold text-white">
              Tài khoản đang chờ xác nhận
            </h1>
          </div>

          <div className="p-8 text-center">
            <ClockIcon className="h-20 w-20 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              Tài khoản của bạn đang chờ xác nhận
            </h2>

            {isTeacher && (
              <p className="text-gray-600 mb-6">
                Vui lòng đợi quản trị viên xác nhận thông tin của bạn trước khi
                tiếp tục. Quá trình này có thể mất vài giờ đến vài ngày làm
                việc.
              </p>
            )}

            {isStudent && (
              <p className="text-gray-600 mb-6">
                Vui lòng đợi giảng viên xác nhận thông tin của bạn trước khi
                tiếp tục.
              </p>
            )}

            {!isTeacher && !isStudent && (
              <p className="text-gray-600 mb-6">
                Vui lòng đợi quản trị viên xác nhận thông tin của bạn trước khi
                tiếp tục.
              </p>
            )}

            {currentUser && (
              <div className="bg-gray-100 p-4 rounded-lg inline-block text-left">
                <p className="text-gray-600">
                  <span className="font-medium">Họ và tên:</span>{" "}
                  {currentUser.name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Email:</span>{" "}
                  {currentUser.email}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Vai trò:</span>{" "}
                  {isTeacher
                    ? "Giảng viên"
                    : isStudent
                    ? "Sinh viên"
                    : "Người dùng"}
                </p>
              </div>
            )}

            <div className="mt-8">
              <p className="text-sm text-gray-500">
                Nếu tài khoản của bạn không được xác nhận trong thời gian dài,
                vui lòng liên hệ với quản trị viên hệ thống.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingAccountPage;
