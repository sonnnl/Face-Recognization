import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import axios from "../config/axios";

const Register = () => {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState([]);
  const [faceFeatures, setFaceFeatures] = useState(null);
  const [faceImage, setFaceImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [loadingClass, setLoadingClass] = useState(null);

  const videoRef = useRef();
  const canvasRef = useRef();
  const displayCanvasRef = useRef();

  useEffect(() => {
    fetchClasses();
    loadModels();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => {
          console.log("Stopping track:", track.kind);
          track.stop();
        });
      }
    };
  }, []);

  useEffect(() => {
    if (faceLandmarks && displayCanvasRef.current && faceImage) {
      drawFaceWithLandmarks();
    }
  }, [faceLandmarks, faceImage]);

  const drawFaceWithLandmarks = () => {
    const canvas = displayCanvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (faceImage) {
      ctx.putImageData(faceImage, 0, 0);

      if (faceLandmarks) {
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;

        ctx.beginPath();
        faceLandmarks.positions.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();

        ctx.fillStyle = "#ff0000";
        faceLandmarks.positions.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    }
  };

  const loadModels = async () => {
    try {
      setError("");
      console.log("Loading face-api models from /models");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      console.log("Models loaded successfully");
      setIsModelLoaded(true);
      startVideo();
    } catch (error) {
      console.error("Error loading models:", error);
      setError("Không thể tải các mô hình nhận diện khuôn mặt");
    }
  };

  const startVideo = async () => {
    try {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => {
          console.log("Stopping track:", track.kind);
          track.stop();
        });
        setVideoStream(null);
      }

      console.log("Starting video stream with constraints...");

      try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        console.log("Camera stream obtained successfully", stream);
        setVideoStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded, playing video");
            videoRef.current
              .play()
              .catch((e) => console.error("Error playing video:", e));
          };
          console.log("Video element source set successfully");
        } else {
          console.error("Video element reference is null");
          setError("Lỗi: Phần tử video không tồn tại");
        }
      } catch (constraintError) {
        console.warn(
          "Failed with specific constraints, trying generic ones",
          constraintError
        );

        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        console.log("Camera fallback stream obtained", fallbackStream);
        setVideoStream(fallbackStream);

        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Fallback video metadata loaded, playing video");
            videoRef.current
              .play()
              .catch((e) => console.error("Error playing fallback video:", e));
          };
          console.log("Video element source set with fallback stream");
        } else {
          console.error("Video element reference is null (fallback)");
          setError("Lỗi: Phần tử video không tồn tại");
        }
      }
    } catch (error) {
      console.error("Error starting video:", error);
      if (error.name === "NotAllowedError") {
        setError(
          "Không có quyền truy cập webcam. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt."
        );
      } else if (error.name === "NotFoundError") {
        setError(
          "Không tìm thấy thiết bị camera. Vui lòng kiểm tra kết nối camera."
        );
      } else if (error.name === "NotReadableError") {
        setError(
          "Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các ứng dụng khác đang sử dụng camera."
        );
      } else if (error.name === "OverconstrainedError") {
        setError(
          "Camera không hỗ trợ các yêu cầu được chỉ định. Vui lòng thử lại với các thiết lập khác."
        );
      } else if (error.name === "AbortError") {
        setError("Yêu cầu camera bị hủy bởi người dùng hoặc hệ thống.");
      } else {
        setError(
          `Lỗi khi khởi tạo camera: ${error.message}. Vui lòng làm mới trang và thử lại.`
        );
      }
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/classes");
      console.log("Fetched classes:", response.data);
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError("Không thể tải danh sách lớp học");
    }
  };

  const handleCapture = async () => {
    if (!isModelLoaded || !videoRef.current || !videoRef.current.srcObject) {
      setError("Webcam hoặc mô hình chưa được khởi tạo");
      return;
    }

    if (!name || !studentId || !classId) {
      setError("Vui lòng điền đầy đủ thông tin và chọn lớp học");
      return;
    }

    try {
      setIsCapturing(true);
      setError("");
      setFaceImage(null);
      setFaceLandmarks(null);

      console.log("Capturing face...");

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      setFaceImage(imageData);

      const detections = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setError(
          "Không tìm thấy khuôn mặt trong khung hình. Vui lòng thử lại."
        );
        setFaceImage(null);
        setIsCapturing(false);
        return;
      }

      console.log("Face detected:", detections);

      setFaceLandmarks(detections.landmarks);

      const descriptor = detections.descriptor;
      const descriptorArray = Array.from(descriptor);

      if (!descriptorArray || descriptorArray.length !== 128) {
        console.error("Invalid face descriptor:", descriptorArray);
        setError("Lỗi: Dữ liệu khuôn mặt không hợp lệ. Vui lòng thử lại.");
        setFaceImage(null);
        setFaceLandmarks(null);
        setIsCapturing(false);
        return;
      }

      console.log("Face descriptor length:", descriptorArray.length);
      console.log("First 5 values:", descriptorArray.slice(0, 5));

      setFaceFeatures(descriptorArray);
      console.log("Face features extracted successfully");
      setSuccess("Đã chụp khuôn mặt thành công! Bấm Đăng ký để hoàn tất.");
    } catch (error) {
      console.error("Error capturing face:", error);
      setError("Lỗi khi chụp khuôn mặt: " + error.message);
      setFaceImage(null);
      setFaceLandmarks(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!name || !studentId || !classId) {
      setError("Vui lòng điền đầy đủ thông tin và chọn lớp học");
      setLoading(false);
      return;
    }

    if (!faceFeatures || faceFeatures.length !== 128) {
      setError("Dữ liệu khuôn mặt không hợp lệ. Vui lòng chụp lại khuôn mặt.");
      setLoading(false);
      return;
    }

    try {
      console.log("Submitting registration with data:", {
        name,
        studentId,
        classId,
        faceFeatures: `Array with ${faceFeatures.length} elements`,
      });

      let faceImageBase64 = null;
      if (displayCanvasRef.current) {
        faceImageBase64 = displayCanvasRef.current.toDataURL("image/jpeg");
      }

      const response = await axios.post("/api/students", {
        name,
        studentId,
        classId,
        faceFeatures,
        faceImage: faceImageBase64,
      });

      console.log("Registration response:", response.data);
      setSuccess("Đăng ký thành công!");

      setName("");
      setStudentId("");
      setClassId("");
      setFaceFeatures(null);
      setFaceImage(null);
      setFaceLandmarks(null);

      fetchClasses();
    } catch (error) {
      console.error("Error registering student:", error);
      if (error.response) {
        console.error("Server response:", error.response.data);
        setError(error.response.data.message || "Lỗi khi đăng ký sinh viên");
      } else if (error.request) {
        setError(
          "Không thể kết nối với server. Vui lòng kiểm tra kết nối mạng."
        );
      } else {
        setError("Lỗi khi đăng ký sinh viên: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const retryCamera = () => {
    setError("");
    console.log("Retrying camera initialization...");
    startVideo();
  };

  const handleRetake = () => {
    setFaceImage(null);
    setFaceLandmarks(null);
    setFaceFeatures(null);
    setSuccess("");
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Đăng ký khuôn mặt mới</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MSSV
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lớp học
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Chọn lớp học</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name} ({cls.students ? cls.students.length : 0} sinh
                    viên)
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 space-x-2">
              <button
                type="button"
                onClick={handleCapture}
                disabled={
                  isCapturing ||
                  loading ||
                  !isModelLoaded ||
                  !videoRef.current ||
                  !videoRef.current.srcObject
                }
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isCapturing ? "Đang chụp..." : "Chụp khuôn mặt"}
              </button>

              {faceImage && (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                >
                  Chụp lại
                </button>
              )}

              <button
                type="submit"
                disabled={
                  loading || !faceFeatures || !name || !studentId || !classId
                }
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Đang đăng ký..." : "Đăng ký"}
              </button>
            </div>
          </form>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mt-4">
              {error}{" "}
              {error.includes("camera") && (
                <button
                  onClick={retryCamera}
                  className="underline text-blue-600 ml-2"
                >
                  Thử lại
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="bg-green-100 text-green-700 p-3 rounded mt-4">
              {success}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-gray-100 rounded-lg overflow-hidden shadow-md">
            <div
              className="relative aspect-w-4 aspect-h-3"
              style={{ minHeight: "360px" }}
            >
              {isModelLoaded ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {!videoStream && !faceImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white p-4 z-10">
                        <p className="text-center mb-4">
                          Camera chưa được khởi tạo hoặc trình duyệt chưa cấp
                          quyền
                        </p>
                        <button
                          onClick={retryCamera}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                          Kết nối camera
                        </button>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ display: faceImage ? "none" : "block" }}
                      onError={(e) => {
                        console.error("Video element error:", e);
                        setError(
                          "Lỗi hiển thị video: " + e.target.error?.message ||
                            "Không xác định"
                        );
                      }}
                    />

                    <canvas
                      ref={canvasRef}
                      width="640"
                      height="480"
                      className="absolute inset-0 w-full h-full object-cover hidden"
                    />

                    <canvas
                      ref={displayCanvasRef}
                      width="640"
                      height="480"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ display: faceImage ? "block" : "none" }}
                    />

                    {faceImage ? (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-center">
                        Đã chụp khuôn mặt. Bấm "Chụp lại" nếu muốn thử lại.
                      </div>
                    ) : (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-center">
                        {videoStream
                          ? "Đưa khuôn mặt vào giữa khung hình và bấm 'Chụp khuôn mặt'"
                          : "Vui lòng cấp quyền truy cập camera"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-2"></div>
                    <p>Đang tải mô hình nhận diện...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Hướng dẫn:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Điền đầy đủ thông tin cá nhân</li>
              <li>Chọn lớp học</li>
              <li>
                Nhìn thẳng vào camera, đảm bảo khuôn mặt nằm trong khung hình
              </li>
              <li>Bấm nút "Chụp khuôn mặt"</li>
              <li>
                Khi khuôn mặt được nhận diện thành công (hiển thị các đường
                viền), bấm nút "Đăng ký"
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
