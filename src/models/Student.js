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
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  faceFeatures: {
    type: [Number],
    validate: {
      validator: function (features) {
        return features.length === 128;
      },
      message: (props) =>
        `Face features must have exactly 128 values, got ${props.value.length}`,
    },
    required: true,
  },
  faceImage: {
    type: String, // Lưu ảnh dưới dạng base64 string
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Tạo index cho class và studentId để tìm kiếm nhanh hơn
studentSchema.index({ class: 1 });
studentSchema.index({ studentId: 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
