import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../config/axios";
import { useAuth } from "../contexts/AuthContext";
import * as faceapi from "face-api.js";
import {
  UserIcon,
  CameraIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  PhoneIcon,
  PhotoIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

const StudentRegister = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionCanvasRef = useRef(null); // Canvas cho real-time detection
  const [loading, setLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    gender: "male",
    phone: "",
    studentId: "", // Mã sinh viên
    mainClassId: "", // Đổi từ adminClass sang mainClassId
    faceImage: null,
    faceFeatures: null,
  });
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [step, setStep] = useState(1); // 1: Thông tin cơ bản, 2: Chụp ảnh khuôn mặt, 3: Hoàn thành
  const [detectionInterval, setDetectionInterval] = useState(null); // Lưu interval ID

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log("Face recognition models loaded");
      } catch (error) {
        console.error("Error loading models:", error);
        toast.error("Không thể tải mô hình nhận diện khuôn mặt");
      }
    };

    loadModels();
    return () => {
      // Dọn dẹp tài nguyên khi component unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };
  }, []);

  // Fetch classes when component mounts
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/admin-classes");
      console.log("Fetched classes:", response.data);
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Không thể tải danh sách lớp");
    }
  };

  const startVideo = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      };

      const videoStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        setStream(videoStream);

        // Setup real-time face detection once video is ready
        videoRef.current.onloadedmetadata = () => {
          if (modelsLoaded) {
            startFaceDetection();
          }
        };
      }
    } catch (error) {
      console.error("Error starting video:", error);
      toast.error("Không thể truy cập camera");
    }
  };

  // Thêm hàm mới để thực hiện face detection theo thời gian thực
  const startFaceDetection = () => {
    if (detectionInterval) {
      clearInterval(detectionInterval);
    }

    const canvas = faceDetectionCanvasRef.current;
    const context = canvas.getContext("2d");

    // Cập nhật kích thước canvas cho phù hợp với video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Thiết lập interval để chạy face detection mỗi 100ms
    const intervalId = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        // Xóa canvas trước mỗi lần vẽ mới
        context.clearRect(0, 0, canvas.width, canvas.height);

        try {
          // Detect faces with landmarks
          const detections = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks();

          if (detections) {
            // Vẽ khuôn mặt và landmarks lên canvas
            context.drawImage(
              videoRef.current,
              0,
              0,
              canvas.width,
              canvas.height
            );

            // Vẽ khung khuôn mặt
            const box = detections.detection.box;
            context.strokeStyle = "#00ff00"; // Màu xanh lá
            context.lineWidth = 2;
            context.strokeRect(box.x, box.y, box.width, box.height);

            // Vẽ landmarks
            const landmarks = detections.landmarks;
            const positions = landmarks.positions;

            // Vẽ các điểm landmarks
            context.fillStyle = "#ff0000"; // Màu đỏ
            positions.forEach((point) => {
              context.beginPath();
              context.arc(point.x, point.y, 2, 0, 2 * Math.PI);
              context.fill();
            });

            // Vẽ đường viền mắt
            context.strokeStyle = "#0000ff"; // Màu xanh dương
            context.beginPath();

            // Mắt trái (từ góc nhìn người xem)
            const leftEye = landmarks.getLeftEye();
            leftEye.forEach((point, i) => {
              if (i === 0) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            });
            context.closePath();
            context.stroke();

            // Mắt phải
            context.beginPath();
            const rightEye = landmarks.getRightEye();
            rightEye.forEach((point, i) => {
              if (i === 0) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            });
            context.closePath();
            context.stroke();

            // Vẽ đường viền miệng
            context.strokeStyle = "#ff00ff"; // Màu hồng
            context.beginPath();
            const mouth = landmarks.getMouth();
            mouth.forEach((point, i) => {
              if (i === 0) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            });
            context.closePath();
            context.stroke();

            // Vẽ đường viền mũi
            context.strokeStyle = "#ffff00"; // Màu vàng
            context.beginPath();
            const nose = landmarks.getNose();
            nose.forEach((point, i) => {
              if (i === 0) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            });
            context.stroke();
          }
        } catch (error) {
          console.error("Error in face detection:", error);
        }
      }
    }, 100); // Chạy mỗi 100ms

    setDetectionInterval(intervalId);
  };

  useEffect(() => {
    if (step === 2 && modelsLoaded && !capturedImage) {
      startVideo();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };
  }, [step, modelsLoaded, capturedImage]);

  const handleNextStep = () => {
    if (
      !formData.name ||
      !formData.studentId ||
      !formData.phone ||
      !formData.mainClassId // Đổi từ adminClass sang mainClassId
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }

    if (detectionInterval) {
      clearInterval(detectionInterval);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      toast.error("Camera chưa được khởi tạo");
      return;
    }

    try {
      setCaptureLoading(true);

      // Detect faces in current video frame
      const detections = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        toast.error("Không phát hiện khuôn mặt. Vui lòng thử lại.");
        setCaptureLoading(false);
        return;
      }

      // Draw face and get image
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Vẽ thêm landmarks lên hình ảnh đã chụp
      const landmarks = detections.landmarks;
      const positions = landmarks.positions;

      // Vẽ khung khuôn mặt
      const box = detections.detection.box;
      context.strokeStyle = "#00ff00"; // Màu xanh lá
      context.lineWidth = 2;
      context.strokeRect(box.x, box.y, box.width, box.height);

      // Vẽ các điểm landmarks
      context.fillStyle = "#ff0000"; // Màu đỏ
      positions.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        context.fill();
      });

      // Vẽ đường viền mắt
      context.strokeStyle = "#0000ff"; // Màu xanh dương
      context.beginPath();

      // Mắt trái (từ góc nhìn người xem)
      const leftEye = landmarks.getLeftEye();
      leftEye.forEach((point, i) => {
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();

      // Mắt phải
      context.beginPath();
      const rightEye = landmarks.getRightEye();
      rightEye.forEach((point, i) => {
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();

      // Vẽ đường viền miệng
      context.strokeStyle = "#ff00ff"; // Màu hồng
      context.beginPath();
      const mouth = landmarks.getMouth();
      mouth.forEach((point, i) => {
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();

      // Vẽ đường viền mũi
      context.strokeStyle = "#ffff00"; // Màu vàng
      context.beginPath();
      const nose = landmarks.getNose();
      nose.forEach((point, i) => {
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();

      // Extract face image data and features
      const faceImageData = canvas.toDataURL("image/jpeg");
      const faceFeatures = Array.from(detections.descriptor);

      // Update form data
      setFormData((prev) => ({
        ...prev,
        faceImage: faceImageData,
        faceFeatures: faceFeatures,
      }));

      setCapturedImage(faceImageData);
      toast.success("Đã chụp ảnh khuôn mặt thành công");

      // Stop camera after capturing
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        setStream(null);
      }

      // Dừng interval khi đã chụp xong
      if (detectionInterval) {
        clearInterval(detectionInterval);
        setDetectionInterval(null);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      toast.error("Lỗi khi chụp ảnh khuôn mặt");
    } finally {
      setCaptureLoading(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    startVideo();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (
      !formData.name ||
      !formData.mainClassId || // Đổi từ adminClass sang mainClassId
      !formData.studentId ||
      !formData.phone
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (!formData.faceImage || !formData.faceFeatures) {
      toast.error("Vui lòng chụp ảnh khuôn mặt");
      return;
    }

    // Submit data
    try {
      setLoading(true);
      console.log("Submitting student data:", {
        ...formData,
        faceImage: "IMAGE_DATA",
        faceFeatures: `${formData.faceFeatures.length} features`,
      });

      const response = await axios.post("/api/students/register", formData);
      console.log("Registration response:", response.data);

      toast.success("Đăng ký sinh viên thành công!");
      setStep(3);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(
        error.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Hàm hủy đăng ký sinh viên
  const handleCancel = async () => {
    if (
      window.confirm(
        "Bạn có chắc muốn hủy quá trình đăng ký? Tài khoản của bạn sẽ bị xóa và bạn có thể đăng nhập lại với vai trò khác."
      )
    ) {
      try {
        console.log("Bắt đầu quá trình hủy đăng ký sinh viên");
        setLoading(true);

        // Lấy token từ localStorage để đảm bảo xác thực
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("Không tìm thấy token xác thực");
          toast.error("Bạn cần đăng nhập lại để thực hiện thao tác này");
          logout();
          return;
        }

        try {
          // Gửi yêu cầu xóa tài khoản lên server với header xác thực rõ ràng
          await axios.delete("/api/students/cancel-registration", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          // Dừng video stream nếu đang chạy
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }

          // Dừng interval detection nếu đang chạy
          if (detectionInterval) {
            clearInterval(detectionInterval);
          }

          // Nếu thành công, hiển thị thông báo và đăng xuất
          toast.success("Đã hủy đăng ký thành công. Tài khoản đã được xóa.");
          logout();
        } catch (error) {
          // Nếu bị lỗi 404, chỉ cần thông báo và đăng xuất
          if (error.response && error.response.status === 404) {
            console.error("API endpoint không tồn tại:", error.response.data);
            toast.info(
              "Đã ghi nhận yêu cầu hủy đăng ký. Bạn sẽ được đăng xuất."
            );

            // Dừng video stream nếu đang chạy
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }

            // Dừng interval detection nếu đang chạy
            if (detectionInterval) {
              clearInterval(detectionInterval);
            }

            // Trong trường hợp này, không có API để xóa tài khoản, ta chỉ cho phép người dùng đăng xuất
            // và hệ thống sẽ xóa tài khoản sau bằng công cụ quản trị
            localStorage.removeItem("account");
            logout();
            return;
          }

          // Xử lý các lỗi khác
          throw error; // Ném lỗi để xử lý ở catch block bên ngoài
        }
      } catch (error) {
        console.error("Error canceling registration:", error);

        // Xử lý các loại lỗi cụ thể
        if (error.response) {
          // Lỗi từ phản hồi server
          console.error(
            "Server response error:",
            error.response.status,
            error.response.data
          );

          if (error.response.status === 404) {
            toast.error(
              "Không thể xóa tài khoản qua API. Hãy liên hệ quản trị viên."
            );
          } else if (error.response.status === 401) {
            toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
          } else {
            toast.error(
              error.response.data.message ||
                "Có lỗi xảy ra khi hủy đăng ký. Vui lòng thử lại."
            );
          }
        } else if (error.request) {
          // Yêu cầu đã được gửi nhưng không nhận được phản hồi
          console.error("No response from server:", error.request);
          toast.error(
            "Không nhận được phản hồi từ server. Vui lòng kiểm tra kết nối mạng."
          );
        } else {
          // Lỗi khi thiết lập yêu cầu
          toast.error("Có lỗi xảy ra khi hủy đăng ký. Vui lòng thử lại.");
        }

        // Dừng video stream nếu đang chạy
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        // Dừng interval detection nếu đang chạy
        if (detectionInterval) {
          clearInterval(detectionInterval);
        }

        // Vẫn đăng xuất trong trường hợp có lỗi để người dùng có thể đăng nhập lại
        logout();
      } finally {
        setLoading(false);
      }
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Bạn cần đăng nhập trước</h2>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      {/* Simple header to replace navbar */}
      <div className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-blue-600">
            Hệ thống điểm danh khuôn mặt
          </h1>
          <button
            onClick={handleCancel}
            className="text-red-500 hover:text-red-700 font-medium flex items-center"
          >
            <XCircleIcon className="h-5 w-5 mr-1" />
            Hủy đăng ký
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-4 px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-500 px-6 py-4">
            <h1 className="text-xl font-bold text-white">
              Đăng ký thông tin sinh viên
            </h1>
            <p className="text-blue-100">
              Vui lòng cung cấp thông tin chi tiết và đăng ký khuôn mặt
            </p>
          </div>

          <div className="p-6">
            {/* Navigation steps */}
            <div className="flex items-center mb-8">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                  step >= 1
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                1
              </div>
              <div className="text-sm font-medium mr-4">Thông tin cơ bản</div>

              <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>

              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                  step >= 2
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                2
              </div>
              <div className="text-sm font-medium">Đăng ký khuôn mặt</div>
            </div>

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      <UserIcon className="inline-block w-4 h-4 mr-1" />
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập họ và tên"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Lớp quản lý <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="mainClassId"
                      value={formData.mainClassId}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      required
                    >
                      <option value="">Chọn lớp quản lý</option>
                      {classes.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      <AcademicCapIcon className="inline-block w-4 h-4 mr-1" />
                      Mã sinh viên
                    </label>
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập mã sinh viên"
                      required
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
                          name="gender"
                          value="male"
                          checked={formData.gender === "male"}
                          onChange={handleChange}
                          className="form-radio text-blue-500"
                        />
                        <span className="ml-2">Nam</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="gender"
                          value="female"
                          checked={formData.gender === "female"}
                          onChange={handleChange}
                          className="form-radio text-blue-500"
                        />
                        <span className="ml-2">Nữ</span>
                      </label>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      <PhoneIcon className="inline-block w-4 h-4 mr-1" />
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập số điện thoại"
                      required
                    />
                  </div>

                  <div className="mt-6 flex space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                      }}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 w-1/2"
                    >
                      Hủy đăng ký
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-1/2"
                    >
                      Tiếp tục
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">
                      Đăng ký khuôn mặt
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Vui lòng nhìn thẳng vào camera để chụp ảnh khuôn mặt của
                      bạn.
                    </p>

                    <div className="relative mb-4">
                      {!capturedImage ? (
                        <>
                          <div className="relative rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 aspect-video flex items-center justify-center">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full h-full object-cover"
                            />
                            {/* Overlay canvas for real-time face detection */}
                            <canvas
                              ref={faceDetectionCanvasRef}
                              className="absolute top-0 left-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-2 left-0 right-0 text-center bg-black bg-opacity-50 text-white py-1 text-sm">
                              Đưa khuôn mặt vào giữa khung hình và giữ yên
                            </div>
                          </div>
                          <canvas ref={canvasRef} className="hidden"></canvas>
                        </>
                      ) : (
                        <div className="relative rounded-lg overflow-hidden border-2 border-green-500 aspect-video">
                          <img
                            src={capturedImage}
                            alt="Captured face"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <CheckCircleIcon className="h-8 w-8 text-green-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-4">
                      {!capturedImage ? (
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={captureLoading || !modelsLoaded || !stream}
                          className={`flex items-center justify-center bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-full ${
                            captureLoading || !modelsLoaded || !stream
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {captureLoading ? (
                            <>
                              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                              Đang chụp...
                            </>
                          ) : (
                            <>
                              <CameraIcon className="h-5 w-5 mr-2" />
                              Chụp ảnh
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={resetCapture}
                          className="flex items-center justify-center bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 w-1/2"
                        >
                          <ArrowPathIcon className="h-5 w-5 mr-2" />
                          Chụp lại
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-4">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 w-1/3"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                      }}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 w-1/3"
                    >
                      Hủy đăng ký
                    </button>
                    <button
                      type="submit"
                      disabled={!capturedImage || loading}
                      className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 w-1/3 ${
                        !capturedImage || loading
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {loading ? "Đang xử lý..." : "Đăng ký"}
                    </button>
                  </div>
                </div>
              )}

              {/* Thêm màn hình hiển thị thành công */}
              {step === 3 && (
                <div className="text-center py-8">
                  <div className="mb-6 text-green-500">
                    <CheckCircleIcon className="h-24 w-24 mx-auto" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">
                    Đăng ký thành công!
                  </h2>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-left">
                    <p className="text-yellow-700 font-medium">
                      Tài khoản của bạn đang chờ phê duyệt
                    </p>
                    <p className="text-gray-600 mt-2">
                      Cảm ơn bạn đã đăng ký. Tài khoản của bạn đã được tạo và
                      đang chờ phê duyệt từ quản trị viên. Bạn sẽ nhận được
                      thông báo khi tài khoản được kích hoạt.
                    </p>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Vui lòng đợi giảng viên phê duyệt trước khi đăng nhập lại.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Về trang đăng nhập
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
