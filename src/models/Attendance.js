import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  sessionNumber: { type: Number, required: true }, // Số buổi học
  date: { type: Date, required: true },
  // Removing embedded students array, will use AttendanceRecord model instead
  status: {
    type: String,
    enum: ["in_progress", "completed"],
    default: "in_progress",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account", // Changed from "Teacher" to "Account"
  },
  createdAt: { type: Date, default: Date.now },
  startTime: { type: Date },
  endTime: { type: Date },
  title: { type: String },
  description: { type: String },
  location: { type: String },
  // Stats fields (will be updated when the attendance session is completed)
  stats: {
    totalStudents: { type: Number, default: 0 },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 }, // Percentage
  },
});

// Method to finalize attendance and calculate statistics
attendanceSchema.methods.finalize = async function () {
  const AttendanceRecord = mongoose.model("AttendanceRecord");
  const Class = mongoose.model("Class");

  // Get the class
  const classDoc = await Class.findById(this.class);
  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Get all attendance records for this session
  const records = await AttendanceRecord.find({ attendance: this._id });

  // Calculate statistics
  const totalStudents = records.length;
  const presentCount = records.filter((record) => record.present).length;
  const absentCount = totalStudents - presentCount;
  const attendanceRate =
    totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

  // Update statistics
  this.stats = {
    totalStudents,
    presentCount,
    absentCount,
    attendanceRate,
  };

  // Mark as completed
  this.status = "completed";

  // If there's an end time, set it
  if (!this.endTime) {
    this.endTime = new Date();
  }

  return this.save();
};

// Tạo index cho class và sessionNumber để đảm bảo không có hai bản ghi điểm danh cho cùng một lớp và cùng một buổi
attendanceSchema.index({ class: 1, sessionNumber: 1 }, { unique: true });

// Bỏ các index không cần thiết từ các phiên bản cũ
// (Các index sẽ tự động được xóa khi khởi động server)

export default mongoose.model("Attendance", attendanceSchema);
