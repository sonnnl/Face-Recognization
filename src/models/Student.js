import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  studentId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  faceImage: {
    type: String,
    required: false,
  },
  faceFeatures: {
    type: [Number],
    required: false,
  },
  classes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },
  ],
  adminClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AdminClass",
    default: null,
  },
  mainClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware sau khi cập nhật hoặc lưu sinh viên, cập nhật số lượng sinh viên trong AdminClass
studentSchema.post("save", async function () {
  if (this.adminClass) {
    try {
      const AdminClass = mongoose.model("AdminClass");
      await AdminClass.updateStudentCount(this.adminClass);
    } catch (error) {
      console.error("Error updating student count:", error);
    }
  }
});

// Middleware sau khi cập nhật adminClass của sinh viên
studentSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return;

  // Nếu adminClass đã thay đổi, cập nhật cả adminClass cũ và mới
  const update = this.getUpdate();
  if (update && update.$set && update.$set.adminClass) {
    try {
      const AdminClass = mongoose.model("AdminClass");

      // Cập nhật số lượng ở lớp mới
      await AdminClass.updateStudentCount(update.$set.adminClass);

      // Cập nhật số lượng ở lớp cũ nếu tồn tại
      if (
        doc.adminClass &&
        doc.adminClass.toString() !== update.$set.adminClass.toString()
      ) {
        await AdminClass.updateStudentCount(doc.adminClass);
      }
    } catch (error) {
      console.error(
        "Error updating student counts after adminClass change:",
        error
      );
    }
  }
});

export default mongoose.model("Student", studentSchema);
