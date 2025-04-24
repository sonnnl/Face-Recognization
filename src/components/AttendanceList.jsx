import React, { useState, useEffect } from "react";
import axios from "axios";

const AttendanceList = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchAttendanceRecords();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/classes");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError("Không thể tải danh sách lớp học");
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/attendance/records/class/${selectedClass}?date=${selectedDate}`
      );
      setAttendanceRecords(response.data);
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      setError("Không thể tải dữ liệu điểm danh");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId) => {
    try {
      await axios.delete(`/api/attendance/records/${recordId}`);
      fetchAttendanceRecords(); // Refresh the list
    } catch (error) {
      console.error("Error deleting attendance record:", error);
      setError("Không thể xóa bản ghi điểm danh");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Danh sách Điểm danh</h2>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Chọn lớp:</label>
          <select
            className="w-full p-2 border rounded"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Chọn lớp học</option>
            {classes.map((classItem) => (
              <option key={classItem._id} value={classItem._id}>
                {classItem.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2">Chọn ngày:</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Sinh viên</th>
                <th className="px-4 py-2 border">Trạng thái</th>
                <th className="px-4 py-2 border">Thời gian</th>
                <th className="px-4 py-2 border">Phương thức</th>
                <th className="px-4 py-2 border">Tỉ lệ khớp</th>
                <th className="px-4 py-2 border">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record._id}>
                    <td className="px-4 py-2 border">
                      {record.student?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-2 border">
                      <span
                        className={`inline-block px-2 py-1 rounded ${
                          record.present
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {record.present ? "Có mặt" : "Vắng mặt"}
                      </span>
                    </td>
                    <td className="px-4 py-2 border">
                      {new Date(record.recordTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border">
                      {record.method === "face"
                        ? "Nhận diện khuôn mặt"
                        : record.method === "manual"
                        ? "Thủ công"
                        : "Tự động"}
                    </td>
                    <td className="px-4 py-2 border">
                      {record.matchPercentage
                        ? `${record.matchPercentage.toFixed(2)}%`
                        : "N/A"}
                    </td>
                    <td className="px-4 py-2 border">
                      <button
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={() => handleDelete(record._id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-2 border text-center">
                    Không có dữ liệu điểm danh
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
