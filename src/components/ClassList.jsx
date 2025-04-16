import React, { useState, useEffect } from "react";
import axios from "../config/axios";
import { useAuth } from "../contexts/AuthContext";

const ClassList = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState({});
  const [newClassName, setNewClassName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [totalSessions, setTotalSessions] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingClass, setDeletingClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [showStudents, setShowStudents] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(null);

  const { currentUser } = useAuth();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchTeacherInfo = async (teacherId) => {
    if (teachers[teacherId]) return teachers[teacherId];

    try {
      const response = await axios.get(`/api/teachers/${teacherId}`);
      const teacherData = response.data;
      setTeachers((prev) => ({ ...prev, [teacherId]: teacherData }));
      return teacherData;
    } catch (error) {
      console.error("Không thể lấy thông tin giáo viên:", error);
      return { name: "Không xác định" };
    }
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/classes");
      setClasses(response.data);

      const teacherIds = [...new Set(response.data.map((cls) => cls.teacher))];
      for (const id of teacherIds) {
        await fetchTeacherInfo(id);
      }
    } catch (error) {
      setError("Không thể tải danh sách lớp học");
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newClassName || !startDate || !totalSessions) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post("/api/classes", {
        name: newClassName,
        description: description,
        startDate: new Date(startDate),
        totalSessions: parseInt(totalSessions),
      });

      await axios.post(`/api/classes/${response.data._id}/schedule`);

      if (response.data.teacher) {
        setTeachers((prev) => ({
          ...prev,
          [response.data.teacher]: {
            name: currentUser.name,
            id: currentUser._id,
          },
        }));
      }

      setClasses([...classes, response.data]);
      setNewClassName("");
      setDescription("");
      setStartDate("");
      setTotalSessions("");
      setError("");
    } catch (error) {
      setError("Không thể tạo lớp học");
      console.error("Error creating class:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lớp học này?")) {
      return;
    }

    try {
      setDeletingClass(classId);
      await axios.delete(`/api/classes/${classId}`);
      setClasses(classes.filter((cls) => cls._id !== classId));
    } catch (error) {
      setError("Không thể xóa lớp học");
      console.error("Error deleting class:", error);
    } finally {
      setDeletingClass(null);
    }
  };

  const handleViewSchedule = async (classId) => {
    try {
      setLoading(true);

      const classResponse = await axios.get(`/api/classes/${classId}`);
      setSelectedClass(classResponse.data);

      const scheduleResponse = await axios.get(
        `/api/classes/${classId}/schedule`
      );
      setSchedule(scheduleResponse.data);

      const statsResponse = await axios.get(
        `/api/classes/${classId}/attendance-stats`
      );
      setStats(statsResponse.data);

      const attendanceResponse = await axios.get(
        `/api/classes/${classId}/attendance`
      );
      setAttendanceHistory(attendanceResponse.data);

      const studentsResponse = await axios.get(
        `/api/students/class/${classId}`
      );
      setStudents(studentsResponse.data);

      setError("");
      setSelectedSession(null);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching class data:", error);
      setError("Không thể tải thông tin lớp học");
    } finally {
      setLoading(false);
    }
  };

  const viewSessionAttendance = async (sessionNumber) => {
    const attendance = attendanceHistory.find(
      (record) => record.sessionNumber === sessionNumber
    );

    if (attendance) {
      if ((!students || students.length === 0) && selectedClass) {
        try {
          console.log(`Loading students for class: ${selectedClass._id}`);
          const response = await axios.get(
            `/api/students/class/${selectedClass._id}`
          );
          if (response.data && Array.isArray(response.data)) {
            console.log(`Loaded ${response.data.length} students`);
            setStudents(response.data);
          }
        } catch (error) {
          console.error("Error loading students for attendance view:", error);
        }
      }

      setSelectedSession(sessionNumber);
      setSessionAttendance(attendance);
    }
  };

  const handleViewStudents = async (classId) => {
    try {
      setLoading(true);
      console.log(`Fetching students for class: ${classId}`);

      const classResponse = await axios.get(`/api/classes/${classId}`);
      setSelectedClass(classResponse.data);

      const response = await axios.get(`/api/students/class/${classId}`);
      console.log("Students data:", response.data);

      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((student, index) => {
          console.log(`Student ${index}:`, {
            id: student._id,
            name: student.name,
            studentId: student.studentId,
            hasValidId:
              student._id &&
              typeof student._id === "string" &&
              student._id.length === 24,
          });
        });
      }

      setStudents(response.data);
      setShowStudents(true);
      setSelectedSession(null);
      setIsModalOpen(true);
    } catch (error) {
      setError("Không thể tải danh sách sinh viên");
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa sinh viên này?")) {
      return;
    }

    try {
      setDeletingStudent(studentId);
      console.log(`Attempting to delete student with ID: ${studentId}`);

      if (
        !studentId ||
        typeof studentId !== "string" ||
        studentId.length !== 24
      ) {
        console.error("Invalid student ID format:", studentId);
        setError("ID sinh viên không hợp lệ");
        return;
      }

      const response = await axios.delete(`/api/students/delete/${studentId}`);
      console.log("Delete response:", response.data);

      setStudents(students.filter((student) => student._id !== studentId));

      fetchClasses();
    } catch (error) {
      console.error("Error deleting student:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response ? error.response.data : "No response data",
        status: error.response ? error.response.status : "No status",
      });

      if (error.response && error.response.status === 404) {
        setError("Không tìm thấy sinh viên để xóa");
      } else {
        setError(`Không thể xóa sinh viên: ${error.message}`);
      }
    } finally {
      setDeletingStudent(null);
    }
  };

  const handleExportExcel = async (classId, className) => {
    try {
      setExportLoading(classId);

      const response = await axios.get(
        `/api/classes/${classId}/attendance-export`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `diem-danh-${className.replace(/\s+/g, "_")}.xlsx`
      );
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportLoading(null);

      setError("");
    } catch (error) {
      console.error("Lỗi khi xuất báo cáo:", error);
      setError("Không thể xuất báo cáo Excel. Vui lòng thử lại sau.");
      setExportLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Quản lý lớp học</h2>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Tạo lớp học mới</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tên lớp:</label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nhập tên lớp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Mô tả (tùy chọn):
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nhập mô tả"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Ngày bắt đầu:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Tổng số buổi:
              </label>
              <input
                type="number"
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Nhập số buổi học"
                min="1"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {loading ? "Đang xử lý..." : "Tạo lớp học"}
          </button>
        </form>
        {error && <div className="mt-2 text-red-500">{error}</div>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Danh sách lớp học</h3>
        {loading ? (
          <div className="text-center text-gray-500">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left">Tên lớp</th>
                  <th className="py-2 px-4 text-left">Mô tả</th>
                  <th className="py-2 px-4 text-left">Ngày bắt đầu</th>
                  <th className="py-2 px-4 text-left">Số buổi</th>
                  <th className="py-2 px-4 text-left">Số SV</th>
                  <th className="py-2 px-4 text-left">Giáo viên</th>
                  <th className="py-2 px-4 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {classes.length > 0 ? (
                  classes.map((cls) => (
                    <tr key={cls._id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{cls.name}</td>
                      <td className="py-2 px-4">{cls.description || "-"}</td>
                      <td className="py-2 px-4">
                        {new Date(cls.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-4">{cls.totalSessions}</td>
                      <td className="py-2 px-4">{cls.studentCount}</td>
                      <td className="py-2 px-4">
                        {teachers[cls.teacher]?.name || (
                          <span className="text-gray-400">Đang tải...</span>
                        )}
                        {currentUser._id === cls.teacher && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Của bạn
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewSchedule(cls._id)}
                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                          >
                            Quản lý lớp
                          </button>

                          <button
                            onClick={() => handleExportExcel(cls._id, cls.name)}
                            disabled={exportLoading === cls._id}
                            className={`px-3 py-1 rounded ${
                              exportLoading === cls._id
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-600 text-white"
                            }`}
                          >
                            {exportLoading === cls._id
                              ? "Đang xuất..."
                              : "Xuất Excel"}
                          </button>

                          <button
                            onClick={() => handleDeleteClass(cls._id)}
                            disabled={
                              deletingClass === cls._id ||
                              cls.students.length > 0
                            }
                            className={`px-3 py-1 rounded ${
                              deletingClass === cls._id ||
                              cls.students.length > 0
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                          >
                            {deletingClass === cls._id ? "Đang xóa..." : "Xóa"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-4 text-center text-gray-500">
                      Chưa có lớp học nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center">
              <h2 className="text-xl font-bold">
                {selectedClass.name} - Lịch học và điểm danh
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedClass(null);
                  setSelectedSession(null);
                  setSessionAttendance(null);
                }}
                className="bg-gray-200 rounded-full p-2 hover:bg-gray-300 focus:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              <button
                onClick={() => {
                  setShowStudents(false);
                  setSelectedSession(null);
                }}
                className={`px-4 py-2 rounded ${
                  !showStudents && !selectedSession
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                Lịch học
              </button>

              {schedule.map((session) => (
                <button
                  key={session.sessionNumber}
                  onClick={() => viewSessionAttendance(session.sessionNumber)}
                  className={`px-4 py-2 rounded text-sm ${
                    selectedSession === session.sessionNumber
                      ? "bg-blue-500 text-white"
                      : session.status === "completed"
                      ? "bg-green-100 hover:bg-green-200"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  Buổi {session.sessionNumber}
                  {session.status === "completed" ? " (✓)" : ""}
                </button>
              ))}
            </div>

            {selectedSession && sessionAttendance && (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Điểm danh buổi {selectedSession} -{" "}
                  {new Date(sessionAttendance.date).toLocaleDateString()}
                </h3>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Họ tên
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          MSSV
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sessionAttendance.students.map((record) => {
                        let studentName = "N/A";
                        let studentId = "N/A";

                        if (
                          record.student &&
                          typeof record.student === "object"
                        ) {
                          studentName = record.student.name;
                          studentId = record.student.studentId;
                        } else {
                          const student = students.find(
                            (s) => s._id === record.student
                          );
                          if (student) {
                            studentName = student.name;
                            studentId = student.studentId;
                          }
                        }

                        return (
                          <tr key={record.student}>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                              {studentName}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                              {studentId}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  record.status === "present"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {record.status === "present"
                                  ? "Có mặt"
                                  : "Vắng"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!selectedSession && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Lịch học</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {schedule.map((session) => (
                    <div
                      key={session.sessionNumber}
                      className={`p-2 rounded-md border text-sm ${
                        session.status === "completed"
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="font-medium">
                        Buổi {session.sessionNumber}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(session.date).toLocaleDateString()}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs ${
                            session.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {session.status === "completed"
                            ? "Đã điểm danh"
                            : "Chưa điểm danh"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats && !showStudents && !selectedSession && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">
                  Thống kê điểm danh
                </h3>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Họ tên
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          MSSV
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Số buổi vắng
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Điểm trừ
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.stats.map((stat) => (
                        <tr key={stat._id}>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                            {stat.name}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {stat.studentId}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {stat.totalAbsences}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                            {stat.totalScore}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                stat.isBanned
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {stat.isBanned ? "Cấm thi" : "Đủ điều kiện"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassList;
