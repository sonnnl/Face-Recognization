import React, { useState, useEffect } from "react";
import axios from "../../config/axios";
import { toast } from "react-toastify";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaSync,
  FaUsers,
  FaChalkboardTeacher,
} from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AdminClassManagement = ({ isTeacherView = false }) => {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();
  const isTeacherViewMode =
    isTeacherView || (!isAdmin() && location.pathname === "/mainclasses");

  const [adminClasses, setAdminClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [currentClass, setCurrentClass] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    department: "",
    mainTeacher: "",
    entryYear: new Date().getFullYear(),
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch admin classes, departments, and teachers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch all data in parallel
        const [adminClassesResponse, departmentsResponse, teachersResponse] =
          await Promise.all([
            axios.get("/api/admin-classes"),
            axios.get("/api/departments"),
            axios.get("/api/admin/teachers"),
          ]);

        // Lọc chỉ lấy tài khoản giảng viên (không phải admin)
        const teacherAccounts = teachersResponse.data.filter(
          (account) => account.role === "teacher"
        );
        setTeachers(teacherAccounts);
        setDepartments(departmentsResponse.data);

        // Xử lý dữ liệu lớp học để đảm bảo thông tin giảng viên đầy đủ
        let processedClasses = adminClassesResponse.data;

        // Get all pending students for all classes in a single request
        let pendingCountsByClass = {};
        try {
          // Thử gọi endpoint mới trước
          let pendingResponse;
          let pendingData;

          try {
            pendingResponse = await axios.get(
              "/api/admin-classes/all-student-approvals"
            );
            pendingData = pendingResponse.data;
          } catch (approvalError) {
            console.error(
              "Error using new student-approvals endpoint:",
              approvalError
            );
            console.log("Falling back to legacy endpoint");
            // Nếu lỗi, sử dụng endpoint cũ
            pendingResponse = await axios.get(
              "/api/admin-classes/all-pending-students"
            );
            pendingData = pendingResponse.data;
          }

          // Create a map of class ID to pending count
          pendingData.forEach((item) => {
            if (!pendingCountsByClass[item.adminClass]) {
              pendingCountsByClass[item.adminClass] = 0;
            }
            pendingCountsByClass[item.adminClass]++;
          });
        } catch (error) {
          console.error("Error fetching all pending students:", error);
          // If this optimized approach fails, fall back to individual requests
          pendingCountsByClass = await fetchPendingCountsIndividually(
            processedClasses
          );
        }

        // Add pending counts and process teacher info
        const finalClasses = processedClasses.map((adminClass) => {
          // Add pending count
          const pendingCount = pendingCountsByClass[adminClass._id] || 0;

          // Process teacher info
          let updatedClass = {
            ...adminClass,
            pendingCount,
          };

          // Nếu có mainTeacher nhưng chỉ là ID, thêm thông tin đầy đủ từ danh sách giảng viên
          if (
            updatedClass.mainTeacher &&
            typeof updatedClass.mainTeacher === "string"
          ) {
            const fullTeacherInfo = teacherAccounts.find(
              (t) => t._id === updatedClass.mainTeacher
            );
            if (fullTeacherInfo) {
              updatedClass.mainTeacher = {
                _id: fullTeacherInfo._id,
                name: fullTeacherInfo.name,
                email: fullTeacherInfo.email,
              };
            }
          }

          return updatedClass;
        });

        setAdminClasses(finalClasses);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    // Helper function to fetch pending counts individually if batch approach fails
    const fetchPendingCountsIndividually = async (classes) => {
      const pendingCounts = {};

      // Use Promise.all for parallel requests but handle individual failures
      const pendingPromises = classes.map(async (adminClass) => {
        try {
          const response = await axios.get(
            `/api/admin-classes/${adminClass._id}/student-approvals`
          );
          pendingCounts[adminClass._id] = response.data.length;
        } catch (error) {
          console.error(
            `Error fetching pending students for class ${adminClass._id}:`,
            error
          );
          pendingCounts[adminClass._id] = 0;
        }
      });

      await Promise.all(pendingPromises);
      return pendingCounts;
    };

    fetchData();
  }, []);

  // Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Open create modal
  const openCreateModal = () => {
    // Nếu là giảng viên, tự động gán mainTeacher là ID của giảng viên hiện tại
    const initialMainTeacher = isTeacherViewMode ? currentUser._id : "";

    setFormData({
      name: "",
      code: "",
      department: departments.length > 0 ? departments[0]._id : "",
      mainTeacher: initialMainTeacher,
      entryYear: new Date().getFullYear(),
      description: "",
    });
    setCurrentClass(null);
    setModalMode("create");
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (adminClass) => {
    setCurrentClass(adminClass);
    setFormData({
      name: adminClass.name,
      code: adminClass.code,
      department: adminClass.department._id || adminClass.department,
      mainTeacher: adminClass.mainTeacher ? adminClass.mainTeacher._id : "",
      entryYear: adminClass.entryYear,
      description: adminClass.description || "",
    });
    setModalMode("edit");
    setShowModal(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dataToSubmit = { ...formData };

      // Đảm bảo trường mainTeacher được gửi đi đúng
      // Khi không chọn giảng viên (giá trị rỗng), gửi giá trị null
      if (dataToSubmit.mainTeacher === "") {
        dataToSubmit.mainTeacher = null;
      }

      // Nếu là chế độ xem giảng viên, đặt mainTeacher là ID của giảng viên hiện tại
      if (isTeacherViewMode && modalMode === "create") {
        dataToSubmit.mainTeacher = currentUser._id;
      }

      console.log("Dữ liệu gửi đi:", {
        ...dataToSubmit,
        mainTeacher: dataToSubmit.mainTeacher, // Để kiểm tra giá trị, kiểu dữ liệu
      });

      let response;
      if (modalMode === "create") {
        // Tạo lớp mới
        response = await axios.post("/api/admin-classes", dataToSubmit);
        console.log("Phản hồi từ server (create):", response.data);
        toast.success("Tạo lớp thành công!");

        // Xử lý dữ liệu trả về
        let newClass = response.data;

        // Đảm bảo thông tin giảng viên và khoa đầy đủ
        if (newClass.department && typeof newClass.department === "string") {
          const departmentInfo = departments.find(
            (d) => d._id === newClass.department
          );
          if (departmentInfo) {
            newClass.department = departmentInfo;
          }
        }

        if (newClass.mainTeacher && typeof newClass.mainTeacher === "string") {
          const teacherInfo = teachers.find(
            (t) => t._id === newClass.mainTeacher
          );
          if (teacherInfo) {
            newClass.mainTeacher = {
              _id: teacherInfo._id,
              name: teacherInfo.name,
              email: teacherInfo.email,
            };
          }
        }

        // Cập nhật state
        setAdminClasses((prev) => [...prev, newClass]);
      } else {
        // Cập nhật lớp
        response = await axios.put(
          `/api/admin-classes/${currentClass._id}`,
          dataToSubmit
        );
        console.log("Phản hồi từ server (update):", response.data);
        toast.success("Cập nhật lớp thành công!");

        // Xử lý dữ liệu trả về
        let updatedClass = response.data.adminClass;

        // Đảm bảo thông tin giảng viên và khoa đầy đủ
        if (
          updatedClass.department &&
          typeof updatedClass.department === "string"
        ) {
          const departmentInfo = departments.find(
            (d) => d._id === updatedClass.department
          );
          if (departmentInfo) {
            updatedClass.department = departmentInfo;
          }
        }

        if (
          updatedClass.mainTeacher &&
          typeof updatedClass.mainTeacher === "string"
        ) {
          const teacherInfo = teachers.find(
            (t) => t._id === updatedClass.mainTeacher
          );
          if (teacherInfo) {
            updatedClass.mainTeacher = {
              _id: teacherInfo._id,
              name: teacherInfo.name,
              email: teacherInfo.email,
            };
          }
        }

        // Cập nhật state
        setAdminClasses((prev) =>
          prev.map((cls) => (cls._id === currentClass._id ? updatedClass : cls))
        );
      }

      // Đóng modal sau khi hoàn thành
      setShowModal(false);
    } catch (error) {
      console.error("Error saving admin class:", error);
      toast.error(error.response?.data?.message || "Lỗi khi lưu lớp quản lý");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle class deletion
  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lớp quản lý này?")) {
      return;
    }

    try {
      await axios.delete(`/api/admin-classes/${id}`);
      setAdminClasses((prev) => prev.filter((cls) => cls._id !== id));
      toast.success("Xóa lớp quản lý thành công");
    } catch (error) {
      console.error("Error deleting admin class:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa lớp quản lý");
    }
  };

  // Get department name by ID
  const getDepartmentName = (departmentId) => {
    const department = departments.find((d) => d._id === departmentId);
    return department ? department.name : "Không xác định";
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher ? teacher.name : "Không có";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý lớp chính</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          <FaPlus className="mr-2" /> Thêm lớp quản lý
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên lớp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mã lớp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khoa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giảng viên chủ nhiệm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khóa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số SV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tác vụ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adminClasses.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    Chưa có lớp quản lý nào
                  </td>
                </tr>
              ) : (
                adminClasses.map((adminClass) => (
                  <tr key={adminClass._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        {adminClass.name}
                        {adminClass.pendingCount > 0 && (
                          <span className="ml-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      {adminClass.description && (
                        <div className="text-sm text-gray-500">
                          {adminClass.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {adminClass.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {adminClass.department &&
                        typeof adminClass.department === "object"
                          ? adminClass.department.name
                          : getDepartmentName(adminClass.department)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {adminClass.mainTeacher ? (
                          <div className="flex items-center">
                            <FaChalkboardTeacher className="text-blue-500 mr-1" />
                            {adminClass.mainTeacher.name}
                          </div>
                        ) : (
                          <span className="text-gray-400">Chưa có</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {adminClass.entryYear}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <span className="font-medium">
                          {adminClass.studentCount || 0}
                        </span>
                        {adminClass.pendingCount > 0 && (
                          <span className="ml-2 bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center">
                            +{adminClass.pendingCount} chờ duyệt
                            <span className="inline-block animate-pulse bg-yellow-500 w-2 h-2 rounded-full ml-1"></span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(adminClass)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <FaEdit className="inline" /> Sửa
                      </button>
                      <Link
                        to={`${
                          isTeacherViewMode
                            ? "/mainclasses"
                            : "/admin/admin-classes"
                        }/${adminClass._id}/students`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <FaUsers className="inline" /> Sinh viên
                      </Link>
                      {!isTeacherViewMode && (
                        <button
                          onClick={() => handleDelete(adminClass._id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={adminClass.studentCount > 0}
                          title={
                            adminClass.studentCount > 0
                              ? "Không thể xóa lớp có sinh viên"
                              : "Xóa lớp"
                          }
                        >
                          <FaTrash className="inline" /> Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for create/edit admin class */}
      {showModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {modalMode === "create"
                      ? "Thêm lớp quản lý mới"
                      : "Cập nhật lớp quản lý"}
                  </h3>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Tên lớp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      placeholder="Nhập tên lớp"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Mã lớp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      placeholder="Nhập mã lớp (vd: IT-K17A)"
                      required
                      disabled={modalMode === "edit"}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Khoa <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
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

                  {/* Trường chọn giảng viên chủ nhiệm - Chỉ hiển thị nếu là admin */}
                  {!isTeacherViewMode && (
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Giảng viên chủ nhiệm{" "}
                        {modalMode === "create" && (
                          <span className="text-gray-500 font-normal">
                            (tùy chọn)
                          </span>
                        )}
                      </label>
                      <select
                        name="mainTeacher"
                        value={formData.mainTeacher}
                        onChange={handleChange}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      >
                        <option value="">
                          -- Chọn giảng viên chủ nhiệm --
                        </option>
                        {teachers.map((teacher) => (
                          <option key={teacher._id} value={teacher._id}>
                            {teacher.name} ({teacher.email})
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-1">
                        Giảng viên chủ nhiệm sẽ có quyền quản lý sinh viên trong
                        lớp này
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Khóa (Năm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="entryYear"
                      value={formData.entryYear}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      placeholder="Nhập năm nhập học"
                      min="2000"
                      max="2100"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Mô tả
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      placeholder="Nhập mô tả (không bắt buộc)"
                      rows="3"
                    ></textarea>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {modalMode === "create" ? "Tạo lớp" : "Cập nhật"}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClassManagement;
