import React, { useState, useEffect, useRef } from "react";
import axios from "../config/axios";
import * as faceapi from "face-api.js";

const StudentList = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    fetchClasses();
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (students.length > 0 && modelsLoaded) {
      renderFaceImages();
    }
  }, [students, modelsLoaded]);

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      console.log("Face API models loaded successfully");
      setModelsLoaded(true);
    } catch (error) {
      console.error("Error loading face API models:", error);
      setError("Không thể tải các mô hình nhận diện khuôn mặt");
    }
  };

  const renderFaceImages = () => {
    console.log("Rendering face images for", students.length, "students");
    students.forEach((student) => {
      if (student.faceFeatures && student.faceFeatures.length === 128) {
        try {
          const canvas = document.getElementById(`canvas-${student._id}`);
          if (!canvas) {
            console.error(`Canvas not found for student ${student._id}`);
            return;
          }

          // Chuyển đổi mảng 128 số thành tensor 1D
          const descriptor = new Float32Array(student.faceFeatures);

          // Tạo màu ngẫu nhiên để hiển thị
          const hue = Math.floor(Math.random() * 360);
          const ctx = canvas.getContext("2d");

          // Vẽ gradient background
          const gradient = ctx.createLinearGradient(
            0,
            0,
            canvas.width,
            canvas.height
          );
          gradient.addColorStop(0, `hsl(${hue}, 100%, 85%)`);
          gradient.addColorStop(1, `hsl(${hue}, 100%, 65%)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Vẽ điểm đặc trưng như mẫu
          ctx.fillStyle = `hsl(${hue}, 100%, 45%)`;
          const size = 2;

          // Chỉ vẽ một mẫu của các điểm để tạo hình ảnh tượng trưng
          for (let i = 0; i < 64; i++) {
            const x = 10 + (i % 8) * 8;
            const y = 10 + Math.floor(i / 8) * 8;
            const intensity = Math.abs(descriptor[i * 2]) * 10;

            ctx.beginPath();
            ctx.arc(x, y, size + intensity, 0, 2 * Math.PI);
            ctx.fill();
          }

          // Vẽ viền
          ctx.strokeStyle = `hsl(${hue}, 100%, 35%)`;
          ctx.lineWidth = 2;
          ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

          console.log(`Rendered face image for student ${student.name}`);
        } catch (error) {
          console.error(
            `Error rendering face for student ${student._id}:`,
            error
          );
        }
      } else {
        console.log(`Student ${student._id} has no valid face features`);
      }
    });
  };

  const fetchClasses = async () => {
    try {
      // Sử dụng API mới để lấy danh sách lớp
      const response = await axios.get("/api/teacher/classes");
      console.log("Fetched classes:", response.data);
      setClasses(response.data);
    } catch (error) {
      // Thử với API cũ nếu API mới thất bại
      try {
        const fallbackResponse = await axios.get("/api/classes");
        console.log("Fetched classes (fallback):", fallbackResponse.data);
        setClasses(fallbackResponse.data);
      } catch (fallbackError) {
        console.error("Error fetching classes:", error, fallbackError);
        setError("Không thể tải danh sách lớp học");
      }
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);

      if (!selectedClass) {
        setStudents([]);
        return;
      }

      // Sử dụng API mới để lấy danh sách sinh viên trong lớp học
      const response = await axios.get(
        `/api/teacher/classes/${selectedClass}/students`
      );

      if (response.data && Array.isArray(response.data)) {
        setStudents(response.data);
      } else {
        setStudents([]);
        console.error("Expected array but got:", response.data);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      setError("Không thể tải danh sách sinh viên");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedClassName = () => {
    const selectedClassObj = classes.find((cls) => cls._id === selectedClass);
    return selectedClassObj ? selectedClassObj.name : "";
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Danh sách sinh viên</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn lớp
        </label>
        <select
          value={selectedClass}
          onChange={(e) => {
            console.log("Selected class:", e.target.value);
            setSelectedClass(e.target.value);
          }}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Chọn lớp</option>
          {classes.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name} ({cls.students ? cls.students.length : 0} sinh viên)
            </option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <h3 className="text-xl font-semibold mb-4">
          Danh sách sinh viên lớp: {getSelectedClassName()}
        </h3>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-4">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <div
              key={student._id}
              className="bg-white rounded-lg shadow-md p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
                  {student.faceImage ? (
                    <img
                      src={student.faceImage}
                      alt={`Ảnh của ${student.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : student.faceFeatures &&
                    student.faceFeatures.length === 128 ? (
                    <canvas
                      id={`canvas-${student._id}`}
                      width="80"
                      height="80"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Chưa có ảnh
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{student.name}</h3>
                  <p className="text-gray-600">MSSV: {student.studentId}</p>
                  <p className="text-gray-600">
                    Ngày đăng ký:{" "}
                    {new Date(student.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && selectedClass && students.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          Không có sinh viên nào trong lớp này
        </div>
      )}
    </div>
  );
};

export default StudentList;
