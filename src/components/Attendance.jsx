import React, { useState, useEffect, useRef } from "react";
import axios from "../config/axios";
import * as faceapi from "face-api.js";
import moment from "moment";
import { toast } from "react-toastify";
import { FiCamera } from "react-icons/fi";

// Adicionar constantes de configuração para ajustar os parâmetros de detecção
const FACE_RECOGNITION_CONFIG = {
  // Confidence thresholds - controls accuracy of the recognition
  DETECTION_CONFIDENCE: 0.4, // For normal face detection
  MANUAL_MATCHING_THRESHOLD: 0.8, // For manual face matching (lower = stricter)
  AUTO_MATCHING_THRESHOLD: 0.65, // Giảm từ 0.85 xuống 0.65 để tăng độ chính xác

  // Visual configuration
  BOX_COLORS: {
    FACE: "#00C853", // Green - face detection box
    EYES: "#2979FF", // Blue - eye contours
    MOUTH: "#AA00FF", // Purple - mouth contour
    NOSE: "#FFAB00", // Yellow - nose contour
    INFO_BOX: "#27ae60", // Dark green - info box background
    INFO_TEXT: "#FFFFFF", // White - info text
  },

  // Confidence indicators for match quality
  CONFIDENCE_COLORS: {
    HIGH: "#00C853", // Green - high confidence (>80%)
    MEDIUM: "#FFAB00", // Yellow/Orange - medium confidence (60-80%)
    LOW: "#FF1744", // Red - low confidence (<60%)
  },

  // Processing settings
  AUTO_DETECTION_INTERVAL: 2000, // Tăng thành 1 giây giữa các lần quét
};

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
  const [modelLoadingStatus, setModelLoadingStatus] = useState(""); // Estado adicionado para rastrear o status de carregamento dos modelos
  const [recognizedStudent, setRecognizedStudent] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: moment().subtract(30, "days").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
  });
  const [attendanceDate, setAttendanceDate] = useState(
    moment().format("YYYY-MM-DD")
  ); // Data atual para o registro de presença
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true); // Estado para controlar se a detecção automática está ativada
  const [recognizedStudentIds, setRecognizedStudentIds] = useState([]); // Thêm state để lưu ID sinh viên đã nhận diện
  // Thêm state để theo dõi việc đang xử lý điểm danh
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);

  // Refs para elementos DOM e dados
  const videoRef = useRef();
  const streamRef = useRef();
  const intervalRef = useRef();
  const canvasRef = useRef();
  const detectInterval = useRef(null);

  // Variável para evitar processamento simultâneo - usando let em vez de const
  let isProcessing = false;

  // Variáveis para armazenar os descritores de faces dos estudantes
  const labeledStudentDescriptors = useRef([]);

  // Função para carregar os descritores de faces dos estudantes
  const loadStudentDescriptors = async () => {
    console.log("Loading student face descriptors...");
    if (!students || students.length === 0) {
      console.log(
        "No students data available yet. Skipping descriptor loading."
      );
      return;
    }

    try {
      // Filtrar estudantes que têm características faciais
      const studentsWithFaces = students.filter(
        (s) =>
          s.faceFeatures &&
          Array.isArray(s.faceFeatures) &&
          s.faceFeatures.length > 0
      );

      console.log(
        `Found ${studentsWithFaces.length} students with face features`
      );

      // Criar descritores rotulados para cada estudante
      const descriptors = await Promise.all(
        studentsWithFaces.map(async (student) => {
          try {
            // Converter as características faciais para Float32Array
            const faceFeatures = new Float32Array(
              typeof student.faceFeatures[0] === "string"
                ? student.faceFeatures.map((f) => parseFloat(f))
                : student.faceFeatures
            );

            // Criar um descritor rotulado
            return new faceapi.LabeledFaceDescriptors(
              `${student.studentId}-${student.name}`,
              [faceFeatures]
            );
          } catch (error) {
            console.error(
              `Error processing face features for ${student.name}:`,
              error
            );
            return null;
          }
        })
      );

      // Filtrar quaisquer descritores nulos que possam ter resultado de erros
      const validDescriptors = descriptors.filter((d) => d !== null);

      // Armazenar os descritores para uso posterior
      labeledStudentDescriptors.current = validDescriptors;

      console.log(
        `Successfully loaded ${validDescriptors.length} student descriptors`
      );
      return validDescriptors;
    } catch (error) {
      console.error("Error loading student descriptors:", error);
      return [];
    }
  };

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

  useEffect(() => {
    if (currentAttendance) {
      fetchAttendanceRecords();
    }
  }, [currentAttendance]);

  useEffect(() => {
    if (students.length > 0) {
      console.log("============ STUDENT DATA ANALYSIS ============");
      console.log(`Total students loaded: ${students.length}`);

      // Check how many students have face features
      const studentsWithFaces = students.filter(
        (s) =>
          s.faceFeatures &&
          Array.isArray(s.faceFeatures) &&
          s.faceFeatures.length > 0
      );

      console.log(
        `Students with face features: ${studentsWithFaces.length}/${students.length}`
      );

      if (studentsWithFaces.length === 0) {
        console.log(
          "WARNING: No students have face features! Face recognition will not work!"
        );
        // Show alert to user
        toast.warning(
          "Không có sinh viên nào có dữ liệu khuôn mặt. Chức năng nhận diện có thể không hoạt động.",
          {
            autoClose: 8000,
          }
        );
      }

      // Log a few sample students
      console.log("Sample student data:");
      students.slice(0, 3).forEach((student, index) => {
        console.log(`Student ${index + 1}:`, {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
          hasFaceFeatures: !!(
            student.faceFeatures && student.faceFeatures.length
          ),
          faceFeaturesSample: student.faceFeatures
            ? `${typeof student.faceFeatures} with ${
                student.faceFeatures.length
              } items`
            : "none",
        });
      });
      console.log("=============================================");
    }
  }, [students]);

  const fetchAttendanceRecords = async () => {
    try {
      if (!selectedClass || !selectedSession) {
        return;
      }

      setLoading(true);
      console.log(
        "Lấy bản ghi điểm danh cho lớp:",
        selectedClass,
        "buổi:",
        selectedSession.sessionNumber
      );

      // Sử dụng API mới
      try {
        const response = await axios.get(
          `/api/teacher/classes/${selectedClass}/attendance`,
          {
            params: { sessionNumber: selectedSession.sessionNumber },
          }
        );

        console.log("Kết quả điểm danh:", response.data);

        if (response.data && Array.isArray(response.data)) {
          setAttendanceRecords(response.data);
        } else if (
          response.data &&
          response.data.records &&
          Array.isArray(response.data.records)
        ) {
          setAttendanceRecords(response.data.records);
        } else {
          console.log("Chưa có bản ghi điểm danh nào, thiết lập rỗng");
          setAttendanceRecords([]);
        }
      } catch (error) {
        console.error("Lỗi khi lấy bản ghi điểm danh:", error);
        setAttendanceRecords([]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Lỗi khi lấy bản ghi điểm danh:", error);
      setAttendanceRecords([]);
      setLoading(false);
    }
  };

  // Sửa hàm loadModels để sử dụng model SsdMobilenetv1
  const loadModels = async () => {
    setModelLoadingStatus("Đang tải mô hình nhận diện khuôn mặt...");
    try {
      // Tạo đường dẫn chính xác đến các model files
      const modelPath = "/models";

      // Tải tất cả các mô hình cần thiết để tăng khả năng nhận diện
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
      ]);

      console.log("✅ Đã tải thành công tất cả mô hình nhận diện");
      setModelsLoaded(true);
      setModelLoadingStatus("Đã tải xong mô hình nhận diện");

      // Tải thông tin nhận dạng khuôn mặt từ tất cả sinh viên
      await loadStudentDescriptors();
      return true;
    } catch (error) {
      console.error("Lỗi khi tải mô hình nhận diện khuôn mặt:", error);
      setModelLoadingStatus("Lỗi tải mô hình: " + error.message);
      toast.error(
        "Không thể tải mô hình nhận diện khuôn mặt. Vui lòng thử lại sau."
      );
      return false;
    }
  };

  // Sửa hàm startContinuousFaceDetection để sử dụng nhiều thuật toán phát hiện khuôn mặt
  const startContinuousFaceDetection = async () => {
    // Xóa interval hiện tại nếu có
    if (detectInterval.current) {
      clearInterval(detectInterval.current);
      detectInterval.current = null;
    }

    console.log("Bắt đầu nhận diện khuôn mặt liên tục");
    console.log(
      "Trạng thái video:",
      videoRef.current ? "Khả dụng" : "Không khả dụng"
    );
    console.log("Số bản ghi điểm danh:", attendanceRecords.length);

    // Kiểm tra video ref và models đã load
    if (!videoRef.current) {
      console.error("Không tìm thấy video element để phát hiện khuôn mặt");
      toast.error("Không tìm thấy camera. Vui lòng kết nối camera và thử lại.");
      return;
    }

    if (!modelsLoaded) {
      console.error("Mô hình nhận diện khuôn mặt chưa được tải");
      toast.warning("Đang tải mô hình nhận diện khuôn mặt. Vui lòng đợi...");
      return;
    }

    // Kiểm tra và tạo attendance record tạm thời nếu chưa có
    if (!currentAttendance) {
      const tempAttendance = {
        _id: `temp_${Date.now()}`,
        classId: selectedClass?._id,
        date: attendanceDate,
        records: [],
      };
      setCurrentAttendance(tempAttendance);
    }

    // Khởi tạo canvas nếu chưa có
    if (!canvasRef.current) {
      console.error("Không tìm thấy canvas element để vẽ phát hiện");
      return;
    }

    // Đợi cho đến khi video đã load xong và có kích thước
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log("Kích thước video chưa khả dụng, đang đợi video tải...");

      const checkVideo = () => {
        return new Promise((resolve) => {
          const checkDimensions = () => {
            if (
              videoRef.current &&
              videoRef.current.videoWidth &&
              videoRef.current.videoHeight
            ) {
              resolve(true);
            } else if (!videoRef.current || !videoRef.current.srcObject) {
              resolve(false); // Video không còn khả dụng
            } else {
              setTimeout(checkDimensions, 100);
            }
          };
          checkDimensions();
        });
      };

      const videoReady = await checkVideo();
      if (!videoReady) {
        console.error("Video không sẵn sàng sau khi đợi");
        return;
      }
    }

    // Lấy kích thước thực của video
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    console.log(`Kích thước video phát hiện: ${videoWidth}x${videoHeight}`);

    // Cập nhật kích thước canvas cho phù hợp với video
    const canvas = canvasRef.current;

    // Đặt kích thước thật của canvas bằng với kích thước video
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Đảm bảo canvas hiển thị đúng tỷ lệ với video và đè lên video
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "contain";

    // Đặt kích thước hiển thị của canvas
    const displaySize = { width: videoWidth, height: videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    console.log(
      `Thiết lập kích thước canvas khớp với video: ${canvas.width}x${canvas.height}, Kích thước hiển thị: ${displaySize.width}x${displaySize.height}`
    );

    // Hiển thị thông báo khởi tạo cho người dùng
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hiển thị thông báo khởi động
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Đang khởi động nhận diện khuôn mặt...",
      canvas.width / 2,
      canvas.height / 2
    );
    ctx.font = "16px Arial";
    ctx.fillText(
      "Vui lòng đưa khuôn mặt vào giữa màn hình",
      canvas.width / 2,
      canvas.height / 2 + 40
    );

    // Hiển thị đếm ngược
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "24px Arial";
      ctx.fillText(
        `Bắt đầu trong ${countdown}...`,
        canvas.width / 2,
        canvas.height / 2
      );

      countdown--;
      if (countdown < 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Đợi 3 giây trước khi bắt đầu nhận diện liên tục
    setTimeout(() => {
      // Khởi chạy interval để phát hiện khuôn mặt
      const interval = setInterval(async () => {
        if (isProcessing) {
          // Bỏ qua nếu đang xử lý frame trước đó
          return;
        }

        if (
          !videoRef.current ||
          videoRef.current.paused ||
          videoRef.current.ended
        ) {
          console.warn("Video không sẵn sàng để phát hiện");
          return;
        }

        try {
          isProcessing = true;

          // Thử phát hiện khuôn mặt bằng nhiều mô hình khác nhau để tăng hiệu suất
          let detections = [];

          try {
            // Phương pháp 1: Sử dụng SsdMobilenetv1
            const ssdDetections = await faceapi
              .detectAllFaces(
                videoRef.current,
                new faceapi.SsdMobilenetv1Options({
                  minConfidence: FACE_RECOGNITION_CONFIG.DETECTION_CONFIDENCE,
                })
              )
              .withFaceLandmarks();

            // Phương pháp 2: Sử dụng TinyFaceDetector
            const tinyDetections = await faceapi
              .detectAllFaces(
                videoRef.current,
                new faceapi.TinyFaceDetectorOptions({
                  inputSize: 320,
                  scoreThreshold: 0.3, // Giảm ngưỡng để phát hiện nhiều khuôn mặt hơn
                })
              )
              .withFaceLandmarks();

            // Chọn kết quả tốt nhất (có nhiều khuôn mặt nhất)
            detections =
              ssdDetections.length >= tinyDetections.length
                ? ssdDetections
                : tinyDetections;

            if (detections.length === 0 && tinyDetections.length === 0) {
              // Thử giảm ngưỡng tin cậy nếu không phát hiện được khuôn mặt
              detections = await faceapi
                .detectAllFaces(
                  videoRef.current,
                  new faceapi.SsdMobilenetv1Options({
                    minConfidence: 0.3, // Giảm ngưỡng tin cậy
                  })
                )
                .withFaceLandmarks();
            }
          } catch (detectionError) {
            console.error("Lỗi khi kết hợp phát hiện:", detectionError);
            // Sử dụng phương pháp dự phòng
            detections = await faceapi
              .detectAllFaces(
                videoRef.current,
                new faceapi.SsdMobilenetv1Options({
                  minConfidence: FACE_RECOGNITION_CONFIG.DETECTION_CONFIDENCE,
                })
              )
              .withFaceLandmarks();
          }

          // Log kết quả phát hiện
          if (detections.length > 0) {
            console.log(`Đã phát hiện ${detections.length} khuôn mặt`);
          }

          // Clear canvas trước khi vẽ
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Đảm bảo vẽ lại frame của video lên canvas để tránh bị trong suốt
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          // Vẽ các kết quả phát hiện lên canvas
          if (detections.length > 0) {
            detections.forEach((detection) => {
              // Vẽ khung khuôn mặt
              const box = detection.detection.box;
              ctx.strokeStyle = FACE_RECOGNITION_CONFIG.BOX_COLORS.FACE;
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Vẽ landmarks
              const landmarks = detection.landmarks;

              // Vẽ đường viền mắt
              ctx.strokeStyle = FACE_RECOGNITION_CONFIG.BOX_COLORS.EYES;
              ctx.lineWidth = 1;

              // Mắt trái
              ctx.beginPath();
              const leftEye = landmarks.getLeftEye();
              leftEye.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.closePath();
              ctx.stroke();

              // Mắt phải
              ctx.beginPath();
              const rightEye = landmarks.getRightEye();
              rightEye.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.closePath();
              ctx.stroke();

              // Vẽ đường viền miệng
              ctx.strokeStyle = FACE_RECOGNITION_CONFIG.BOX_COLORS.MOUTH;
              ctx.beginPath();
              const mouth = landmarks.getMouth();
              mouth.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.closePath();
              ctx.stroke();

              // Vẽ đường viền mũi
              ctx.strokeStyle = FACE_RECOGNITION_CONFIG.BOX_COLORS.NOSE;
              ctx.beginPath();
              const nose = landmarks.getNose();
              nose.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.stroke();
            });

            // Hiển thị thông tin bổ sung dưới canvas
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, canvas.height - 30, canvas.width, 30);

            // Thông tin điểm danh
            ctx.fillStyle = FACE_RECOGNITION_CONFIG.BOX_COLORS.INFO_TEXT;
            ctx.font = "14px Arial";
            ctx.textAlign = "left";
            ctx.fillText(
              `Đã điểm danh: ${
                attendanceRecords.filter(
                  (r) => r.present || r.status === "present"
                ).length
              }/${students.length || 0} sinh viên`,
              10,
              canvas.height - 10
            );

            // Trạng thái nhận diện
            ctx.textAlign = "right";
            ctx.fillText(
              `Tự động nhận diện: ${autoDetectionEnabled ? "✓ Bật" : "✗ Tắt"}`,
              canvas.width - 10,
              canvas.height - 10
            );

            // Gọi hàm tự động nhận diện nếu được bật
            if (autoDetectionEnabled && detections.length > 0) {
              autoRecognizeFace(detections);
            }
          }
        } catch (error) {
          console.error("Lỗi phát hiện khuôn mặt:", error);
        } finally {
          isProcessing = false;
        }
      }, FACE_RECOGNITION_CONFIG.AUTO_DETECTION_INTERVAL);

      detectInterval.current = interval;
      console.log("Continuous face detection started");
    }, 3000); // Khởi động sau 3 giây
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Reset camera state
    setIsCameraStarted(false);

    // Clear detection interval
    if (detectInterval.current) {
      clearInterval(detectInterval.current);
      detectInterval.current = null;
    }

    console.log("Camera stopped and resources cleared");
  };

  // Sửa hàm markStudentPresent để tránh tạo bản ghi trùng lặp
  const markStudentPresent = (student) => {
    // Ngăn chặn nhiều lần nhấn liên tiếp
    if (isProcessingAttendance) {
      console.log("Đang xử lý điểm danh, vui lòng đợi...");
      return;
    }

    if (!student || !currentAttendance) {
      toast.error(
        "Không thể điểm danh: Thiếu thông tin sinh viên hoặc buổi học"
      );
      return;
    }

    try {
      // Đánh dấu đang xử lý
      setIsProcessingAttendance(true);

      // Kiểm tra nghiêm ngặt hơn cho trùng lặp
      // 1. Kiểm tra trong danh sách đã nhận diện
      if (recognizedStudentIds.includes(student._id)) {
        toast.info(`${student.name} đã được điểm danh rồi`);
        setIsProcessingAttendance(false);
        return;
      }

      // 2. Kiểm tra trong bản ghi điểm danh - kiểm tra chính xác hơn bằng studentId
      const alreadyPresent = attendanceRecords.some((record) => {
        // So sánh ID chính xác
        const isSameStudent =
          record.student === student._id ||
          record.studentId === student.studentId;

        // Kiểm tra trạng thái hiện diện
        const isPresent =
          record.present === true || record.status === "present";

        return isSameStudent && isPresent;
      });

      if (alreadyPresent) {
        toast.info(`${student.name} đã được điểm danh rồi`);
        setIsProcessingAttendance(false);
        return;
      }

      // Thêm vào danh sách đã nhận diện TRƯỚC để ngăn điểm danh lặp
      setRecognizedStudentIds((prev) => {
        // Kiểm tra xem ID đã tồn tại chưa
        if (prev.includes(student._id)) {
          return prev;
        }
        return [...prev, student._id];
      });

      // Gọi hàm điểm danh thủ công - chỉ lưu một bản ghi duy nhất
      saveManualAttendanceRecord(student).finally(() => {
        // Luôn đảm bảo reset isProcessingAttendance khi xong
        setIsProcessingAttendance(false);
      });

      // Display success message
      toast.success(`Đã điểm danh thủ công: ${student.name}`);
    } catch (error) {
      console.error("Error in manual attendance:", error);
      toast.error("Lỗi khi điểm danh thủ công");
      setIsProcessingAttendance(false);
    }
  };

  // Sửa hàm saveAttendanceRecord để lưu dữ liệu lên server với API có sẵn
  const saveAttendanceRecord = async (student, distance) => {
    // Kiểm tra xem sinh viên đã được nhận diện chưa
    if (recognizedStudentIds.includes(student._id)) {
      console.log(
        `Sinh viên ${student.name} đã được điểm danh trước đó, bỏ qua.`
      );
      return; // Bỏ qua nếu sinh viên đã được điểm danh
    }

    try {
      // Thêm vào danh sách đã nhận diện ngay từ đầu để tránh gọi API nhiều lần
      setRecognizedStudentIds((prev) => [...prev, student._id]);

      // Chuẩn bị thông tin phiên điểm danh
      const sessionId = currentAttendance?._id;
      const classId = selectedClass;
      const sessionNumber = selectedSession?.sessionNumber;

      console.log("Điểm danh với thông tin:", {
        sessionId,
        classId,
        sessionNumber,
        student: student.name,
      });

      // Tạo bản ghi local trước tiên để đảm bảo UI cập nhật ngay lập tức
      const localRecord = {
        _id: `temp_record_${student._id}_${Date.now()}`,
        student: student._id,
        studentId: student.studentId,
        name: student.name,
        present: true,
        method: "auto",
        timestamp: new Date().toISOString(),
        distance: distance,
        absent: false,
        classSession: sessionId || "unknown",
        verified: false,
        confidenceScore: 1 - distance,
        localRecord: true,
        pendingSync: true,
      };

      // Cập nhật state trước để UI hiển thị ngay lập tức
      setAttendanceRecords((prev) => {
        // Kiểm tra xem đã có bản ghi này chưa
        const isDuplicate = prev.some(
          (record) =>
            record.student === student._id &&
            (record.present === true || record.status === "present")
        );

        if (isDuplicate) {
          console.log(`Bỏ qua bản ghi trùng lặp cho ${student.name}`);
          return prev;
        }
        return [...prev, localRecord];
      });

      // Toast thông báo điểm danh thành công
      toast.success(`Đã nhận diện: ${student.name}`, {
        autoClose: 2000,
        position: "bottom-right",
      });

      // Nếu không có phiên điểm danh trên server, tạo mới
      if (
        !sessionId ||
        sessionId.startsWith("local_") ||
        sessionId.startsWith("temp_")
      ) {
        try {
          console.log("Tạo phiên điểm danh mới trên server...");
          const response = await axios.post("/api/attendance/start", {
            classId: classId,
            sessionNumber: sessionNumber,
            date: new Date().toISOString().split("T")[0],
          });

          if (response.data && response.data._id) {
            console.log("Tạo phiên điểm danh thành công:", response.data._id);
            // Cập nhật sessionId với ID từ server
            setCurrentAttendance(response.data);

            // Cập nhật API mới và tham số mới
            try {
              const updateResponse = await axios.put(
                `/api/teacher/attendance/${response.data._id}/student/${student._id}`,
                {
                  present: true,
                  method: "face",
                  matchPercentage: Math.round((1 - distance) * 100),
                }
              );

              if (updateResponse.data) {
                console.log(
                  `Đã cập nhật trạng thái điểm danh cho ${student.name}`
                );
                // Cập nhật bản ghi trong state
                setAttendanceRecords((prev) =>
                  prev.map((record) =>
                    record._id === localRecord._id
                      ? { ...record, pendingSync: false, synced: true }
                      : record
                  )
                );
              }
            } catch (updateError) {
              console.error(
                "Không thể cập nhật trạng thái điểm danh:",
                updateError.response?.data?.message || updateError.message
              );
            }
          }
        } catch (error) {
          console.error(
            "Không thể tạo phiên điểm danh:",
            error.response?.data?.message || error.message
          );
        }
      } else {
        // Nếu đã có phiên điểm danh, cập nhật trạng thái sinh viên
        try {
          // Cập nhật API với tham số mới
          const updateResponse = await axios.put(
            `/api/teacher/attendance/${sessionId}/student/${student._id}`,
            {
              present: true,
              method: "face",
              matchPercentage: Math.round((1 - distance) * 100),
            }
          );

          if (updateResponse.data) {
            console.log(`Đã cập nhật trạng thái điểm danh cho ${student.name}`);
            // Cập nhật bản ghi trong state
            setAttendanceRecords((prev) =>
              prev.map((record) =>
                record._id === localRecord._id
                  ? { ...record, pendingSync: false, synced: true }
                  : record
              )
            );
          }
        } catch (updateError) {
          console.error(
            "Không thể cập nhật trạng thái điểm danh:",
            updateError.response?.data?.message || updateError.message
          );
        }
      }
    } catch (error) {
      console.error(
        "Lỗi khi điểm danh:",
        error.response?.data?.message || error.message
      );
      toast.error(`Lỗi khi điểm danh cho ${student.name}`);
    }
  };

  // Sửa hàm saveManualAttendanceRecord để lưu dữ liệu lên server với API có sẵn
  const saveManualAttendanceRecord = async (student) => {
    try {
      // Chuẩn bị thông tin phiên điểm danh
      const sessionId = currentAttendance?._id;
      const classId = selectedClass;
      const sessionNumber = selectedSession?.sessionNumber;

      console.log("Điểm danh thủ công với thông tin:", {
        sessionId,
        classId,
        sessionNumber,
        student: student.name,
      });

      // Tạo bản ghi cục bộ trước để UI cập nhật ngay lập tức
      const localRecord = {
        _id: `manual_record_${student._id}_${Date.now()}`,
        student: student._id,
        studentId: student.studentId,
        name: student.name,
        present: true,
        method: "manual",
        timestamp: new Date().toISOString(),
        recordTime: new Date(),
        absent: false,
        classSession: sessionId || "unknown",
        verified: true,
        localRecord: true,
        pendingSync: true,
      };

      // Cập nhật state
      setAttendanceRecords((prev) => [...prev, localRecord]);

      // Nếu không có phiên điểm danh trên server, tạo mới
      if (
        !sessionId ||
        sessionId.startsWith("local_") ||
        sessionId.startsWith("temp_")
      ) {
        try {
          console.log("Tạo phiên điểm danh mới trên server...");
          const response = await axios.post("/api/attendance/start", {
            classId: classId,
            sessionNumber: sessionNumber,
            date: new Date().toISOString().split("T")[0],
          });

          if (response.data && response.data._id) {
            console.log("Tạo phiên điểm danh thành công:", response.data._id);
            // Cập nhật sessionId với ID từ server
            setCurrentAttendance(response.data);

            // Cập nhật API với tham số mới
            try {
              const updateResponse = await axios.put(
                `/api/teacher/attendance/${response.data._id}/student/${student._id}`,
                {
                  present: true,
                  method: "manual",
                  note: "Điểm danh thủ công bởi giảng viên",
                }
              );

              if (updateResponse.data) {
                console.log(
                  `Đã cập nhật trạng thái điểm danh thủ công cho ${student.name}`
                );
                // Cập nhật bản ghi trong state
                setAttendanceRecords((prev) =>
                  prev.map((record) =>
                    record._id === localRecord._id
                      ? { ...record, pendingSync: false, synced: true }
                      : record
                  )
                );
              }
            } catch (updateError) {
              console.error(
                "Không thể cập nhật trạng thái điểm danh thủ công:",
                updateError.response?.data?.message || updateError.message
              );
            }
          }
        } catch (error) {
          console.error(
            "Không thể tạo phiên điểm danh:",
            error.response?.data?.message || error.message
          );
        }
      } else {
        // Nếu đã có phiên điểm danh, cập nhật trạng thái sinh viên
        try {
          // Cập nhật API với tham số mới
          const updateResponse = await axios.put(
            `/api/teacher/attendance/${sessionId}/student/${student._id}`,
            {
              present: true,
              method: "manual",
              note: "Điểm danh thủ công bởi giảng viên",
            }
          );

          if (updateResponse.data) {
            console.log(
              `Đã cập nhật trạng thái điểm danh thủ công cho ${student.name}`
            );
            // Cập nhật bản ghi trong state
            setAttendanceRecords((prev) =>
              prev.map((record) =>
                record._id === localRecord._id
                  ? { ...record, pendingSync: false, synced: true }
                  : record
              )
            );
          }
        } catch (updateError) {
          console.error(
            "Không thể cập nhật trạng thái điểm danh thủ công:",
            updateError.response?.data?.message || updateError.message
          );
        }
      }
    } catch (error) {
      console.error(
        "Lỗi khi điểm danh thủ công:",
        error.response?.data?.message || error.message
      );
      toast.error(`Lỗi khi điểm danh thủ công cho ${student.name}`);
    } finally {
      // Đảm bảo reset isProcessingAttendance khi xong
      setIsProcessingAttendance(false);
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
      if (!selectedClass) {
        setError("Vui lòng chọn lớp học");
        return;
      }

      console.log("Fetching students for class:", selectedClass);
      setLoading(true);

      // Sử dụng API mới để lấy danh sách sinh viên trong lớp học
      const response = await axios.get(
        `/api/teacher/classes/${selectedClass}/students`
      );

      console.log("Student API response:", response.data);

      if (response.data && Array.isArray(response.data)) {
        console.log(
          `Loaded ${response.data.length} students for class ${selectedClass}`
        );

        // Make sure each student has valid data fields
        const studentsWithIds = response.data.map((student) => {
          // Create a clean object with all required fields
          const processedStudent = {
            ...student,
            _id: student._id || `generated_${Date.now()}_${Math.random()}`,
            studentId:
              student.studentId || student.code || `temp_${student._id}`,
            name: student.name || "Unknown Student",
          };

          console.log("Processed student:", processedStudent);
          return processedStudent;
        });

        console.log(
          "Students with IDs:",
          studentsWithIds.map((s) => ({
            name: s.name,
            id: s._id,
            studentId: s.studentId,
          }))
        );

        setStudents(studentsWithIds);
        console.log(
          "Students state updated with:",
          studentsWithIds.length,
          "students"
        );
      } else {
        console.error("Expected array but got:", response.data);
        // Thử một endpoint khác nếu endpoint hiện tại không trả về dữ liệu mong đợi
        try {
          console.log("Trying alternative API endpoint");
          const alternateResponse = await axios.get(
            `/api/classes/${selectedClass}/students`
          );

          if (alternateResponse.data && Array.isArray(alternateResponse.data)) {
            console.log(
              "Alternative API returned:",
              alternateResponse.data.length,
              "students"
            );

            const processedStudents = alternateResponse.data.map((student) => {
              return {
                ...student,
                _id: student._id || `generated_${Date.now()}_${Math.random()}`,
                studentId:
                  student.studentId || student.code || `temp_${student._id}`,
                name: student.name || "Unknown Student",
              };
            });

            setStudents(processedStudents);
            console.log(
              "Students state updated with alternative data:",
              processedStudents.length,
              "students"
            );
          } else {
            console.error(
              "Alternative API also failed to return expected data"
            );
            setStudents([]);
          }
        } catch (alternateError) {
          console.error("Alternative API request failed:", alternateError);
          setStudents([]);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      // Thử endpoint dự phòng
      try {
        console.log("Primary API failed, trying backup endpoint");
        const backupResponse = await axios.get(
          `/api/classes/${selectedClass}/students`
        );

        if (backupResponse.data && Array.isArray(backupResponse.data)) {
          console.log(
            "Backup API returned:",
            backupResponse.data.length,
            "students"
          );

          const processedStudents = backupResponse.data.map((student) => {
            return {
              ...student,
              _id: student._id || `generated_${Date.now()}_${Math.random()}`,
              studentId:
                student.studentId || student.code || `temp_${student._id}`,
              name: student.name || "Unknown Student",
            };
          });

          setStudents(processedStudents);
          console.log(
            "Students state updated with backup data:",
            processedStudents.length,
            "students"
          );
        } else {
          setError("Không thể tải danh sách sinh viên");
          setStudents([]);
        }
      } catch (backupError) {
        console.error("All student API attempts failed");
        setError("Không thể tải danh sách sinh viên");
        setStudents([]);
      }
    } finally {
      setLoading(false);
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
    try {
      if (!selectedClass) {
        setError("Vui lòng chọn lớp học");
        return;
      }

      const query = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };

      setLoading(true);

      try {
        const response = await axios.get(
          `/api/teacher/classes/${selectedClass}/attendance-stats`,
          {
            params: query,
          }
        );

        console.log("Thống kê điểm danh:", response.data);
        setAttendanceStats(response.data);
      } catch (error) {
        console.error("Không thể lấy thống kê điểm danh:", error);
        setError("Không thể tải thống kê điểm danh: " + error.message);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      setError("Không thể tải thống kê điểm danh: " + error.message);
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const startCamera = async () => {
    try {
      console.log("Đang cố gắng truy cập camera...");
      console.log("Trạng thái hiện tại:", {
        videoRef: !!videoRef.current,
        currentAttendance: !!currentAttendance,
        currentAttendanceData: currentAttendance,
        modelsLoaded,
      });

      // Xóa lỗi cũ
      setError("");

      // Thiết lập trạng thái camera đã bật
      setIsCameraStarted(true);

      // Kiểm tra xem trình duyệt có hỗ trợ getUserMedia không
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt của bạn không hỗ trợ truy cập camera");
      }

      // Đảm bảo các model Face API đã tải xong
      if (!modelsLoaded) {
        console.log("Đang đợi tải các mô hình face-api...");
        await loadModels();
      }

      // Dừng stream cũ nếu có
      if (streamRef.current) {
        console.log("Stopping existing camera stream");
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }

      // Yêu cầu quyền truy cập camera với cài đặt chất lượng tốt hơn
      console.log("Requesting camera access with improved settings");
      try {
        const stream = await navigator.mediaDevices
          .getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
              frameRate: { ideal: 30 },
            },
            audio: false,
          })
          .catch((err) => {
            // Xử lý lỗi cụ thể cho từng loại
            if (
              err.name === "NotAllowedError" ||
              err.name === "PermissionDeniedError"
            ) {
              console.error("Camera permission denied by user");
              setError(
                "Bạn đã từ chối quyền truy cập camera. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt."
              );
              toast.error("Đã từ chối quyền truy cập camera", {
                autoClose: 5000,
              });
            } else if (
              err.name === "NotFoundError" ||
              err.name === "DevicesNotFoundError"
            ) {
              console.error("No camera device found");
              setError(
                "Không tìm thấy thiết bị camera. Vui lòng kết nối camera và thử lại."
              );
              toast.error("Không tìm thấy camera", { autoClose: 5000 });
            } else if (
              err.name === "NotReadableError" ||
              err.name === "TrackStartError"
            ) {
              console.error(
                "Camera hardware error or in use by another application"
              );
              setError(
                "Camera đang được sử dụng bởi ứng dụng khác hoặc có lỗi phần cứng. Vui lòng đóng các ứng dụng khác và thử lại."
              );
              toast.error("Camera đang bận", { autoClose: 5000 });
            } else {
              console.error("Error accessing camera:", err);
              setError("Lỗi truy cập camera: " + err.message);
              toast.error("Lỗi truy cập camera", { autoClose: 5000 });
            }

            setIsCameraStarted(false);
            throw err;
          });

        console.log("Đã truy cập camera thành công");
        streamRef.current = stream;

        // Đợi cho đến khi video element có sẵn
        const checkVideoRef = () => {
          return new Promise((resolve) => {
            const check = () => {
              if (videoRef.current) {
                resolve(true);
              } else {
                setTimeout(check, 100);
              }
            };
            check();
          });
        };

        await checkVideoRef();

        // Bây giờ chắc chắn là videoRef.current tồn tại
        videoRef.current.srcObject = stream;

        // Thiết lập canvas để đồng bộ với video
        if (canvasRef.current) {
          const canvas = canvasRef.current;

          // Đảm bảo canvas nằm đè lên video
          canvas.style.position = "absolute";
          canvas.style.top = "0";
          canvas.style.left = "0";
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.objectFit = "contain";
          canvas.style.zIndex = "10";
        }

        // Sử dụng onloadeddata để đảm bảo video đã được tải
        return new Promise((resolve) => {
          videoRef.current.onloadeddata = async () => {
            try {
              console.log(
                "Video data loaded, dimensions:",
                videoRef.current.videoWidth,
                "x",
                videoRef.current.videoHeight
              );

              // Bắt đầu phát video
              await videoRef.current.play().catch((playError) => {
                console.error("Error playing video:", playError);
                setError("Không thể phát video: " + playError.message);
                resolve(false);
                return;
              });

              console.log("Video playback started successfully");

              // Cập nhật kích thước canvas để khớp với video
              if (canvasRef.current && videoRef.current.videoWidth) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }

              // Đợi một khoảng thời gian ngắn để đảm bảo mọi thứ đã sẵn sàng
              setTimeout(() => {
                if (videoRef.current && videoRef.current.srcObject) {
                  console.log("Starting face detection after delay");

                  // Kiểm tra currentAttendance
                  if (!currentAttendance) {
                    console.warn(
                      "currentAttendance là null hoặc undefined, tạo giả lập tạm thời"
                    );
                    // Tạo một đối tượng currentAttendance tạm thời
                    const tempAttendance = {
                      _id: `temp_${Date.now()}`,
                      sessionNumber: selectedSession?.sessionNumber || 1,
                      status: "in-progress",
                      isTemp: true,
                    };

                    // Cập nhật state
                    setCurrentAttendance(tempAttendance);

                    // Hiển thị thông báo cho người dùng
                    toast.info(
                      "Đang chạy nhận diện khuôn mặt ở chế độ tạm thời"
                    );

                    // Đợi một chút để state được cập nhật
                    setTimeout(() => {
                      startContinuousFaceDetection();
                      resolve(true);
                    }, 500);
                  } else {
                    // Nếu có currentAttendance, bắt đầu nhận diện bình thường
                    startContinuousFaceDetection();
                    resolve(true);
                  }
                } else {
                  console.log("Not starting face detection yet:", {
                    videoReady: !!videoRef.current,
                    streamReady: !!(
                      videoRef.current && videoRef.current.srcObject
                    ),
                    attendanceReady: !!currentAttendance,
                  });
                  resolve(false);
                }
              }, 1000);
            } catch (err) {
              console.error("Error in video loaded event handler:", err);
              setError("Lỗi khi khởi tạo video: " + err.message);
              resolve(false);
            }
          };
        });
      } catch (streamError) {
        console.error("Error accessing camera stream:", streamError);
        setError("Không thể truy cập camera: " + streamError.message);
        setIsCameraStarted(false);
        throw streamError;
      }
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      setError("Không thể truy cập camera: " + error.message);
      setIsCameraStarted(false);
      return false;
    }
  };

  // Triển khai hàm autoRecognizeFace
  // Hàm này được gọi từ bên trong startContinuousFaceDetection
  const autoRecognizeFace = async (detectionsWithLandmarks) => {
    // Tránh chạy nhiều yêu cầu cùng lúc
    if (isRecognizing) {
      console.log("Skipping auto recognize - already in progress");
      return;
    }

    try {
      setIsRecognizing(true);
      console.log("Auto recognizing face...");

      // Kiểm tra có sinh viên đã load không
      if (!students || students.length === 0) {
        console.warn("No students data available for face recognition");
        setIsRecognizing(false);
        return;
      }

      // Chỉ xử lý khuôn mặt đầu tiên phát hiện được
      if (detectionsWithLandmarks.length === 0) {
        console.log("No faces detected for auto recognition");
        setIsRecognizing(false);
        return;
      }

      // Lấy khuôn mặt đầu tiên
      const firstFace = detectionsWithLandmarks[0];
      console.log("Attempting to recognize face:", firstFace);

      // Criar um canvas temporário para processamento e visualização se necessário
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      // Đảm bảo kích thước của canvas tạm thời đúng bằng kích thước video
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      tempCanvas.width = videoWidth;
      tempCanvas.height = videoHeight;

      // Desenhar o frame atual do vídeo no canvas
      tempCtx.drawImage(
        videoRef.current,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // Lấy landmarks và vector nhận dạng
      const faceDescriptor = await faceapi.computeFaceDescriptor(
        videoRef.current,
        firstFace
      );

      if (!faceDescriptor) {
        console.log("Failed to compute face descriptor for auto recognition");
        return;
      }

      // Draw the face landmarks on temporary canvas
      const box = firstFace.detection.box;
      const landmarks = firstFace.landmarks;

      // Desenhar a caixa de delimitação facial
      tempCtx.strokeStyle = "#00C853"; // Verde
      tempCtx.lineWidth = 2;
      tempCtx.strokeRect(box.x, box.y, box.width, box.height);

      // Desenhar landmarks faciais com cores diferentes
      // Olhos
      tempCtx.strokeStyle = "#2979FF"; // Azul
      tempCtx.lineWidth = 1;

      // Olho esquerdo
      tempCtx.beginPath();
      const leftEye = landmarks.getLeftEye();
      leftEye.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Olho direito
      tempCtx.beginPath();
      const rightEye = landmarks.getRightEye();
      rightEye.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Boca
      tempCtx.strokeStyle = "#AA00FF"; // Roxo
      tempCtx.beginPath();
      const mouth = landmarks.getMouth();
      mouth.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Nariz
      tempCtx.strokeStyle = "#FFAB00"; // Amarelo
      tempCtx.beginPath();
      const nose = landmarks.getNose();
      nose.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.stroke();

      // Kiểm tra sinh viên có dữ liệu khuôn mặt để so sánh
      const studentsWithFaces = students.filter(
        (s) =>
          s.faceFeatures &&
          Array.isArray(s.faceFeatures) &&
          s.faceFeatures.length > 0
      );

      if (studentsWithFaces.length === 0) {
        console.warn("No students have face features for comparison");
        return;
      }

      // So sánh với tất cả sinh viên trong lớp với ngưỡng chấp nhận được
      let bestMatch = null;
      let bestDistance = FACE_RECOGNITION_CONFIG.AUTO_MATCHING_THRESHOLD; // Sử dụng ngưỡng từ cấu hình
      let allDistances = []; // Tracking all distances

      // Lọc ra các sinh viên chưa được nhận diện trước đó
      const unrecognizedStudents = studentsWithFaces.filter(
        (student) => !recognizedStudentIds.includes(student._id)
      );

      // Nếu tất cả sinh viên đã được điểm danh, chỉ quét với tần suất thấp hơn
      if (unrecognizedStudents.length === 0) {
        // Chỉ xử lý 5% thời gian để tiết kiệm tài nguyên nếu tất cả đã được quét
        if (Math.random() > 0.02) {
          // Giảm tần suất quét xuống còn 2%
          console.log("Tất cả sinh viên đã được điểm danh, bỏ qua quét.");
          setIsRecognizing(false);
          return;
        }
        // Sử dụng tất cả sinh viên để kiểm tra lại thỉnh thoảng
        console.log("Quét lại để kiểm tra (tần suất thấp)...");
        for (const student of studentsWithFaces) {
          try {
            // Chuyển đổi mảng đặc trưng khuôn mặt từ string/number thành Float32Array
            let faceFeatures;
            try {
              faceFeatures = new Float32Array(
                typeof student.faceFeatures[0] === "string"
                  ? student.faceFeatures.map((f) => parseFloat(f))
                  : student.faceFeatures
              );
            } catch (conversionError) {
              console.error(
                `Error converting face features for ${student.name}:`,
                conversionError
              );
              continue; // Skip this student
            }

            // Tính khoảng cách Euclidean giữa hai vector đặc trưng
            const distance = faceapi.euclideanDistance(
              faceDescriptor,
              faceFeatures
            );

            console.log(
              `AUTO: Comparing with ${
                student.name
              }: distance = ${distance.toFixed(3)}`
            );

            // Track all distances for analysis
            allDistances.push({
              studentId: student.studentId,
              name: student.name,
              distance: distance,
            });

            if (distance < bestDistance) {
              // Cập nhật kết quả tốt nhất nếu khoảng cách nhỏ hơn ngưỡng
              bestMatch = student;
              bestDistance = distance;

              // Log thành công
              console.log(
                `✓ AUTO: Matched ${student.name} with ${distance.toFixed(3)}`
              );
            }
          } catch (error) {
            console.error(
              `Error comparing with student ${student.name}:`,
              error
            );
          }
        }
      } else {
        // Nếu còn sinh viên chưa được nhận diện, ưu tiên quét những sinh viên này
        for (const student of unrecognizedStudents) {
          try {
            // Chuyển đổi mảng đặc trưng khuôn mặt từ string/number thành Float32Array
            let faceFeatures;
            try {
              faceFeatures = new Float32Array(
                typeof student.faceFeatures[0] === "string"
                  ? student.faceFeatures.map((f) => parseFloat(f))
                  : student.faceFeatures
              );
            } catch (conversionError) {
              console.error(
                `Error converting face features for ${student.name}:`,
                conversionError
              );
              continue; // Skip this student
            }

            // Tính khoảng cách Euclidean giữa hai vector đặc trưng
            const distance = faceapi.euclideanDistance(
              faceDescriptor,
              faceFeatures
            );

            console.log(
              `AUTO: Comparing with ${
                student.name
              }: distance = ${distance.toFixed(3)}`
            );

            // Track all distances for analysis
            allDistances.push({
              studentId: student.studentId,
              name: student.name,
              distance: distance,
            });

            if (distance < bestDistance) {
              // Cập nhật kết quả tốt nhất nếu khoảng cách nhỏ hơn ngưỡng
              bestMatch = student;
              bestDistance = distance;

              // Log thành công
              console.log(
                `✓ AUTO: Matched ${student.name} with ${distance.toFixed(3)}`
              );
            }
          } catch (error) {
            console.error(
              `Error comparing with student ${student.name}:`,
              error
            );
          }
        }
      }

      // Sort distances for analysis
      allDistances.sort((a, b) => a.distance - b.distance);
      console.log(
        "AUTO recognition distances (ordered):",
        allDistances.slice(0, 3)
      );

      if (bestMatch) {
        // Đã nhận diện được sinh viên
        console.log(
          "AUTO MATCHED student:",
          bestMatch.name,
          "with distance:",
          bestDistance.toFixed(3)
        );

        // Cập nhật sinh viên được nhận diện để hiển thị trên khuôn mặt
        setRecognizedStudent(bestMatch);

        // Adicionar texto ao canvas com nome e ID do estudante
        tempCtx.fillStyle = "#27ae60"; // Verde de fundo
        const textBox = {
          x: box.x,
          y: box.y - 35,
          width: box.width,
          height: 30,
        };

        // Desenhar caixa de texto
        tempCtx.fillRect(textBox.x, textBox.y, textBox.width, textBox.height);

        // Escrever texto
        tempCtx.fillStyle = "#FFFFFF";
        tempCtx.font = "14px Arial";
        tempCtx.fillText(
          `${bestMatch.studentId} - ${bestMatch.name}`,
          textBox.x + 5,
          textBox.y + 20
        );

        // Adicionar porcentagem de confiança
        const confidence = ((1 - bestDistance) * 100).toFixed(0);
        tempCtx.fillStyle =
          confidence > 80 ? "#00C853" : confidence > 60 ? "#FFAB00" : "#FF1744";
        tempCtx.font = "12px Arial";
        tempCtx.fillText(
          `${confidence}%`,
          textBox.x + textBox.width - 30,
          textBox.y + 20
        );

        // Kiểm tra xem sinh viên đã được điểm danh chưa - kiểm tra cả mảng cục bộ và API
        const alreadyPresent = attendanceRecords.some((record) => {
          return (
            (record.student === bestMatch._id ||
              record.studentId === bestMatch.studentId) &&
            (record.present === true || record.status === "present")
          );
        });

        // Kiểm tra thêm trong danh sách sinh viên đã nhận diện
        const alreadyRecognized = recognizedStudentIds.includes(bestMatch._id);

        if (!alreadyPresent && !alreadyRecognized) {
          // Hiển thị thông báo thành công với độ tin cậy
          const confidence = Math.round((1 - bestDistance) * 100);

          // Chỉ hiển thị toast và lưu nếu độ tin cậy cao (>= 60%)
          if (confidence >= 60) {
            toast.success(
              `Tự động: Điểm danh ${bestMatch.studentId} ${bestMatch.name} (${confidence}% khớp)`,
              {
                autoClose: 3000,
                position: "bottom-right",
              }
            );

            // Thêm vào danh sách đã nhận diện trước - để tránh trường hợp lưu nhiều lần
            setRecognizedStudentIds((prev) => [...prev, bestMatch._id]);

            // Create a local record and update UI immediately
            const newRecord = {
              _id: `auto_record_${Date.now()}`,
              student: bestMatch._id,
              studentId: bestMatch.studentId,
              name: bestMatch.name || "Unknown",
              present: true,
              status: "present",
              method: "auto",
              recordTime: new Date(),
              timestamp: new Date(),
              matchPercentage: confidence,
            };

            // Update local state immediately
            setAttendanceRecords((prev) => [...prev, newRecord]);

            // Gọi hàm điểm danh tự động thay vì saveAttendanceRecord
            saveAutoAttendanceRecord(bestMatch, bestDistance);
          } else {
            console.log(`Độ tin cậy thấp (${confidence}%), bỏ qua điểm danh`);
          }
        } else {
          console.log(`${bestMatch.name} already marked as present. Skipping.`);
        }

        // Atualizar o canvas principal com a visualização avançada
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    } catch (error) {
      console.error("Error in auto face recognition:", error);
    } finally {
      setIsRecognizing(false);
    }
  };

  const detectSingleFace = async () => {
    if (!videoRef.current) return;

    try {
      setIsRecognizing(true);
      toast.info("Đang quét khuôn mặt...", { autoClose: 1500 });

      // Criar um canvas temporário para processamento e visualização
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      // Đảm bảo kích thước của canvas tạm thời đúng bằng kích thước video
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      tempCanvas.width = videoWidth;
      tempCanvas.height = videoHeight;

      // Desenhar o frame atual do vídeo no canvas
      tempCtx.drawImage(
        videoRef.current,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // Sử dụng SsdMobilenetv1 com withFaceLandmarks e withFaceDescriptor
      const fullFaceDescription = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.SsdMobilenetv1Options({
            minConfidence: FACE_RECOGNITION_CONFIG.DETECTION_CONFIDENCE + 0.2, // Aumentar confiança para detecção manual
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!fullFaceDescription) {
        // Se nenhum rosto for detectado, mostrar feedback visual
        setIsRecognizing(false);
        toast.warning("Không phát hiện khuôn mặt", { autoClose: 2000 });

        // Exibir um feedback visual na interface
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");

          // Đảm bảo canvas chính có kích thước chính xác
          if (
            canvasRef.current.width !== videoWidth ||
            canvasRef.current.height !== videoHeight
          ) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
            // Cập nhật CSS
            canvasRef.current.style.width = "100%";
            canvasRef.current.style.height = "auto";
          }

          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );

          // Vẽ kết quả từ canvas tạm
          ctx.drawImage(tempCanvas, 0, 0);

          // Texto de aviso
          ctx.fillStyle = "#FF0000";
          ctx.font = "24px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            "Không phát hiện khuôn mặt",
            canvasRef.current.width / 2,
            canvasRef.current.height / 2
          );

          // Resetar após 2 segundos
          setTimeout(() => {
            if (canvasRef.current) {
              ctx.clearRect(
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height
              );
            }
          }, 2000);
        }

        return;
      }

      // Extrair o descriptor de face e landmarks para visualização
      const faceDescriptor = fullFaceDescription.descriptor;
      const detection = fullFaceDescription.detection;
      const landmarks = fullFaceDescription.landmarks;

      // Desenhar visualização avançada no canvas temporário
      // Desenhar a caixa de delimitação facial
      tempCtx.strokeStyle = "#00C853"; // Verde
      tempCtx.lineWidth = 2;
      tempCtx.strokeRect(
        detection.box.x,
        detection.box.y,
        detection.box.width,
        detection.box.height
      );

      // Desenhar landmarks faciais com cores diferentes
      // Olhos
      tempCtx.strokeStyle = "#2979FF"; // Azul
      tempCtx.lineWidth = 1;

      // Olho esquerdo
      tempCtx.beginPath();
      const leftEye = landmarks.getLeftEye();
      leftEye.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Olho direito
      tempCtx.beginPath();
      const rightEye = landmarks.getRightEye();
      rightEye.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Boca
      tempCtx.strokeStyle = "#AA00FF"; // Roxo
      tempCtx.beginPath();
      const mouth = landmarks.getMouth();
      mouth.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.closePath();
      tempCtx.stroke();

      // Nariz
      tempCtx.strokeStyle = "#FFAB00"; // Amarelo
      tempCtx.beginPath();
      const nose = landmarks.getNose();
      nose.forEach((point, i) => {
        if (i === 0) tempCtx.moveTo(point.x, point.y);
        else tempCtx.lineTo(point.x, point.y);
      });
      tempCtx.stroke();

      // Check if any students have face features to compare
      const studentsWithFaces = students.filter(
        (s) =>
          s.faceFeatures &&
          Array.isArray(s.faceFeatures) &&
          s.faceFeatures.length > 0
      );

      if (studentsWithFaces.length === 0) {
        console.log("No students have face features for comparison");
        toast.warning("Không có sinh viên nào có dữ liệu khuôn mặt để so sánh");
        setIsRecognizing(false);
        return;
      }

      // So sánh với tất cả sinh viên trong lớp với ngưỡng cao hơn
      let bestMatch = null;
      let bestDistance = 0.75; // Giảm ngưỡng để tăng độ chính xác (giá trị nhỏ hơn = chính xác hơn)
      let allDistances = []; // Lưu tất cả khoảng cách để phân tích

      for (const student of studentsWithFaces) {
        if (student.faceFeatures && student.faceFeatures.length > 0) {
          try {
            // Chuyển đổi mảng đặc trưng khuôn mặt từ string/number thành Float32Array
            let faceFeatures;
            try {
              faceFeatures = new Float32Array(
                typeof student.faceFeatures[0] === "string"
                  ? student.faceFeatures.map((f) => parseFloat(f))
                  : student.faceFeatures
              );
            } catch (conversionError) {
              console.error(
                `Error converting face features for ${student.name}:`,
                conversionError
              );
              continue; // Skip this student
            }

            // Tính khoảng cách Euclidean giữa hai vector đặc trưng
            const distance = faceapi.euclideanDistance(
              faceDescriptor,
              faceFeatures
            );

            console.log(
              `MANUAL: Comparing with ${
                student.name
              }: distance = ${distance.toFixed(3)}`
            );

            // Armazenar para análise
            allDistances.push({
              studentId: student.studentId,
              name: student.name,
              distance: distance,
            });

            if (distance < bestDistance) {
              // Cập nhật kết quả tốt nhất nếu khoảng cách nhỏ hơn ngưỡng
              bestMatch = student;
              bestDistance = distance;

              // Log thành công
              console.log(
                `✓ MANUAL: Matched ${student.name} with ${distance.toFixed(3)}`
              );
            }
          } catch (error) {
            console.error(
              `Error comparing with student ${student.name}:`,
              error
            );
          }
        } else {
          console.log(
            `Student ${student.name} has no face features to compare`
          );
        }
      }

      // Ordenar todas as distâncias para análise
      allDistances.sort((a, b) => a.distance - b.distance);
      console.log("All face distances (ordered):", allDistances);

      if (bestMatch) {
        // Đã nhận diện được sinh viên
        console.log(
          "MANUAL MATCHED student:",
          bestMatch.name,
          "with distance:",
          bestDistance.toFixed(3)
        );

        // Cập nhật sinh viên được nhận diện để hiển thị trên khuôn mặt
        setRecognizedStudent(bestMatch);

        // Adicionar texto ao canvas com nome e ID do estudante
        tempCtx.fillStyle = "#27ae60"; // Verde de fundo
        const textBox = {
          x: detection.box.x,
          y: detection.box.y - 35,
          width: detection.box.width,
          height: 30,
        };

        // Desenhar caixa de texto
        tempCtx.fillRect(textBox.x, textBox.y, textBox.width, textBox.height);

        // Escrever texto
        tempCtx.fillStyle = "#FFFFFF";
        tempCtx.font = "14px Arial";
        tempCtx.fillText(
          `${bestMatch.studentId} - ${bestMatch.name}`,
          textBox.x + 5,
          textBox.y + 20
        );

        // Adicionar porcentagem de confiança
        const confidence = ((1 - bestDistance) * 100).toFixed(0);
        tempCtx.fillStyle =
          confidence > 80 ? "#00C853" : confidence > 60 ? "#FFAB00" : "#FF1744";
        tempCtx.font = "12px Arial";
        tempCtx.fillText(
          `${confidence}%`,
          textBox.x + textBox.width - 30,
          textBox.y + 20
        );

        // Make sure studentId is available
        if (!bestMatch.studentId) {
          console.error("Student object missing studentId:", bestMatch);
          toast.warning("Sinh viên này không có mã số sinh viên!");
          setIsRecognizing(false);
          return;
        }

        // Kiểm tra xem sinh viên đã được điểm danh chưa
        const alreadyPresent = attendanceRecords.some((record) => {
          return (
            (record.student === bestMatch._id ||
              record.studentId === bestMatch.studentId) &&
            (record.present === true || record.status === "present")
          );
        });

        if (!alreadyPresent) {
          // Hiển thị thông báo thành công với mức độ tin cậy
          const confidence = Math.round((1 - bestDistance) * 100);
          toast.success(
            `Thủ công: Điểm danh ${bestMatch.name} (${confidence}% khớp)`,
            {
              autoClose: 3000,
              position: "bottom-right",
            }
          );

          // Create a local record and update UI immediately
          const newRecord = {
            _id: `manual_record_${Date.now()}`,
            student: bestMatch._id,
            studentId: bestMatch.studentId,
            name: bestMatch.name || "Unknown",
            present: true,
            status: "present",
            method: "manual",
            recordTime: new Date(),
            timestamp: new Date(),
            matchPercentage: (1 - bestDistance) * 100,
          };

          // Update local state immediately
          setAttendanceRecords((prev) => [...prev, newRecord]);

          // Save to API in the background
          saveAttendanceRecord(bestMatch, bestDistance);
        } else {
          toast.info(`${bestMatch.name} đã được điểm danh rồi`);
        }

        // Atualizar o canvas principal com o resultado
        if (canvasRef.current) {
          const mainCtx = canvasRef.current.getContext("2d");
          mainCtx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
          mainCtx.drawImage(tempCanvas, 0, 0);
        }
      } else {
        // Nenhum estudante correspondente encontrado - mostrar feedback
        toast.warning(
          "Không nhận diện được sinh viên nào với độ chính xác đủ cao"
        );

        // Mostrar informações sobre as melhores correspondências
        if (allDistances.length > 0) {
          console.log("Best potential matches:");
          allDistances.slice(0, 3).forEach((match, idx) => {
            console.log(
              `${idx + 1}. ${match.name}: ${(match.distance * 100).toFixed(
                1
              )}% difference`
            );
          });

          // Desenhar mensagem no canvas
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

            // Copiar toda a visualização de detecção facial
            ctx.drawImage(tempCanvas, 0, 0);

            // Adicionar uma sobreposição para indicar falha no reconhecimento
            ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
            ctx.fillRect(
              detection.box.x,
              detection.box.y,
              detection.box.width,
              detection.box.height
            );

            // Texto de aviso
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3;
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            const text = "Không nhận diện được";
            const textX = detection.box.x + detection.box.width / 2;
            const textY = detection.box.y - 10;

            // Desenhar texto com contorno preto para legibilidade
            ctx.strokeText(text, textX, textY);
            ctx.fillText(text, textX, textY);
          }
        }
      }
    } catch (error) {
      console.error("Lỗi khi nhận diện khuôn mặt:", error);
      setError("Lỗi nhận diện khuôn mặt: " + error.message);
    } finally {
      setIsRecognizing(false);
    }
  };

  const startAttendance = async () => {
    if (!selectedSession) {
      setError("Vui lòng chọn buổi học");
      return;
    }

    if (!selectedClass) {
      setError("Vui lòng chọn lớp học");
      return;
    }

    // Kiểm tra xem đã tải mô hình chưa
    if (!modelsLoaded) {
      try {
        console.log(
          "Đang tải mô hình face-api.js trước khi bắt đầu điểm danh..."
        );
        const loaded = await loadModels();
        if (!loaded) {
          setError(
            "Không thể tải mô hình nhận diện khuôn mặt. Vui lòng tải lại trang."
          );
          return;
        }
      } catch (modelError) {
        setError("Lỗi khi tải mô hình: " + modelError.message);
        return;
      }
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

      // Luôn tạo điểm danh cục bộ trước, không phụ thuộc vào API
      const localAttendanceObj = {
        _id: `local_${Date.now()}`,
        class: selectedClass,
        sessionNumber: selectedSession.sessionNumber,
        date: selectedSession.date,
        status: "in-progress",
        isLocal: true, // Flag to indicate this is a local object
      };

      console.log("Created local attendance session:", localAttendanceObj);

      // Cập nhật state trước
      await new Promise((resolve) => {
        setCurrentAttendance(localAttendanceObj);
        // Đợi một chút để đảm bảo state đã được cập nhật
        setTimeout(resolve, 100);
      });

      // Bắt đầu camera sau khi currentAttendance đã được thiết lập
      await startCamera();

      // Gọi API trong background để đồng bộ nếu có thể, nhưng không phụ thuộc vào kết quả
      try {
        // Sử dụng API /api/attendance/start hoạt động theo mã server
        const payload = {
          classId: selectedClass,
          sessionNumber: selectedSession.sessionNumber,
          date: selectedSession.date,
        };

        console.log("Sending attendance payload to API:", payload);

        const response = await axios.post("/api/attendance/start", payload);
        console.log("API attendance created successfully:", response.data);

        if (response.data && response.data._id) {
          // Cập nhật với object thật từ API nhưng giữ trạng thái điểm danh cục bộ
          setCurrentAttendance({
            ...response.data,
            isApiLinked: true,
          });
        }
      } catch (apiError) {
        // Nếu API chính không hoạt động, thử một phương pháp thay thế
        console.log("Primary API failed, using alternate method:", apiError);

        try {
          // Thử phương pháp thứ hai
          const alternateResponse = await axios.post("/api/attendance", {
            classId: selectedClass,
            sessionNumber: selectedSession.sessionNumber,
            date: selectedSession.date,
            status: "in-progress",
            students: [],
          });

          if (alternateResponse.data && alternateResponse.data._id) {
            console.log("Alternate API succeeded:", alternateResponse.data);
            setCurrentAttendance({
              ...alternateResponse.data,
              isApiLinked: true,
            });
          }
        } catch (alternateError) {
          // Vẫn giữ điểm danh cục bộ nếu tất cả API thất bại
          console.log(
            "All API methods failed, continuing with local attendance:",
            alternateError
          );
          // Không hiển thị lỗi cho người dùng vì chúng ta vẫn có điểm danh cục bộ
        }
      }

      // Thiết lập hẹn giờ tự động hoàn thành điểm danh sau 60 phút
      setTimeout(() => {
        if (currentAttendance && currentAttendance.status !== "completed") {
          completeAttendance();
        }
      }, 60 * 60 * 1000); // 60 phút

      // Reset danh sách sinh viên đã nhận diện khi bắt đầu phiên điểm danh mới
      setRecognizedStudentIds([]);
    } catch (error) {
      console.error("Error in attendance process:", error);
      setError("Lỗi khi bắt đầu điểm danh: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cải thiện hàm completeAttendance để kết thúc điểm danh trên server
  const completeAttendance = async () => {
    console.log("Kết thúc buổi điểm danh...");

    if (!currentAttendance) {
      toast.error("Không có buổi điểm danh nào đang diễn ra");
      return;
    }

    try {
      setLoading(true);
      const sessionId = currentAttendance._id;
      const classId = selectedClass;
      const sessionNumber = selectedSession?.sessionNumber;

      console.log("Kết thúc điểm danh với thông tin:", {
        sessionId,
        classId,
        sessionNumber,
        currentAttendance,
      });

      // Dừng camera
      stopCamera();

      // Đánh dấu tất cả sinh viên không có mặt là vắng mặt
      const studentsNotPresent = students.filter(
        (student) =>
          !attendanceRecords.some(
            (record) =>
              (record.student === student._id ||
                record.studentId === student.studentId) &&
              (record.present === true || record.status === "present")
          )
      );

      // Thêm bản ghi vắng mặt vào state
      if (studentsNotPresent.length > 0) {
        console.log(`Đánh dấu ${studentsNotPresent.length} sinh viên vắng mặt`);
        const absentRecords = studentsNotPresent.map((student) => ({
          _id: `absent_${student._id}_${Date.now()}`,
          student: student._id,
          studentId: student.studentId,
          name: student.name,
          present: false,
          status: "absent",
          method: "system",
          timestamp: new Date().toISOString(),
          absent: true,
          classSession: sessionId || "unknown",
          verified: true,
          localRecord: true,
        }));

        setAttendanceRecords((prev) => [...prev, ...absentRecords]);
      }

      // Nếu không có sessionId từ server, tạo mới phiên điểm danh trước khi hoàn thành
      let finalSessionId = sessionId;

      if (
        !sessionId ||
        sessionId.startsWith("local_") ||
        sessionId.startsWith("temp_")
      ) {
        try {
          console.log(
            "Tạo phiên điểm danh mới trên server trước khi kết thúc..."
          );
          const response = await axios.post("/api/attendance/start", {
            classId: classId,
            sessionNumber: sessionNumber,
            date: new Date().toISOString().split("T")[0],
          });

          if (response.data && response.data._id) {
            finalSessionId = response.data._id;
            console.log("Tạo phiên điểm danh thành công:", finalSessionId);
            setCurrentAttendance(response.data);

            // Cập nhật trạng thái cho tất cả sinh viên
            for (const record of attendanceRecords) {
              if (record.present === true || record.status === "present") {
                try {
                  // Cập nhật API với tham số mới
                  await axios.put(
                    `/api/attendance/${finalSessionId}/student/${record.student}`,
                    {
                      present: true,
                      method: record.method || "manual",
                    }
                  );
                  console.log(
                    `Đã cập nhật trạng thái có mặt cho ${record.name}`
                  );
                } catch (updateError) {
                  console.error(
                    `Không thể cập nhật trạng thái cho ${record.name}:`,
                    updateError
                  );
                }
              }
            }
          } else {
            console.error("Không nhận được ID phiên từ server");
            finishLocalAttendance();
            return;
          }
        } catch (error) {
          console.error("Không thể tạo phiên điểm danh:", error);
          finishLocalAttendance();
          return;
        }
      } else {
        // Nếu đã có sessionId từ server, đồng bộ các bản ghi cục bộ chưa được đồng bộ
        const recordsToSync = attendanceRecords.filter(
          (r) => r.localRecord || r.pendingSync
        );

        if (recordsToSync.length > 0) {
          console.log(`Đồng bộ ${recordsToSync.length} bản ghi lên server...`);

          for (const record of recordsToSync) {
            if (record.present === true || record.status === "present") {
              try {
                // Cập nhật API với tham số mới
                await axios.put(
                  `/api/attendance/${finalSessionId}/student/${record.student}`,
                  {
                    present: true,
                    method: record.method || "manual",
                  }
                );
                console.log(`Đã cập nhật trạng thái có mặt cho ${record.name}`);
              } catch (updateError) {
                console.error(
                  `Không thể cập nhật trạng thái cho ${record.name}:`,
                  updateError
                );
              }
            }
          }
        }
      }

      // Hoàn thành phiên điểm danh trên server - Cập nhật API mới
      try {
        // Gọi API hoàn thành điểm danh
        const completeResponse = await axios.put(
          `/api/teacher/attendance/${finalSessionId}/complete`,
          { endTime: new Date() }
        );

        if (completeResponse.data) {
          console.log(
            "Hoàn thành phiên điểm danh thành công:",
            completeResponse.data
          );
          // Cập nhật state với phiên đã hoàn thành
          setCurrentAttendance((prev) => ({
            ...prev,
            status: "completed",
            completedAt: new Date().toISOString(),
          }));

          toast.success("Đã hoàn thành buổi điểm danh");
        }
      } catch (error) {
        console.error("Không thể hoàn thành phiên điểm danh:", error);

        // Vẫn cập nhật state cục bộ
        setCurrentAttendance((prev) => ({
          ...prev,
          status: "completed",
          completedAt: new Date().toISOString(),
        }));

        toast.error(
          "Không thể hoàn thành phiên điểm danh trên server, nhưng đã lưu cục bộ"
        );
      }

      // Làm mới dữ liệu
      fetchAttendanceRecords();
      fetchAttendanceStats();
    } catch (error) {
      console.error("Lỗi khi hoàn thành điểm danh:", error);
      toast.error(`Lỗi khi hoàn thành điểm danh: ${error.message}`);

      // Hoàn thành điểm danh cục bộ nếu có lỗi
      finishLocalAttendance();
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý kết thúc điểm danh cục bộ không cần API
  const finishLocalAttendance = () => {
    try {
      // Cập nhật trạng thái điểm danh
      setCurrentAttendance((prev) => ({
        ...prev,
        status: "completed",
        endTime: new Date(),
        completedLocally: true,
      }));

      // Dừng camera
      stopCamera();

      // Thông báo thành công
      toast.success("Đã kết thúc buổi điểm danh ở chế độ ngoại tuyến");

      // Reset danh sách sinh viên đã nhận diện
      setRecognizedStudentIds([]);

      console.log("Kết thúc điểm danh cục bộ thành công");
    } catch (error) {
      console.error("Lỗi khi kết thúc điểm danh cục bộ:", error);
      toast.error("Lỗi khi kết thúc điểm danh cục bộ: " + error.message);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h5 className="font-semibold text-lg">Thiết lập điểm danh</h5>
          </div>
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Chọn lớp học:</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={loading || currentAttendance}
              >
                <option value="">-- Chọn lớp học --</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.code} - {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedClass && schedule.length > 0 && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Chọn buổi học:
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSession ? selectedSession.sessionNumber : ""}
                  onChange={(e) => {
                    const session = schedule.find(
                      (s) => s.sessionNumber === parseInt(e.target.value)
                    );
                    setSelectedSession(session);
                  }}
                  disabled={loading || currentAttendance}
                >
                  <option value="">-- Chọn buổi học --</option>
                  {schedule.map((session) => (
                    <option
                      key={session.sessionNumber}
                      value={session.sessionNumber}
                    >
                      Buổi {session.sessionNumber} -{" "}
                      {new Date(session.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-between">
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={startAttendance}
                disabled={
                  loading ||
                  !selectedClass ||
                  !selectedSession ||
                  currentAttendance
                }
              >
                <span className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Bắt đầu điểm danh
                </span>
              </button>

              {currentAttendance && (
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={completeAttendance}
                  disabled={loading}
                >
                  <span className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Kết thúc điểm danh
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-cyan-600 text-white px-4 py-3">
            <h5 className="font-semibold text-lg">Trạng thái điểm danh</h5>
          </div>
          <div className="p-4">
            {!modelsLoaded ? (
              <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4">
                <div className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
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
                  <span>
                    {modelLoadingStatus || "Đang tải mô hình nhận diện..."}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4">
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Mô hình nhận diện đã sẵn sàng!</span>
                </div>
              </div>
            )}

            {currentAttendance && (
              <div className="mt-4">
                <h6 className="font-semibold text-gray-700">
                  Buổi điểm danh đang diễn ra:
                </h6>
                <p className="mt-2">
                  <span className="font-medium text-gray-700">Trạng thái:</span>{" "}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      currentAttendance.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {currentAttendance.status === "completed"
                      ? "Đã kết thúc"
                      : "Đang diễn ra"}
                  </span>
                </p>
                <p className="mt-2">
                  <span className="font-medium text-gray-700">
                    Số sinh viên đã điểm danh:
                  </span>{" "}
                  {
                    attendanceRecords.filter(
                      (r) => r.present || r.status === "present"
                    ).length
                  }
                  /{students.length}
                </p>
                <div className="mt-3 flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDetectionEnabled}
                      onChange={() =>
                        setAutoDetectionEnabled(!autoDetectionEnabled)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-sm font-medium text-gray-700">
                      Tự động nhận diện
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {currentAttendance && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div className="bg-gray-800 text-white px-4 py-3">
                  <h5 className="font-semibold text-lg">Camera điểm danh</h5>
                </div>
                <div className="p-0 relative" style={{ minHeight: "400px" }}>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto max-h-[480px]"
                    ></video>
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full z-10"
                    ></canvas>
                  </div>

                  {!isCameraStarted && (
                    <div className="flex justify-center items-center absolute inset-0 bg-black bg-opacity-60 z-20">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg flex items-center"
                        onClick={startCamera}
                      >
                        <FiCamera className="mr-2 h-6 w-6" /> Bật camera
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 bg-gray-100 flex justify-between">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={detectSingleFace}
                    disabled={!isCameraStarted || isRecognizing}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Nhận diện thủ công
                  </button>

                  {isCameraStarted && (
                    <button
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center"
                      onClick={stopCamera}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.293 1.293a1 1 0 011.414 0l.293.293V7a1 1 0 012 0v6a1 1 0 01-2 0v-.586l-.293.293a1 1 0 01-1.414-1.414l2-2a1 1 0 010 1.414l-2-2a1 1 0 010-1.414z" />
                      </svg>
                      Tắt camera
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">Danh sách sinh viên</h5>
                </div>
                <div
                  className="card-body p-0"
                  style={{ maxHeight: "400px", overflowY: "auto" }}
                >
                  <ul className="list-group list-group-flush">
                    {students.map((student) => {
                      const isPresent = attendanceRecords.some(
                        (record) =>
                          (record.student === student._id ||
                            record.studentId === student.studentId) &&
                          (record.present || record.status === "present")
                      );

                      return (
                        <li
                          key={student._id}
                          className={`list-group-item d-flex justify-content-between align-items-center ${
                            isPresent ? "list-group-item-success" : ""
                          }`}
                        >
                          <div>
                            <strong>{student.studentId}</strong> -{" "}
                            {student.name}
                            {isPresent && (
                              <span className="badge bg-success ms-2">
                                <i className="bi bi-check-lg"></i> Có mặt
                              </span>
                            )}
                          </div>
                          {!isPresent && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => markStudentPresent(student)}
                              disabled={isProcessingAttendance}
                            >
                              Điểm danh thủ công
                            </button>
                          )}
                        </li>
                      );
                    })}

                    {students.length === 0 && (
                      <li className="list-group-item text-center">
                        {loading ? (
                          <div
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></div>
                        ) : (
                          "Không có sinh viên trong lớp hoặc chưa chọn lớp học"
                        )}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {currentAttendance.status === "completed" &&
            attendanceRecords.length > 0 && (
              <div className="row mt-4">
                <div className="col-12">
                  <div className="card">
                    <div className="card-header bg-info text-white">
                      <h5 className="mb-0">Kết quả điểm danh</h5>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-bordered table-hover">
                          <thead className="table-dark">
                            <tr>
                              <th>MSSV</th>
                              <th>Họ tên</th>
                              <th>Trạng thái</th>
                              <th>Phương thức</th>
                              <th>Thời gian</th>
                              <th>Độ tin cậy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceRecords.map((record) => (
                              <tr
                                key={record._id}
                                className={
                                  record.present || record.status === "present"
                                    ? "table-success"
                                    : "table-danger"
                                }
                              >
                                <td>{record.studentId}</td>
                                <td>{record.name}</td>
                                <td>
                                  {record.present ||
                                  record.status === "present" ? (
                                    <span className="badge bg-success">
                                      Có mặt
                                    </span>
                                  ) : (
                                    <span className="badge bg-danger">
                                      Vắng mặt
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {record.method === "auto" ? (
                                    <span className="badge bg-info">
                                      Tự động
                                    </span>
                                  ) : (
                                    <span className="badge bg-warning">
                                      Thủ công
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {record.recordTime
                                    ? new Date(
                                        record.recordTime
                                      ).toLocaleTimeString()
                                    : "N/A"}
                                </td>
                                <td>
                                  {record.matchPercentage
                                    ? `${Math.round(record.matchPercentage)}%`
                                    : record.method === "manual"
                                    ? "100%"
                                    : "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
};

export default Attendance;
