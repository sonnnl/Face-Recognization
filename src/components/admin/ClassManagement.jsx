import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [currentClass, setCurrentClass] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    totalSessions: "",
    mainClass: false,
    department: "",
    campus: "",
    room: "",
    // Keep classroom for backward compatibility
    classroom: {
      room: "",
      floor: "",
      building: "",
    },
  });
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Fetch classes, teachers, departments, campuses, and rooms
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [
          classesResponse,
          teachersResponse,
          departmentsResponse,
          campusesResponse,
          roomsResponse,
        ] = await Promise.all([
          axios.get("/api/classes"),
          axios.get("/api/admin/teachers"),
          axios.get("/api/departments"),
          axios.get("/api/campuses"),
          axios.get("/api/rooms"),
        ]);
        setClasses(classesResponse.data);
        setTeachers(teachersResponse.data);
        setDepartments(departmentsResponse.data);
        setCampuses(campusesResponse.data);
        setRooms(roomsResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter rooms when campus changes
  useEffect(() => {
    if (formData.campus) {
      const filtered = rooms.filter(
        (room) => room.campus && room.campus._id === formData.campus
      );
      setFilteredRooms(filtered);
    } else {
      setFilteredRooms([]);
    }
  }, [formData.campus, rooms]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("classroom.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        classroom: {
          ...prev.classroom,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  // Open edit class modal
  const openEditModal = (classItem) => {
    setCurrentClass(classItem);
    setFormData({
      name: classItem.name,
      description: classItem.description || "",
      startDate: new Date(classItem.startDate).toISOString().split("T")[0],
      totalSessions: classItem.totalSessions,
      mainClass: classItem.mainClass || false,
      department: classItem.department || "",
      campus: classItem.campus || "",
      room: classItem.room || "",
      classroom: {
        room: classItem.classroom?.room || "",
        floor: classItem.classroom?.floor || "",
        building: classItem.classroom?.building || "",
      },
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

  // Đồng bộ số lượng sinh viên
  const syncStudentCount = async () => {
    try {
      setSyncing(true);
      const response = await axios.post("/api/admin/sync-student-count");

      // Nếu có lớp học nào được cập nhật, tải lại danh sách
      if (response.data.updatedClasses > 0) {
        const classesResponse = await axios.get("/api/classes");
        setClasses(classesResponse.data);
        toast.success(`Đã đồng bộ ${response.data.updatedClasses} lớp học`);
      } else {
        toast.info("Tất cả các lớp học đã đồng bộ");
      }
    } catch (error) {
      console.error("Error syncing student count:", error);
      toast.error("Lỗi khi đồng bộ số lượng sinh viên");
    } finally {
      setSyncing(false);
    }
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t._id === teacherId);
    return teacher ? teacher.name : "Không xác định";
  };

  // Get department name by ID
  const getDepartmentName = (departmentId) => {
    if (!departmentId) return "-";
    const department = departments.find((d) => d._id === departmentId);
    return department ? department.name : "Không xác định";
  };

  // Get campus name by ID
  const getCampusName = (campusId) => {
    if (!campusId) return "-";
    const campus = campuses.find((c) => c._id === campusId);
    return campus ? campus.name : "Không xác định";
  };

  // Get room name by ID
  const getRoomName = (roomId) => {
    if (!roomId) return "-";
    const room = rooms.find((r) => r._id === roomId);
    return room ? room.name : "Không xác định";
  };

  // Format classroom info (for backward compatibility)
  const formatClassroom = (classroom) => {
    if (
      !classroom ||
      (!classroom.room && !classroom.floor && !classroom.building)
    ) {
      return "-";
    }

    const parts = [];

    if (classroom.room) parts.push(`Phòng ${classroom.room}`);
    if (classroom.floor) parts.push(`Tầng ${classroom.floor}`);
    if (classroom.building) parts.push(`Tòa ${classroom.building}`);

    return parts.join(", ");
  };

  // Format location info from campus and room
  const formatLocation = (classItem) => {
    // Check for new campus and room format first
    if (classItem.campus && classItem.room) {
      const campus = getCampusName(classItem.campus);
      const room = getRoomName(classItem.room);
      return `${campus} - ${room}`;
    }

    // Fallback to old classroom format
    return formatClassroom(classItem.classroom);
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
        <div className="flex space-x-3">
          <button
            onClick={syncStudentCount}
            disabled={syncing || loading}
            className={`px-4 py-2 rounded ${
              syncing || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {syncing ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Đang đồng bộ...
              </span>
            ) : (
              "Đồng bộ số SV"
            )}
          </button>
          <Link
            to="/admin/departments"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Quản lý khoa
          </Link>
          <Link
            to="/admin"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            ← Quay lại Dashboard
          </Link>
        </div>
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
                  Khoa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa điểm
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
                    colSpan="8"
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
                      {classItem.mainClass && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
                          Lớp chính
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {getTeacherName(classItem.teacher)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getDepartmentName(classItem.department)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatLocation(classItem)}
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
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              Chỉnh sửa lớp học: {currentClass.name}
            </h2>
            <form onSubmit={handleUpdateClass}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Khoa
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn khoa --</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  rows="2"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="mb-4">
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
              </div>

              <div className="mb-4 border-t border-gray-200 pt-4">
                <h3 className="text-md font-bold mb-2">Thông tin địa điểm</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Cơ sở
                    </label>
                    <select
                      name="campus"
                      value={formData.campus}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn cơ sở --</option>
                      {campuses.map((campus) => (
                        <option key={campus._id} value={campus._id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Phòng học
                    </label>
                    <select
                      name="room"
                      value={formData.room}
                      onChange={handleChange}
                      disabled={!formData.campus}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">-- Chọn phòng --</option>
                      {filteredRooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.name} - Tòa {room.building}, Tầng {room.floor}
                        </option>
                      ))}
                    </select>
                    {!formData.campus && (
                      <p className="text-xs text-gray-500 mt-1">
                        Vui lòng chọn cơ sở trước
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-100 p-3 rounded-md mb-3">
                  <h4 className="text-sm font-semibold mb-2">
                    Legacy: Thông tin phòng học (hỗ trợ cũ)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Phòng
                      </label>
                      <input
                        type="text"
                        name="classroom.room"
                        value={formData.classroom.room}
                        onChange={handleChange}
                        placeholder="Ví dụ: B1.01"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Tầng
                      </label>
                      <input
                        type="text"
                        name="classroom.floor"
                        value={formData.classroom.floor}
                        onChange={handleChange}
                        placeholder="Ví dụ: 2"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Tòa nhà
                      </label>
                      <input
                        type="text"
                        name="classroom.building"
                        value={formData.classroom.building}
                        onChange={handleChange}
                        placeholder="Ví dụ: A"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex items-center">
                <input
                  type="checkbox"
                  name="mainClass"
                  id="mainClass"
                  checked={formData.mainClass}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <label
                  htmlFor="mainClass"
                  className="text-gray-700 text-sm font-bold"
                >
                  Đánh dấu là lớp chính
                </label>
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
