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
    const count = await Student.countDocuments({ adminClass: adminClassId });

    await this.findByIdAndUpdate(adminClassId, { studentCount: count });
    return count;
  } catch (error) {
    console.error("Error updating student count for AdminClass:", error);
    throw error;
  }
};

export default mongoose.model("AdminClass", adminClassSchema);
