import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as faceapi from "face-api.js";

const Attendance = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [recognizedStudent, setRecognizedStudent] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const videoRef = useRef();
  const streamRef = useRef();

  useEffect(() => {
    loadModels();
    fetchClasses();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
      fetchSchedule();
    }
  }, [selectedClass]);

  const loadModels = async () => {
    try {
      console.log("Bắt đầu tải mô hình face-api.js...");

      // Đường dẫn chính xác đến thư mục models
      const MODEL_URL = "/models";

      // Tải các mô hình face-api.js
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      console.log("Đã tải xong các mô hình face-api.js!");
      setModelsLoaded(true);
    } catch (error) {
      console.error("Lỗi khi tải mô hình face-api.js:", error);
      setError(
        "Không thể tải các mô hình nhận diện khuôn mặt: " + error.message
      );
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/classes");
      setClasses(response.data);
    } catch (error) {
      setError("Không thể tải danh sách lớp học");
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`/api/students/class/${selectedClass}`);
      setStudents(response.data);
    } catch (error) {
      setError("Không thể tải danh sách sinh viên");
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await axios.get(
        `/api/classes/${selectedClass}/schedule`
      );
      setSchedule(response.data);
    } catch (error) {
      setError("Không thể tải lịch học");
    }
  };

  const fetchAttendanceStats = async () => {
    if (!selectedClass) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `/api/classes/${selectedClass}/attendance-stats`
      );
      setAttendanceStats(response.data);
      console.log("Thống kê điểm danh:", response.data);
    } catch (error) {
      console.error("Lỗi khi tải thống kê điểm danh:", error);
      setError("Không thể tải thống kê điểm danh");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      console.log("Đang cố gắng truy cập camera...");

      // Kiểm tra xem trình duyệt có hỗ trợ getUserMedia không
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt của bạn không hỗ trợ truy cập camera");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      console.log("Đã truy cập camera thành công");

      if (!videoRef.current) {
        throw new Error("Không tìm thấy phần tử video");
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Đảm bảo video đã tải
      videoRef.current.onloadedmetadata = () => {
        console.log("Video đã sẵn sàng");
        videoRef.current.play().catch((err) => {
          console.error("Lỗi khi phát video:", err);
          setError("Không thể phát video: " + err.message);
        });
      };
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      setError("Không thể truy cập camera: " + error.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startAttendance = async () => {
    if (!selectedSession) {
      setError("Vui lòng chọn buổi học");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log(
        "Starting attendance for class:",
        selectedClass,
        "session:",
        selectedSession.sessionNumber
      );

      const response = await axios.post("/api/attendance/start", {
        classId: selectedClass,
        sessionNumber: selectedSession.sessionNumber,
      });

      console.log("Attendance started successfully:", response.data);
      setCurrentAttendance(response.data);
      await startCamera();
    } catch (error) {
      console.error("Error starting attendance:", error);

      if (error.response) {
        // Lỗi từ server
        setError(error.response.data.message || "Không thể bắt đầu điểm danh");
      } else if (error.request) {
        // Không nhận được phản hồi từ server
        setError(
          "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng."
        );
      } else {
        // Lỗi khi thiết lập request
        setError("Lỗi khi bắt đầu điểm danh: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const detectSingleFace = async () => {
    if (!videoRef.current || !modelsLoaded) return;

    try {
      setIsRecognizing(true);
      setError("");

      const detections = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setError("Không tìm thấy khuôn mặt");
        return;
      }

      // So sánh với dữ liệu khuôn mặt của sinh viên
      let bestMatch = null;
      let bestDistance = Infinity;

      for (const student of students) {
        if (student.faceFeatures && student.faceFeatures.length === 128) {
          const distance = faceapi.euclideanDistance(
            detections.descriptor,
            new Float32Array(student.faceFeatures)
          );

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = student;
          }
        }
      }

      if (bestMatch && bestDistance < 0.6) {
        setRecognizedStudent(bestMatch);
        // Cập nhật trạng thái điểm danh
        const response = await axios.put(
          `/api/attendance/${currentAttendance._id}/student/${bestMatch._id}`,
          {
            status: "present",
          }
        );

        console.log("Cập nhật điểm danh thành công:", response.data);

        // Cập nhật state currentAttendance với dữ liệu mới
        if (response.data && currentAttendance) {
          // Tạo bản sao của currentAttendance
          const updatedAttendance = { ...currentAttendance };

          // Cập nhật trạng thái của sinh viên được điểm danh
          updatedAttendance.students = updatedAttendance.students.map(
            (record) => {
              if (record.student === bestMatch._id) {
                return { ...record, status: "present" };
              }
              return record;
            }
          );

          // Cập nhật state
          setCurrentAttendance(updatedAttendance);
        }
      } else {
        setError("Không nhận diện được sinh viên");
      }
    } catch (error) {
      console.error("Error detecting face:", error);
      setError("Lỗi khi nhận diện khuôn mặt: " + (error.message || ""));
    } finally {
      setIsRecognizing(false);
    }
  };

  const completeAttendance = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `/api/attendance/${currentAttendance._id}/complete`
      );
      stopCamera();

      // Cập nhật thông tin attendance hiện tại với dữ liệu mới từ server
      setCurrentAttendance(response.data);

      // Cập nhật trạng thái của session tương ứng trong danh sách lịch học
      setSchedule((prevSchedule) =>
        prevSchedule.map((session) =>
          session.sessionNumber === selectedSession.sessionNumber
            ? { ...session, status: "completed" }
            : session
        )
      );

      // Cập nhật selectedSession để phản ánh trạng thái mới
      setSelectedSession((prev) =>
        prev ? { ...prev, status: "completed" } : null
      );

      setRecognizedStudent(null);

      // Hiển thị thông báo thành công
      setError("");
    } catch (error) {
      console.error("Lỗi khi kết thúc điểm danh:", error);
      setError("Không thể kết thúc điểm danh: " + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const toggleStatsView = () => {
    setShowStats(!showStats);
    if (!showStats && !attendanceStats) {
      fetchAttendanceStats();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Điểm danh</h2>

      {/* Chọn lớp và buổi học */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn lớp
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">-- Chọn lớp --</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {selectedClass && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn buổi học
              </label>
              <select
                value={selectedSession ? selectedSession.sessionNumber : ""}
                onChange={(e) => {
                  const session = schedule.find(
                    (s) => s.sessionNumber === parseInt(e.target.value)
                  );
                  setSelectedSession(session);
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">-- Chọn buổi học --</option>
                {schedule.map((session) => (
                  <option
                    key={session.sessionNumber}
                    value={session.sessionNumber}
                  >
                    Buổi {session.sessionNumber} -{" "}
                    {new Date(session.date).toLocaleDateString()}{" "}
                    {session.status === "completed" ? "(Đã điểm danh)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Camera và nhận diện */}
      {currentAttendance ? (
        <div className="mb-6">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="font-medium">
              Đang điểm danh: Buổi {selectedSession?.sessionNumber} -{" "}
              {new Date(selectedSession?.date).toLocaleDateString()}
              {selectedSession?.status === "completed" ? " (Đã điểm danh)" : ""}
            </p>
          </div>

          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
            />
            {!videoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <button
                  onClick={startCamera}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Kết nối camera
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={detectSingleFace}
              disabled={isRecognizing || !videoRef.current?.srcObject}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
            >
              {isRecognizing ? "Đang nhận diện..." : "Nhận diện khuôn mặt"}
            </button>
            <button
              onClick={completeAttendance}
              disabled={currentAttendance.status === "completed"}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-300"
            >
              {currentAttendance.status === "completed"
                ? "Đã kết thúc điểm danh"
                : "Kết thúc điểm danh"}
            </button>

            {currentAttendance.status === "completed" && (
              <button
                onClick={stopCamera}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Đóng camera
              </button>
            )}
          </div>

          {recognizedStudent && (
            <div className="mt-4 p-4 bg-green-100 rounded-lg">
              <p className="font-semibold">Đã nhận diện:</p>
              <p>Họ tên: {recognizedStudent.name}</p>
              <p>MSSV: {recognizedStudent.studentId}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <button
            onClick={startAttendance}
            disabled={loading || !selectedSession}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? "Đang xử lý..." : "Bắt đầu điểm danh"}
          </button>
        </div>
      )}

      {selectedClass && (
        <div className="mb-4">
          <button
            onClick={toggleStatsView}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
          >
            {showStats ? "Ẩn thống kê" : "Xem thống kê điểm danh"}
          </button>
        </div>
      )}

      {showStats && attendanceStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Thống kê điểm danh</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Họ tên
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MSSV
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Số buổi vắng
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Điểm trừ
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceStats.stats.map((stat) => (
                  <tr key={stat._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.studentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalAbsences}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalScore}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
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

      {/* Danh sách sinh viên và trạng thái điểm danh */}
      {currentAttendance && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">
            Danh sách sinh viên - Buổi {selectedSession?.sessionNumber}
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Họ tên
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MSSV
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentAttendance.students.map((record) => {
                  const student = students.find(
                    (s) => s._id === record.student
                  );
                  return (
                    <tr key={record.student}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student?.studentId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === "present"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {record.status === "present" ? "Có mặt" : "Vắng"}
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
    </div>
  );
};

export default Attendance;
