import mongoose from "mongoose";

/**
 * Model lưu thông tin sinh viên trong lớp học
 * Mối quan hệ nhiều-nhiều giữa Class và Student
 */
const classStudentSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    attendanceRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Tạo index để tối ưu truy vấn
classStudentSchema.index({ class: 1, student: 1 }, { unique: true });
classStudentSchema.index({ class: 1 });
classStudentSchema.index({ student: 1 });

const ClassStudent = mongoose.model("ClassStudent", classStudentSchema);

export default ClassStudent;
