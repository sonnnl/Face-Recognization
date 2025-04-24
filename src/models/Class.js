import mongoose from "mongoose";

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  description: {
    type: String,
    required: false,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
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
  isAdminClass: {
    type: Boolean,
    default: false,
    description:
      "Indicates if this is an administrative class (lớp quản lý) rather than a study class (lớp học)",
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null,
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campus",
    default: null,
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    default: null,
  },
  classroom: {
    room: {
      type: String,
      default: "",
    },
    floor: {
      type: String,
      default: "",
    },
    building: {
      type: String,
      default: "",
    },
  },
});

// Thêm virtual property để đồng bộ studentCount nếu cần
classSchema.virtual("calculatedStudentCount").get(function () {
  return this.students ? this.students.length : 0;
});

// Cải thiện: Middleware để đảm bảo studentCount luôn được cập nhật trước khi lưu
classSchema.pre("save", function (next) {
  if (this.students) {
    this.studentCount = this.students.length;
  }
  if (this.totalSessions && !this.maxAbsences) {
    this.maxAbsences = Math.ceil(this.totalSessions * 0.2);
  }
  next();
});

// Thêm middleware cho findOneAndUpdate để cập nhật studentCount
classSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  // Nếu có cập nhật mảng students, cập nhật studentCount
  if (update.$push && update.$push.students) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    update.$set = update.$set || {};
    update.$set.studentCount = (docToUpdate.students.length || 0) + 1;
  }

  // Nếu có xóa sinh viên khỏi mảng students
  if (update.$pull && update.$pull.students) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    update.$set = update.$set || {};
    update.$set.studentCount = Math.max(
      (docToUpdate.students.length || 0) - 1,
      0
    );
  }

  next();
});

// Thêm middleware để đồng bộ lại studentCount sau khi tìm kiếm
classSchema.post("find", function (docs) {
  if (!docs) return;

  docs.forEach((doc) => {
    if (doc.students && doc.studentCount !== doc.students.length) {
      doc.studentCount = doc.students.length;
      doc.save();
    }
  });
});

classSchema.post("findOne", function (doc) {
  if (!doc) return;

  if (doc.students && doc.studentCount !== doc.students.length) {
    doc.studentCount = doc.students.length;
    doc.save();
  }
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
