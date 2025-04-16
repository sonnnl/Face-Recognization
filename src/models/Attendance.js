import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  sessionNumber: { type: Number, required: true }, // Số buổi học
  date: { type: Date, required: true },
  students: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      status: { type: String, enum: ["present", "absent"], required: true },
      score: { type: Number, default: 0 }, // Điểm trừ cho mỗi lần vắng
      isBanned: { type: Boolean, default: false }, // Trạng thái cấm thi
    },
  ],
  status: {
    type: String,
    enum: ["in_progress", "completed"],
    default: "in_progress",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
  },
  createdAt: { type: Date, default: Date.now },
});

// Tính điểm và cập nhật trạng thái cấm thi
attendanceSchema.methods.calculateScores = async function () {
  const Class = mongoose.model("Class");
  const classDoc = await Class.findById(this.class);

  // Lấy tất cả các buổi điểm danh đã hoàn thành của lớp
  const allAttendances = await this.constructor.find({
    class: this.class,
    status: "completed",
  });

  // Tính tổng số buổi vắng của mỗi sinh viên
  const studentAbsences = {};
  for (let att of allAttendances) {
    for (let student of att.students) {
      if (student.status === "absent") {
        studentAbsences[student.student] =
          (studentAbsences[student.student] || 0) + 1;
      }
    }
  }

  // Cập nhật điểm và trạng thái cấm thi cho từng sinh viên
  for (let student of this.students) {
    if (student.status === "absent") {
      student.score = -2; // Trừ 2 điểm cho mỗi buổi vắng
    }

    // Kiểm tra và cập nhật trạng thái cấm thi
    const totalAbsences = studentAbsences[student.student] || 0;
    student.isBanned = totalAbsences > classDoc.maxAbsences;
  }

  return this.save();
};

// Tạo index cho class và sessionNumber để đảm bảo không có hai bản ghi điểm danh cho cùng một lớp và cùng một buổi
attendanceSchema.index({ class: 1, sessionNumber: 1 }, { unique: true });

// Bỏ các index không cần thiết từ các phiên bản cũ
// (Các index sẽ tự động được xóa khi khởi động server)

export default mongoose.model("Attendance", attendanceSchema);
