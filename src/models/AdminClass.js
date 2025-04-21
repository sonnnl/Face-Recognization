import mongoose from "mongoose";

const adminClassSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true,
  },
  mainTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    description:
      "The main teacher responsible for managing this administrative class",
  },
  entryYear: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  studentCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Phương thức tĩnh để cập nhật số lượng sinh viên trong lớp
adminClassSchema.statics.updateStudentCount = async function (adminClassId) {
  try {
    const Student = mongoose.model("Student");
    const Account = mongoose.model("Account");

    // Lấy tất cả sinh viên trong lớp
    const students = await Student.find({ adminClass: adminClassId });

    if (students.length === 0) {
      await this.findByIdAndUpdate(adminClassId, { studentCount: 0 });
      return 0;
    }

    // Lấy ID của tất cả sinh viên
    const studentIds = students.map((student) => student._id);

    // Tìm tài khoản pending liên kết với các sinh viên
    const pendingAccounts = await Account.find({
      studentId: { $in: studentIds },
      status: "pending",
    });

    // Lấy danh sách ID của sinh viên có tài khoản pending
    const pendingStudentIds = pendingAccounts
      .map((account) =>
        account.studentId ? account.studentId.toString() : null
      )
      .filter((id) => id !== null);

    // Đếm số sinh viên đã được duyệt (không có trong danh sách pending)
    const activeCount = students.filter(
      (student) => !pendingStudentIds.includes(student._id.toString())
    ).length;

    await this.findByIdAndUpdate(adminClassId, { studentCount: activeCount });
    return activeCount;
  } catch (error) {
    console.error("Error updating student count for AdminClass:", error);
    throw error;
  }
};

export default mongoose.model("AdminClass", adminClassSchema);
