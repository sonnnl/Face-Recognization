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
  const [loading, setLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    gender: "male",
    phone: "",
    studentId: "", // Mã sinh viên
    adminClass: "", // Lớp quản lý (thay cho mainClassId)
    faceImage: null,
    faceFeatures: null,
  });
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [step, setStep] = useState(1); // 1: Thông tin cơ bản, 2: Chụp ảnh khuôn mặt

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log("Face recognition models loaded");
      } catch (error) {
        console.error("Error loading models:", error);
        toast.error("Không thể tải mô hình nhận diện khuôn mặt");
      }
    };

    loadModels();

    // Load available classes for selection
    const fetchClasses = async () => {
      try {
        const response = await axios.get("/api/admin-classes");
        setClasses(response.data);
      } catch (error) {
        console.error("Error fetching classes:", error);
        toast.error("Không thể tải danh sách lớp");
      }
    };

    fetchClasses();

    return () => {
      // Cleanup video stream when component unmounts
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // Start camera when on step 2
  useEffect(() => {
    if (step === 2 && modelsLoaded) {
      startVideo();
    }
  }, [step, modelsLoaded]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Không thể truy cập camera. Vui lòng cấp quyền và thử lại.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNextStep = () => {
    // Validate first step
    if (
      !formData.name ||
      !formData.adminClass ||
      !formData.studentId ||
      !formData.phone
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setStep(2);
  };

  const captureImage = async () => {
    try {
      setCaptureLoading(true);

      if (!videoRef.current || !canvasRef.current) {
        toast.error("Không thể truy cập camera hoặc canvas");
        return;
      }

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
      !formData.adminClass ||
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

    setLoading(true);

    try {
      // Gửi thông tin sinh viên lên server
      const response = await axios.post("/api/students/register", formData);

      toast.success("Đăng ký thông tin sinh viên thành công");

      // Hiển thị thông báo chờ duyệt và thêm nút đăng xuất
      setStep(3); // Chuyển sang bước hoàn tất

      // Bỏ chức năng tự động đăng xuất
      // setTimeout(() => {
      //   localStorage.removeItem("token");
      //   localStorage.removeItem("account");
      //   delete axios.defaults.headers.common["Authorization"];
      //   navigate("/login");
      // }, 5000); // Đợi 5 giây rồi đăng xuất
    } catch (error) {
      console.error("Error registering student:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi đăng ký thông tin sinh viên"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (
      window.confirm(
        "Bạn có chắc muốn hủy quá trình đăng ký? Mọi dữ liệu sẽ bị xóa."
      )
    ) {
      console.log("Bắt đầu quá trình hủy đăng ký sinh viên");

      // Nếu đã có formData.studentId, có thể cần xóa dữ liệu từ DB
      if (formData.studentId && step > 1) {
        try {
          console.log(
            `Gửi yêu cầu xóa dữ liệu sinh viên: ${formData.studentId}`
          );
          await axios.delete(
            `/api/students/cancel-registration/${formData.studentId}`
          );
          console.log("Xóa dữ liệu sinh viên thành công");
        } catch (error) {
          console.error("Error canceling registration:", error);
          // Không hiển thị lỗi cho người dùng vì chúng ta vẫn sẽ chuyển họ đi
        }
      }

      // Dừng camera nếu đang mở
      if (stream) {
        console.log("Dừng stream camera");
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        setStream(null);
      }

      // Đăng xuất và chuyển hướng
      toast.success("Đã hủy đăng ký thành công");
      logout();
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
                    name="adminClass"
                    value={formData.adminClass}
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
                    onClick={handleCancel}
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
                        <div className="rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 aspect-video flex items-center justify-center">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
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
                        onClick={captureImage}
                        disabled={captureLoading || !modelsLoaded}
                        className="flex items-center justify-center bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-full"
                      >
                        {captureLoading ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <CameraIcon className="h-5 w-5 mr-2" />
                        )}
                        Chụp ảnh khuôn mặt
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
                    onClick={() => setStep(1)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 w-1/3"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 w-1/3"
                  >
                    Hủy đăng ký
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !capturedImage}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 w-1/3"
                  >
                    {loading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <div className="mb-6 text-green-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-24 w-24 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-4">Đăng ký thành công!</h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-left">
                  <p className="text-yellow-700 font-medium">
                    Tài khoản của bạn đang chờ phê duyệt
                  </p>
                  <p className="text-gray-600 mt-2">
                    Cảm ơn bạn đã đăng ký. Tài khoản của bạn đã được tạo và đang
                    chờ phê duyệt từ quản trị viên. Bạn sẽ nhận được thông báo
                    qua email khi tài khoản được kích hoạt.
                  </p>
                </div>
                <p className="text-gray-600 mb-6">
                  Vui lòng đợi giảng viên phê duyệt trước khi đăng nhập lại.
                </p>
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Về trang đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
