import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [currentClass, setCurrentClass] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    totalSessions: "",
  });
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Fetch classes and teachers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [classesResponse, teachersResponse] = await Promise.all([
          axios.get("/api/classes"),
          axios.get("/api/admin/teachers"),
        ]);
        setClasses(classesResponse.data);
        setTeachers(teachersResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Open edit class modal
  const openEditModal = (classItem) => {
    setCurrentClass(classItem);
    setFormData({
      name: classItem.name,
      description: classItem.description || "",
      startDate: new Date(classItem.startDate).toISOString().split("T")[0],
      totalSessions: classItem.totalSessions,
    });
    setShowEditModal(true);
  };

  // Open change teacher modal
  const openTeacherModal = (classItem) => {
    setCurrentClass(classItem);
    setSelectedTeacher(classItem.teacher);
    setShowTeacherModal(true);
  };

  // Update class
  const handleUpdateClass = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.startDate || !formData.totalSessions) {
        toast.error("Vui lòng điền đầy đủ thông tin");
        return;
      }

      const response = await axios.put(
        `/api/admin/classes/${currentClass._id}`,
        formData
      );
      toast.success("Cập nhật lớp học thành công");

      // Update the classes list
      setClasses((prevClasses) =>
        prevClasses.map((c) =>
          c._id === currentClass._id ? response.data.class : c
        )
      );

      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating class:", error);
      toast.error(error.response?.data?.message || "Lỗi khi cập nhật lớp học");
    }
  };

  // Change teacher
  const handleChangeTeacher = async (e) => {
    e.preventDefault();
    try {
      if (!selectedTeacher) {
        toast.error("Vui lòng chọn giảng viên");
        return;
      }

      const response = await axios.put(
        `/api/admin/classes/${currentClass._id}/teacher`,
        { teacherId: selectedTeacher }
      );

      toast.success("Thay đổi giảng viên thành công");

      // Update the classes list
      setClasses((prevClasses) =>
        prevClasses.map((c) =>
          c._id === currentClass._id ? response.data.class : c
        )
      );

      setShowTeacherModal(false);
    } catch (error) {
      console.error("Error changing teacher:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi thay đổi giảng viên"
      );
    }
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher ? teacher.name : "Không xác định";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Quản lý lớp học</h1>
          <p className="text-gray-600">
            Quản lý thông tin lớp học và phân công giảng viên
          </p>
        </div>
        <Link
          to="/admin"
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
        >
          ← Quay lại Dashboard
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Đang tải...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên lớp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giảng viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày bắt đầu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số buổi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số SV
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Không có lớp học nào
                  </td>
                </tr>
              ) : (
                classes.map((classItem) => (
                  <tr key={classItem._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {classItem.name}
                      </div>
                      {classItem.description && (
                        <div className="text-xs text-gray-500">
                          {classItem.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {getTeacherName(classItem.teacher)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(classItem.startDate).toLocaleDateString(
                        "vi-VN"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {classItem.totalSessions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {classItem.studentCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(classItem)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => openTeacherModal(classItem)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Đổi GV
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal chỉnh sửa lớp học */}
      {showEditModal && currentClass && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Chỉnh sửa lớp học: {currentClass.name}
            </h2>
            <form onSubmit={handleUpdateClass}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Tên lớp
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Mô tả (tùy chọn)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                ></textarea>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Số buổi học
                </label>
                <input
                  type="number"
                  name="totalSessions"
                  value={formData.totalSessions}
                  onChange={handleChange}
                  min="1"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal thay đổi giảng viên */}
      {showTeacherModal && currentClass && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Thay đổi giảng viên: {currentClass.name}
            </h2>
            <form onSubmit={handleChangeTeacher}>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Giảng viên phụ trách
                </label>
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Chọn giảng viên --</option>
                  {teachers.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name} ({teacher.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
