import mongoose from "mongoose";

/**
 * Model lưu thông tin điểm danh của sinh viên trong một buổi điểm danh
 */
const attendanceRecordSchema = new mongoose.Schema(
  {
    // Liên kết đến buổi điểm danh
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
    },
    // Liên kết đến lớp học
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    // Liên kết đến sinh viên
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    // Trạng thái tham dự: true = có mặt, false = vắng mặt
    present: {
      type: Boolean,
      default: false,
    },
    // Thời gian điểm danh
    recordTime: {
      type: Date,
      default: Date.now,
    },
    // Phương thức điểm danh (face = nhận diện khuôn mặt, manual = thủ công, auto = tự động)
    method: {
      type: String,
      enum: ["face", "manual", "auto"],
      default: "manual",
    },
    // Tỷ lệ khớp khuôn mặt (nếu sử dụng face recognition)
    matchPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    // Hình ảnh khuôn mặt khi điểm danh (nếu có)
    capturedImage: {
      type: String,
    },
    // Ghi chú
    note: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Tạo index để tối ưu truy vấn
attendanceRecordSchema.index({ attendance: 1, student: 1 }, { unique: true });
attendanceRecordSchema.index({ attendance: 1 });
attendanceRecordSchema.index({ class: 1 });
attendanceRecordSchema.index({ student: 1 });
attendanceRecordSchema.index({ present: 1 });

const AttendanceRecord = mongoose.model(
  "AttendanceRecord",
  attendanceRecordSchema
);

export default AttendanceRecord;
