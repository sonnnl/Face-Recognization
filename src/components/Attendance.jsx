import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import axios from "../config/axios";

const Attendance = () => {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [videoStream, setVideoStream] = useState(null);
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const initVideo = async () => {
      try {
        console.log("Loading face-api models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);

        if (mounted) {
          setIsModelLoaded(true);
          console.log("Models loaded successfully");
          await startVideo();
        }
      } catch (error) {
        console.error("Error loading models:", error);
        if (mounted) {
          setError("Không thể tải các mô hình nhận diện khuôn mặt");
        }
      }
    };

    initVideo();
    fetchClasses();

    return () => {
      mounted = false;
      if (videoStream) {
        videoStream.getTracks().forEach((track) => {
          track.stop();
          console.log("Camera track stopped:", track.kind);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
      fetchTodayAttendance(selectedClass);
    }
  }, [selectedClass]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/classes");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError("Không thể tải danh sách lớp học");
    }
  };

  const fetchStudents = async (classId) => {
    try {
      console.log("Fetching students for class:", classId);
      const response = await axios.get(`/api/students/class/${classId}`);
      console.log("Fetched students:", response.data);
      setStudents(response.data);
      // Initialize attendance status for all students
      const initialStatus = {};
      response.data.forEach((student) => {
        initialStatus[student._id] = false;
      });
      setAttendanceStatus(initialStatus);
    } catch (error) {
      console.error("Error fetching students:", error);
      setError("Không thể tải danh sách học sinh");
    }
  };

  const fetchTodayAttendance = async (classId) => {
    try {
      console.log("Fetching today's attendance for class:", classId);
      const response = await axios.get(`/api/attendance/${classId}`);
      console.log("Fetched attendance:", response.data);
      setTodayAttendance(response.data);

      // Update attendance status based on today's attendance
      const status = {};
      response.data.forEach((record) => {
        status[record.student._id] = true;
      });
      setAttendanceStatus((prev) => ({
        ...prev,
        ...status,
      }));
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setError("Không thể tải dữ liệu điểm danh");
    }
  };

  const startVideo = async () => {
    try {
      // Stop any existing streams first
      if (videoStream) {
        videoStream.getTracks().forEach((track) => {
          track.stop();
          console.log("Stopping existing track:", track.kind);
        });
        setVideoStream(null);
      }

      console.log("Starting video stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        console.log("Setting video source to stream");
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded, playing video");
          videoRef.current
            .play()
            .catch((e) => console.error("Error playing video:", e));
        };
        setVideoStream(stream);
        console.log("Camera started successfully");
      } else {
        console.error("Video element reference is null");
        setError("Không thể tìm thấy phần tử video");
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      if (error.name === "NotAllowedError") {
        setError("Vui lòng cho phép truy cập camera để sử dụng tính năng này");
      } else if (error.name === "NotFoundError") {
        setError("Không tìm thấy camera. Vui lòng kiểm tra thiết bị của bạn");
      } else if (error.name === "NotReadableError") {
        setError(
          "Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các ứng dụng khác đang sử dụng camera và thử lại."
        );
      } else {
        setError("Không thể truy cập camera. Vui lòng thử lại");
      }
    }
  };

  const handleCapture = async () => {
    if (!selectedClass) {
      setError("Vui lòng chọn lớp học");
      return;
    }

    if (!videoRef.current || !videoRef.current.srcObject) {
      setError(
        "Camera chưa được khởi tạo. Vui lòng tải lại trang và cho phép truy cập camera."
      );
      return;
    }

    setIsCapturing(true);
    setError("");

    try {
      console.log("Capturing face, video element:", videoRef.current);

      // Make sure the video is ready
      if (videoRef.current.paused || videoRef.current.videoWidth === 0) {
        console.log("Video is paused or has no dimensions, trying to play");
        await videoRef.current.play();
      }

      const detections = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setError(
          "Không phát hiện khuôn mặt. Vui lòng đảm bảo khuôn mặt của bạn hiển thị rõ ràng trong khung hình."
        );
        setIsCapturing(false);
        return;
      }

      console.log("Face detected:", detections);
      const faceFeatures = Array.from(detections.descriptor);

      // Compare with each student's face features
      let matched = false;

      for (const student of students) {
        if (!student.faceFeatures || student.faceFeatures.length !== 128) {
          console.log(
            `Student ${student.name} has invalid face features, skipping`
          );
          continue;
        }

        const distance = faceapi.euclideanDistance(
          faceFeatures,
          student.faceFeatures
        );

        console.log(
          `Comparing with student ${student.name}, distance: ${distance}`
        );

        if (distance < 0.6) {
          // Threshold for face matching
          matched = true;
          try {
            // Save attendance record
            console.log(
              `Match found! Student: ${student.name}, distance: ${distance}`
            );
            await axios.post("/api/attendance", {
              studentId: student._id,
              classId: selectedClass,
            });

            setAttendanceStatus((prev) => ({
              ...prev,
              [student._id]: true,
            }));
            setSuccess(`Đã nhận diện và điểm danh: ${student.name}`);
            // Refresh today's attendance
            fetchTodayAttendance(selectedClass);
            setMatchedStudent(student);
            break;
          } catch (error) {
            if (error.response?.status === 400) {
              setError(error.response.data.message);
            } else {
              setError("Có lỗi xảy ra khi lưu điểm danh");
            }
          }
        }
      }

      if (!matched) {
        setError(
          "Không nhận diện được sinh viên nào. Vui lòng thử lại hoặc kiểm tra xem sinh viên đã đăng ký chưa."
        );
      }
    } catch (error) {
      console.error("Error during face recognition:", error);
      setError("Có lỗi xảy ra khi nhận diện khuôn mặt: " + error.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/api/attendance", {
        classId: selectedClass,
        studentId: matchedStudent?._id,
        confidence: matchedStudent?.confidence,
      });
      setSuccess("Điểm danh thành công!");
      setMatchedStudent(null);
      setSelectedClass("");
      fetchClasses();
    } catch (error) {
      console.error("Error marking attendance:", error);
      setError(error.response?.data?.message || "Lỗi khi điểm danh");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Điểm danh</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn lớp
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Chọn lớp học</option>
          {classes.length > 0 ? (
            classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name} ({cls.students ? cls.students.length : 0} sinh viên)
              </option>
            ))
          ) : (
            <option disabled>
              Không tìm thấy lớp nào. Vui lòng tạo lớp trước.
            </option>
          )}
        </select>
        {classes.length === 0 && (
          <p className="mt-2 text-sm text-red-600">
            Không tìm thấy lớp nào. Vui lòng{" "}
            <a href="/classes" className="text-blue-600 hover:underline">
              tạo lớp mới
            </a>{" "}
            trước khi sử dụng chức năng điểm danh.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="relative">
        <video
          ref={videoRef}
          width="640"
          height="480"
          autoPlay
          playsInline
          muted
          className="rounded-lg shadow-lg"
          onError={(e) => {
            console.error("Video element error:", e);
            setError(
              "Lỗi hiển thị video: " +
                (e.target.error?.message || "Không xác định")
            );
          }}
        />
      </div>

      <div className="mt-4">
        <button
          onClick={handleCapture}
          disabled={!isModelLoaded || !selectedClass || isCapturing}
          className={`px-4 py-2 rounded-md text-white ${
            isModelLoaded && selectedClass && !isCapturing
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isCapturing
            ? "Đang nhận diện..."
            : isModelLoaded
            ? "Nhận diện khuôn mặt"
            : "Đang tải mô hình..."}
        </button>
      </div>

      {selectedClass && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Danh sách sinh viên</h3>
          {students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student) => (
                <div
                  key={student._id}
                  className={`p-2 rounded ${
                    attendanceStatus[student._id]
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {student.name} - {student.studentId}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">
              Không có sinh viên nào trong lớp này. Vui lòng{" "}
              <a href="/register" className="text-blue-600 hover:underline">
                đăng ký sinh viên mới
              </a>
              .
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mt-4">
          Đang điểm danh...
        </div>
      )}
    </div>
  );
};

export default Attendance;
