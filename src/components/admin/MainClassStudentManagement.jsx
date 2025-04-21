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
  FaUserCheck,
  FaUserSlash,
  FaFilter,
  FaEye,
  FaTimes,
  FaSpinner,
  FaCheck,
  FaBan,
} from "react-icons/fa";
import { useAuth } from "../../contexts/AuthContext";

const MainClassStudentManagement = ({ isTeacherView = false }) => {
  const { currentUser } = useAuth();
  const { classId } = useParams();
  const [adminClass, setAdminClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPendingTab, setShowPendingTab] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [selectedFaceImage, setSelectedFaceImage] = useState(null);
  const [loadingFaceImage, setLoadingFaceImage] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    studentId: "",
    email: "",
    phone: "",
    gender: "male",
  });
  const [selectedSection, setSelectedSection] = useState("active");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Determine the back button URL based on the view
  const backButtonUrl = isTeacherView
    ? "/teacher/admin-classes"
    : "/admin/admin-classes";

  // Lấy thông tin lớp và danh sách sinh viên
  useEffect(() => {
    if (!classId) return;

    fetchData();
  }, [classId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("[NEW FLOW] Fetching class data and students");

      // Get class info and students
      const [adminClassRes, studentsRes] = await Promise.all([
        axios.get(`/api/admin-classes/${classId}`),
        axios.get(`/api/admin-classes/${classId}/students?showPending=false`),
      ]);

      setAdminClass(adminClassRes.data);
      setStudents(studentsRes.data);

      // Get pending students
      fetchPendingStudents();
    } catch (error) {
      console.error("[NEW FLOW] Error fetching data:", error);
      toast.error("Không thể tải dữ liệu lớp học");
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách sinh viên đang chờ phê duyệt
  const fetchPendingStudents = async () => {
    try {
      setLoadingPending(true);
      console.log(
        `[UNIQUE PATH] Fetching pending students for class ID: ${classId}`
      );

      // Call the NEW modified endpoint
      const response = await axios.get(
        `/api/admin-classes/${classId}/student-approvals`
      );
      console.log("[UNIQUE PATH] Pending students response:", response.data);

      // Set pending students data
      setPendingStudents(response.data);
    } catch (error) {
      console.error("[UNIQUE PATH] Error fetching pending students:", error);
      setPendingStudents([]);
      toast.warning("Không thể tải danh sách sinh viên chờ duyệt");
    } finally {
      setLoadingPending(false);
    }
  };

  // Lấy ảnh khuôn mặt của sinh viên
  const fetchFaceImage = async (studentId) => {
    try {
      setLoadingFaceImage(true);
      const response = await axios.get(`/api/students/${studentId}/face-image`);
      setSelectedFaceImage(response.data);
    } catch (error) {
      console.error("Error fetching face image:", error);
      toast.error(
        error.response?.data?.message || "Không thể tải ảnh khuôn mặt sinh viên"
      );
    } finally {
      setLoadingFaceImage(false);
    }
  };

  // Đóng modal xem ảnh khuôn mặt
  const closeFaceImageModal = () => {
    setSelectedFaceImage(null);
  };

  // Lọc sinh viên theo tìm kiếm
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email &&
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPendingStudents = pendingStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email &&
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Duyệt sinh viên chờ phê duyệt
  const approveStudent = async (pendingStudent) => {
    try {
      setApproving(true);
      console.log("[UNIQUE PATH] Approving student:", pendingStudent);

      // Call the NEW approval endpoint
      const response = await axios.put(
        `/api/admin-classes/${classId}/approve-student-new/${pendingStudent._id}`
      );

      console.log("[UNIQUE PATH] Approve student response:", response.data);
      toast.success("Phê duyệt sinh viên thành công");

      // Refresh both lists
      await fetchPendingStudents();
      await fetchData();
    } catch (error) {
      console.error("[UNIQUE PATH] Error approving student:", error);
      toast.error(
        error.response?.data?.message || "Không thể phê duyệt sinh viên"
      );
    } finally {
      setApproving(false);
    }
  };

  // Từ chối sinh viên chờ phê duyệt
  const rejectStudent = async (pendingStudent) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn từ chối sinh viên ${pendingStudent.name}?`
      )
    ) {
      return;
    }

    try {
      setRejecting(true);

      // Call the NEW rejection endpoint
      const response = await axios.put(
        `/api/admin-classes/${classId}/reject-student-new/${pendingStudent._id}`
      );

      console.log("[UNIQUE PATH] Reject student response:", response.data);
      toast.success("Đã từ chối sinh viên thành công");

      // Refresh pending students list
      fetchPendingStudents();
    } catch (error) {
      console.error("[UNIQUE PATH] Error rejecting student:", error);
      toast.error(error.response?.data?.message || "Lỗi khi từ chối sinh viên");
    } finally {
      setRejecting(false);
    }
  };

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

  // Kiểm tra xem có phải chủ nhiệm lớp hay admin không
  const isClassAdminOrMainTeacher = () => {
    return (
      currentUser?.role === "admin" ||
      (adminClass?.mainTeacher &&
        adminClass.mainTeacher._id === currentUser?._id)
    );
  };

  const handleToggleStudentStatus = async (studentId, currentStatus) => {
    try {
      await axios.put(
        `/api/admin-classes/${classId}/students/${studentId}/toggle-status`
      );
      toast.success(
        currentStatus
          ? "Đã vô hiệu hóa sinh viên"
          : "Đã kích hoạt lại sinh viên"
      );
      fetchData();
    } catch (error) {
      console.error("Error toggling student status:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi thay đổi trạng thái sinh viên"
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={backButtonUrl}
              className="text-blue-500 hover:text-blue-700"
            >
              <FaArrowLeft />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">
              Quản lý sinh viên lớp: {adminClass?.name || "..."}
            </h1>
          </div>
          <p className="text-gray-600">
            Mã lớp: {adminClass?.code || "..."}, Tổng sinh viên đã duyệt:{" "}
            {students.length}
            {pendingStudents.length > 0 && (
              <span className="text-yellow-600 ml-2 font-medium">
                (+ {pendingStudents.length} sinh viên chờ duyệt{" "}
                <span className="inline-block animate-pulse bg-yellow-400 w-2 h-2 rounded-full ml-1"></span>
                )
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPendingTab(!showPendingTab)}
            className={`${
              pendingStudents.length > 0 ? "bg-yellow-500" : "bg-gray-500"
            } hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2 ${
              pendingStudents.length > 0 ? "animate-pulse" : ""
            }`}
          >
            <FaFilter />{" "}
            {showPendingTab
              ? "Đang xem sinh viên chờ duyệt"
              : "Xem sinh viên chờ duyệt"}
            {pendingStudents.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingStudents.length}
              </span>
            )}
          </button>

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

      {/* Hiển thị tab sinh viên chờ duyệt */}
      {showPendingTab && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-4 bg-yellow-50 border-b border-yellow-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-yellow-800 flex items-center">
                <span className="inline-block mr-2 animate-pulse bg-yellow-400 w-3 h-3 rounded-full"></span>
                Danh sách sinh viên chờ duyệt
              </h2>
              <p className="text-sm text-yellow-600">
                Sinh viên đã đăng ký và đang chờ phê duyệt để trở thành thành
                viên chính thức của lớp
              </p>
            </div>
            <button
              onClick={() => setShowPendingTab(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-3 rounded inline-flex items-center"
            >
              <FaTimes className="mr-1" /> Đóng
            </button>
          </div>

          {loadingPending ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-600">Đang tải...</p>
            </div>
          ) : filteredPendingStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Không có sinh viên nào đang chờ duyệt
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Mã SV
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Họ và tên
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Số điện thoại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Dữ liệu khuôn mặt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-yellow-800 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPendingStudents.map((student) => (
                    <tr key={student._id} className="hover:bg-yellow-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.studentId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.email || student.account?.email || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.phone || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.faceFeatures ? (
                          <span className="text-green-500 font-medium">
                            Đã có
                          </span>
                        ) : (
                          <span className="text-red-500">Chưa có</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {student.faceFeatures && (
                            <button
                              onClick={() => fetchFaceImage(student._id)}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-600 font-medium py-1 px-3 rounded-md flex items-center"
                              title="Xem ảnh khuôn mặt"
                            >
                              <FaEye className="mr-1" /> Xem ảnh
                            </button>
                          )}
                          <button
                            onClick={() => approveStudent(student)}
                            className="bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-700 font-medium py-1 px-3 rounded-md flex items-center"
                            title="Phê duyệt sinh viên"
                          >
                            <FaUserCheck className="mr-1" /> Duyệt
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Từ chối sinh viên"
                            onClick={() => rejectStudent(student)}
                            disabled={rejecting}
                          >
                            {rejecting ? (
                              <FaSpinner className="icon-spin" />
                            ) : (
                              <FaTimes />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Đang tải...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto hide-scrollbar">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.studentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.email || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.gender === "male" ? "Nam" : "Nữ"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.faceFeatures ? (
                        <span className="text-green-500 font-medium">
                          Đã có
                        </span>
                      ) : (
                        <span className="text-red-500">Chưa có</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.active !== false ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FaCheck className="mr-1" /> Kích hoạt
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <FaBan className="mr-1" /> Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-normal">
                      <div className="flex items-center justify-end gap-3 flex-nowrap">
                        {student.faceFeatures && (
                          <button
                            onClick={() => fetchFaceImage(student._id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full w-12 h-12 flex items-center justify-center relative group"
                            title="Xem ảnh khuôn mặt"
                          >
                            <FaEye className="text-xl" />
                            <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[-40px] left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-center rounded px-2 py-1 text-xs whitespace-nowrap">
                              Xem ảnh
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleToggleStudentStatus(
                              student._id,
                              student.active
                            )
                          }
                          className={`${
                            student.active
                              ? "bg-yellow-500 hover:bg-yellow-600"
                              : "bg-green-500 hover:bg-green-600"
                          } text-white p-2 rounded-full w-12 h-12 flex items-center justify-center relative group`}
                          title={
                            student.active
                              ? "Vô hiệu hóa sinh viên"
                              : "Kích hoạt lại sinh viên"
                          }
                        >
                          {student.active ? (
                            <FaBan className="text-xl" />
                          ) : (
                            <FaCheck className="text-xl" />
                          )}
                          <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[-40px] left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-center rounded px-2 py-1 text-xs whitespace-nowrap">
                            {student.active ? "Khóa" : "Kích hoạt"}
                          </span>
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(student._id)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full w-12 h-12 flex items-center justify-center relative group"
                          title="Xóa sinh viên khỏi lớp"
                        >
                          <FaUserMinus className="text-xl" />
                          <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[-40px] left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-center rounded px-2 py-1 text-xs whitespace-nowrap">
                            Xóa
                          </span>
                        </button>
                      </div>
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
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold mb-4">
                {uploadMode
                  ? "Nhập sinh viên từ file CSV"
                  : "Thêm sinh viên mới"}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 flex space-x-4">
              <button
                onClick={() => setUploadMode(false)}
                className={`px-4 py-2 ${
                  !uploadMode
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700"
                } rounded`}
              >
                Thêm thủ công
              </button>
              <button
                onClick={() => setUploadMode(true)}
                className={`px-4 py-2 ${
                  uploadMode
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700"
                } rounded`}
              >
                Nhập từ CSV
              </button>
            </div>

            {!uploadMode ? (
              <form onSubmit={handleAddStudent}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={newStudent.name}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, name: e.target.value })
                    }
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Nhập họ và tên"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Mã sinh viên
                  </label>
                  <input
                    type="text"
                    value={newStudent.studentId}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        studentId: e.target.value,
                      })
                    }
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Nhập mã sinh viên"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newStudent.email}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, email: e.target.value })
                    }
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Nhập email (không bắt buộc)"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={newStudent.phone}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, phone: e.target.value })
                    }
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Nhập số điện thoại (không bắt buộc)"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Giới tính
                  </label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={newStudent.gender === "male"}
                        onChange={() =>
                          setNewStudent({ ...newStudent, gender: "male" })
                        }
                        className="form-radio"
                      />
                      <span className="ml-2">Nam</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={newStudent.gender === "female"}
                        onChange={() =>
                          setNewStudent({ ...newStudent, gender: "female" })
                        }
                        className="form-radio"
                      />
                      <span className="ml-2">Nữ</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded mr-2 hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Thêm sinh viên
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCSVUpload}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Chọn file CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    File CSV phải có các cột: name, studentId, email (tùy chọn),
                    phone (tùy chọn), gender (male/female, mặc định là male)
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded mr-2 hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                  >
                    <FaUpload className="mr-2" /> Tải lên
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal xem ảnh khuôn mặt */}
      {selectedFaceImage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">
                Ảnh khuôn mặt: {selectedFaceImage.studentName}
              </h2>
              <button
                onClick={closeFaceImageModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            {loadingFaceImage ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-gray-600">Đang tải...</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">
                    Mã sinh viên: {selectedFaceImage.studentId}
                  </p>
                </div>
                <div className="flex justify-center">
                  {selectedFaceImage.faceImage ? (
                    <img
                      src={selectedFaceImage.faceImage}
                      alt={`Face of ${selectedFaceImage.studentName}`}
                      className="max-w-full rounded-lg shadow-md"
                    />
                  ) : (
                    <div className="bg-gray-100 w-64 h-64 flex items-center justify-center rounded-lg">
                      <p className="text-gray-500">Không có ảnh</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeFaceImageModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
        .hide-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        `}
      </style>
    </div>
  );
};

export default MainClassStudentManagement;
