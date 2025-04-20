import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";
import {
  FaUserPlus,
  FaUserMinus,
  FaArrowLeft,
  FaSearch,
  FaUpload,
} from "react-icons/fa";

const MainClassStudentManagement = () => {
  const { classId } = useParams();
  const [adminClass, setAdminClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [newStudent, setNewStudent] = useState({
    name: "",
    studentId: "",
    email: "",
    phone: "",
    gender: "male",
  });

  // Lấy thông tin lớp và danh sách sinh viên
  useEffect(() => {
    if (!classId) return;

    fetchData();
  }, [classId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adminClassRes, studentsRes] = await Promise.all([
        axios.get(`/api/admin-classes/${classId}`),
        axios.get(`/api/admin-classes/${classId}/students`),
      ]);

      setAdminClass(adminClassRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Không thể tải dữ liệu lớp học");
    } finally {
      setLoading(false);
    }
  };

  // Lọc sinh viên theo tìm kiếm
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email &&
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Thêm sinh viên mới
  const handleAddStudent = async (e) => {
    e.preventDefault();

    try {
      if (!newStudent.name || !newStudent.studentId) {
        toast.error("Vui lòng điền họ tên và mã sinh viên");
        return;
      }

      const response = await axios.post(
        `/api/admin-classes/${classId}/students`,
        newStudent
      );
      toast.success("Thêm sinh viên thành công");

      setStudents([...students, response.data]);
      setShowAddModal(false);
      resetNewStudentForm();
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error(error.response?.data?.message || "Lỗi khi thêm sinh viên");
    }
  };

  // Xử lý upload file CSV
  const handleCSVUpload = async (e) => {
    e.preventDefault();

    if (!csvFile) {
      toast.error("Vui lòng chọn file CSV");
      return;
    }

    const formData = new FormData();
    formData.append("csvFile", csvFile);

    try {
      const response = await axios.post(
        `/api/admin-classes/${classId}/import-students`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success(`Đã thêm ${response.data.addedCount} sinh viên thành công`);
      setShowAddModal(false);
      fetchData(); // Refresh the student list
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error(error.response?.data?.message || "Lỗi khi nhập file CSV");
    }
  };

  // Xóa sinh viên khỏi lớp
  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa sinh viên này khỏi lớp?")) {
      return;
    }

    try {
      await axios.delete(`/api/admin-classes/${classId}/students/${studentId}`);
      toast.success("Đã xóa sinh viên khỏi lớp");

      // Cập nhật danh sách sinh viên
      setStudents(students.filter((student) => student._id !== studentId));
    } catch (error) {
      console.error("Error removing student:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa sinh viên");
    }
  };

  // Reset form thêm sinh viên
  const resetNewStudentForm = () => {
    setNewStudent({
      name: "",
      studentId: "",
      email: "",
      phone: "",
      gender: "male",
    });
    setCsvFile(null);
    setUploadMode(false);
  };

  // Handle file input change
  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/admin-classes"
              className="text-blue-500 hover:text-blue-700"
            >
              <FaArrowLeft />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">
              Quản lý sinh viên lớp: {adminClass?.name || "..."}
            </h1>
          </div>
          <p className="text-gray-600">
            Mã lớp: {adminClass?.code || "..."}, Tổng số sinh viên:{" "}
            {students.length}
          </p>
        </div>
        <button
          onClick={() => {
            resetNewStudentForm();
            setShowAddModal(true);
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
        >
          <FaUserPlus /> Thêm sinh viên
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-grow max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên, mã sinh viên hoặc email..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
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
                  Mã SV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Họ và tên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số điện thoại
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giới tính
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dữ liệu khuôn mặt
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
                    {searchTerm
                      ? "Không tìm thấy sinh viên nào phù hợp"
                      : "Chưa có sinh viên nào trong lớp"}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.studentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.gender === "male" ? "Nam" : "Nữ"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.faceImage ? (
                        <span className="text-green-500">Đã có dữ liệu</span>
                      ) : (
                        <span className="text-red-500">Chưa có dữ liệu</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveStudent(student._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaUserMinus className="inline mr-1" /> Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm sinh viên */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">
                Thêm sinh viên vào lớp {adminClass?.name}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>

            <div className="mb-4">
              <div className="flex space-x-4">
                <button
                  onClick={() => setUploadMode(false)}
                  className={`px-4 py-2 rounded-lg ${
                    !uploadMode
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Thêm thủ công
                </button>
                <button
                  onClick={() => setUploadMode(true)}
                  className={`px-4 py-2 rounded-lg ${
                    uploadMode
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Tải lên CSV
                </button>
              </div>
            </div>

            {!uploadMode ? (
              <form onSubmit={handleAddStudent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newStudent.name}
                      onChange={(e) =>
                        setNewStudent({ ...newStudent, name: e.target.value })
                      }
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập họ và tên"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Mã sinh viên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="studentId"
                      value={newStudent.studentId}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          studentId: e.target.value,
                        })
                      }
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập mã sinh viên"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={newStudent.email}
                      onChange={(e) =>
                        setNewStudent({ ...newStudent, email: e.target.value })
                      }
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập email"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={newStudent.phone}
                      onChange={(e) =>
                        setNewStudent({ ...newStudent, phone: e.target.value })
                      }
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Giới tính
                    </label>
                    <select
                      name="gender"
                      value={newStudent.gender}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          gender: e.target.value,
                        })
                      }
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end mt-6 space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Thêm sinh viên
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCSVUpload}>
                <div className="mb-4">
                  <p className="text-gray-700 mb-2">
                    Tải lên file CSV chứa danh sách sinh viên. File phải có các
                    cột:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 mb-4">
                    <li>name (Họ tên)</li>
                    <li>studentId (Mã sinh viên)</li>
                    <li>email (Email - tùy chọn)</li>
                    <li>phone (Số điện thoại - tùy chọn)</li>
                    <li>gender (Giới tính: male/female - mặc định male)</li>
                  </ul>

                  <div className="mt-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Chọn file CSV <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6 space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
                  >
                    <FaUpload className="mr-2" /> Tải lên và nhập
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainClassStudentManagement;
