import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "../config/axios";
import moment from "moment";

const AttendanceHistory = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [formError, setFormError] = useState("");

  // Fetch classes on component mount
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/classes");
      setClasses(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError("Không thể tải danh sách lớp");
      setLoading(false);
      toast.error("Lỗi khi tải danh sách lớp");
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      // Validate inputs
      if (!selectedClass) {
        setFormError("Vui lòng chọn lớp");
        return;
      }

      if (!dateRange.startDate || !dateRange.endDate) {
        setFormError("Vui lòng chọn khoảng thời gian");
        return;
      }

      setFormError("");
      setLoading(true);

      let url = `/api/attendance/class/${selectedClass}`;

      // Add date range params if they exist
      if (dateRange.startDate && dateRange.endDate) {
        url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }

      const response = await axios.get(url);
      console.log("Attendance records:", response.data);

      // Group attendance by date and session
      const groupedAttendance = response.data.reduce((acc, record) => {
        // Use date and session number as key
        const date = moment(record.date).format("YYYY-MM-DD");
        const key = `${date}-${record.sessionNumber}`;

        if (!acc[key]) {
          acc[key] = {
            date: date,
            sessionNumber: record.sessionNumber,
            students: [],
          };
        }

        // Add students to the session
        if (record.students && Array.isArray(record.students)) {
          acc[key].students = record.students.map((s) => ({
            studentId: s.student?.studentId || "N/A",
            name: s.student?.name || "N/A",
            status: s.status,
            timestamp: s.timestamp || record.date,
          }));
        }

        return acc;
      }, {});

      setAttendanceHistory(Object.values(groupedAttendance));

      if (Object.values(groupedAttendance).length === 0) {
        toast.info(
          "Không tìm thấy dữ liệu điểm danh trong khoảng thời gian đã chọn"
        );
      } else {
        toast.success(
          `Đã tìm thấy ${
            Object.values(groupedAttendance).length
          } bản ghi điểm danh`
        );
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      setError("Không thể tải lịch sử điểm danh");
      setLoading(false);
      toast.error("Lỗi khi tải lịch sử điểm danh");
    }
  };

  const handleClassChange = (e) => {
    setSelectedClass(e.target.value);
    if (e.target.value) {
      toast.info("Vui lòng chọn khoảng thời gian và nhấn 'Trích xuất dữ liệu'");
    }
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="container mx-auto mt-4 px-4">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
          <h3 className="text-xl font-semibold mb-0">Lịch sử điểm danh</h3>
        </div>
        <div className="p-4">
          <div className="mb-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Chọn lớp:</label>
              <select
                value={selectedClass}
                onChange={handleClassChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn lớp --</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              {selectedClass && (
                <p className="text-sm text-gray-600 mt-1">
                  Chọn khoảng thời gian và nhấn "Trích xuất dữ liệu"
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Từ ngày:</label>
              <input
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateRangeChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Đến ngày:</label>
              <input
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateRangeChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {formError}
            </div>
          )}

          <div className="mb-4">
            <button
              onClick={fetchAttendanceHistory}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Đang tải..." : "Trích xuất dữ liệu"}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <span className="sr-only">Đang tải...</span>
            </div>
          ) : (
            <>
              {attendanceHistory.length > 0 ? (
                attendanceHistory.map((session) => (
                  <div
                    key={`${session.date}-${session.sessionNumber}`}
                    className="mb-4"
                  >
                    <h4 className="text-lg font-semibold mb-3">
                      Điểm danh ngày:{" "}
                      {moment(session.date).format("DD/MM/YYYY")} - Buổi{" "}
                      {session.sessionNumber}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-4 py-2 text-left border-b">
                              Mã SV
                            </th>
                            <th className="px-4 py-2 text-left border-b">
                              Họ tên
                            </th>
                            <th className="px-4 py-2 text-left border-b">
                              Thời gian điểm danh
                            </th>
                            <th className="px-4 py-2 text-left border-b">
                              Trạng thái
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.students.map((student) => (
                            <tr
                              key={student.studentId}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-2 border-b">
                                {student.studentId}
                              </td>
                              <td className="px-4 py-2 border-b">
                                {student.name}
                              </td>
                              <td className="px-4 py-2 border-b">
                                {student.timestamp
                                  ? moment(student.timestamp).format(
                                      "DD/MM/YYYY HH:mm:ss"
                                    )
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-2 border-b">
                                <span
                                  className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                                    student.status === "present"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {student.status === "present"
                                    ? "Có mặt"
                                    : "Vắng mặt"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : selectedClass ? (
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                  Không có dữ liệu điểm danh cho lớp này trong khoảng thời gian
                  đã chọn
                </div>
              ) : (
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                  Vui lòng chọn lớp và khoảng thời gian, sau đó nhấn "Trích xuất
                  dữ liệu"
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistory;
