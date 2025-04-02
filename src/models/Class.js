import mongoose from "mongoose";

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: false,
  },
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },
  ],
  studentCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Thêm virtual property để đồng bộ studentCount nếu cần
classSchema.virtual("calculatedStudentCount").get(function () {
  return this.students ? this.students.length : 0;
});

// Middleware để đảm bảo studentCount luôn được cập nhật
classSchema.pre("save", function (next) {
  if (this.students) {
    this.studentCount = this.students.length;
  }
  next();
});

export default mongoose.model("Class", classSchema);
