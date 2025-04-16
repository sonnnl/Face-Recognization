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
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  totalSessions: {
    type: Number,
    required: true,
  },
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },
  ],
  schedule: [
    {
      sessionNumber: Number,
      date: Date,
      status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending",
      },
    },
  ],
  maxAbsences: {
    type: Number,
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

// Thêm virtual property để đồng bộ studentCount nếu cần
classSchema.virtual("calculatedStudentCount").get(function () {
  return this.students ? this.students.length : 0;
});

// Middleware để đảm bảo studentCount luôn được cập nhật
classSchema.pre("save", function (next) {
  if (this.students) {
    this.studentCount = this.students.length;
  }
  if (this.totalSessions && !this.maxAbsences) {
    this.maxAbsences = Math.ceil(this.totalSessions * 0.2);
  }
  next();
});

// Tạo lịch học tự động
classSchema.methods.generateSchedule = function () {
  const schedule = [];
  let currentDate = new Date(this.startDate);

  for (let i = 1; i <= this.totalSessions; i++) {
    schedule.push({
      sessionNumber: i,
      date: new Date(currentDate),
      status: "pending",
    });
    currentDate.setDate(currentDate.getDate() + 7);
  }

  this.schedule = schedule;
  return this.save();
};

export default mongoose.model("Class", classSchema);
