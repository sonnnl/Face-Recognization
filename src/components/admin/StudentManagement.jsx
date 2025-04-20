import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";
import {
  FaUserEdit,
  FaUserSlash,
  FaUserCheck,
  FaSync,
  FaCamera,
  FaUser,
} from "react-icons/fa";

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [adminClasses, setAdminClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active"); // 'active', 'pending'
  const [selectedClass, setSelectedClass] = useState("all");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);

  // Lấy danh sách sinh viên và lớp
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsResponse, adminClassesResponse] = await Promise.all([
        axios.get("/api/admin/students"),
        axios.get("/api/admin-classes"),
      ]);
      setStudents(studentsResponse.data);
      setAdminClasses(adminClassesResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Không thể tải danh sách sinh viên");
    } finally {
      setLoading(false);
    }
  };

  // Lọc sinh viên theo trạng thái và lớp
  const filteredStudents = students.filter((student) => {
    const matchesStatus =
      (activeTab === "active" && student.account?.status === "active") ||
      (activeTab === "pending" && student.account?.status === "pending");

    const matchesClass =
      selectedClass === "all" || student.adminClass === selectedClass;

    return matchesStatus && matchesClass;
  });

  // Phê duyệt tài khoản sinh viên
  const handleApproveStudent = async (accountId) => {
    try {
      await axios.put(`/api/admin/students/${accountId}/approve`);
      toast.success("Đã phê duyệt sinh viên thành công");

      // Cập nhật state
      setStudents(
        students.map((student) =>
          student.account?._id === accountId
            ? { ...student, account: { ...student.account, status: "active" } }
            : student
        )
      );
    } catch (error) {
      console.error("Error approving student:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi phê duyệt sinh viên"
      );
    }
  };

  // Từ chối tài khoản sinh viên
  const handleRejectStudent = async (accountId) => {
    try {
      await axios.put(`/api/admin/students/${accountId}/reject`);
      toast.success("Đã từ chối sinh viên thành công");

      // Cập nhật state
      setStudents(
        students.filter((student) => student.account?._id !== accountId)
      );
    } catch (error) {
      console.error("Error rejecting student:", error);
      toast.error(error.response?.data?.message || "Lỗi khi từ chối sinh viên");
    }
  };

  // Xem thông tin sinh viên
  const openStudentModal = (student) => {
    setCurrentStudent(student);
    setShowStudentModal(true);
  };

  // Render dữ liệu khuôn mặt
  const renderFaceData = (student) => {
    if (!student.faceImage) {
      return (
        <div className="text-gray-500">
          <FaUser className="inline mr-1" /> Chưa có dữ liệu khuôn mặt
        </div>
      );
    }

    return (
      <div className="flex items-center">
        <FaCamera className="text-green-500 mr-1" />
        <span className="text-green-500">Đã có dữ liệu khuôn mặt</span>
      </div>
    );
  };

  // Tìm tên lớp từ ID
  const getClassName = (classId) => {
    const found = adminClasses.find((c) => c._id === classId);
    return found ? found.name : "Không xác định";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Quản lý sinh viên
          </h1>
          <p className="text-gray-600">
            Quản lý tài khoản và thông tin sinh viên
          </p>
        </div>
        <div>
          <Link
            to="/admin"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            ← Quay lại Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lọc theo trạng thái
            </label>
            <div className="flex space-x-2">
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === "active"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setActiveTab("active")}
              >
                Đã duyệt
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === "pending"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setActiveTab("pending")}
              >
                Chờ duyệt
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lọc theo lớp
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả lớp</option>
              {adminClasses.map((adminClass) => (
                <option key={adminClass._id} value={adminClass._id}>
                  {adminClass.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Đang tải...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên sinh viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mã sinh viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lớp quản lý
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dữ liệu khuôn mặt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    {activeTab === "active"
                      ? "Không có sinh viên đã duyệt"
                      : "Không có sinh viên đang chờ duyệt"}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {student.faceImage ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={student.faceImage}
                              alt={student.name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                              <FaUser />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {student.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.studentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getClassName(student.adminClass)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.account?.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {renderFaceData(student)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.account?.status === "active" ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Đã duyệt
                        </span>
                      ) : student.account?.status === "pending" ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Chờ duyệt
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {student.account?.status || "Không xác định"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openStudentModal(student)}
                        className="text-indigo-600 hover:text-indigo-900 mr-2"
                      >
                        <FaUserEdit className="inline" /> Xem
                      </button>

                      {student.account?.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              handleApproveStudent(student.account?._id)
                            }
                            className="text-green-600 hover:text-green-900 mr-2"
                          >
                            <FaUserCheck className="inline" /> Duyệt
                          </button>
                          <button
                            onClick={() =>
                              handleRejectStudent(student.account?._id)
                            }
                            className="text-red-600 hover:text-red-900"
                          >
                            <FaUserSlash className="inline" /> Từ chối
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal xem thông tin sinh viên */}
      {showStudentModal && currentStudent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold mb-4">
                Thông tin sinh viên: {currentStudent.name}
              </h2>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 flex flex-col items-center">
                {currentStudent.faceImage ? (
                  <img
                    src={currentStudent.faceImage}
                    alt={currentStudent.name}
                    className="w-full rounded-lg object-cover mb-2"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 mb-2">
                    <FaUser size={48} />
                  </div>
                )}
                <p className="text-sm text-center text-gray-500">
                  {currentStudent.faceImage
                    ? "Dữ liệu khuôn mặt đã được lưu"
                    : "Chưa có dữ liệu khuôn mặt"}
                </p>
              </div>

              <div className="w-full md:w-2/3">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-gray-500 text-sm">
                      Họ và tên:
                    </label>
                    <p className="font-medium">{currentStudent.name}</p>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-sm">
                      Mã sinh viên:
                    </label>
                    <p className="font-medium">{currentStudent.studentId}</p>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-sm">
                      Email:
                    </label>
                    <p className="font-medium">
                      {currentStudent.account?.email}
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-sm">
                      Lớp quản lý:
                    </label>
                    <p className="font-medium">
                      {getClassName(currentStudent.adminClass)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-sm">
                      Số điện thoại:
                    </label>
                    <p className="font-medium">
                      {currentStudent.phone || "Chưa cung cấp"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-sm">
                      Trạng thái:
                    </label>
                    <p className="font-medium">
                      {currentStudent.account?.status === "active"
                        ? "Đã duyệt"
                        : currentStudent.account?.status === "pending"
                        ? "Chờ duyệt"
                        : currentStudent.account?.status || "Không xác định"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Đóng
              </button>

              {currentStudent.account?.status === "pending" && (
                <>
                  <button
                    onClick={() => {
                      handleApproveStudent(currentStudent.account?._id);
                      setShowStudentModal(false);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Phê duyệt
                  </button>
                  <button
                    onClick={() => {
                      handleRejectStudent(currentStudent.account?._id);
                      setShowStudentModal(false);
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Từ chối
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
