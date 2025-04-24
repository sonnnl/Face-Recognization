import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Tạo schema cơ bản cho User (thay thế cho Account)
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Vui lòng nhập email"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Email không hợp lệ",
      ],
    },
    password: {
      type: String,
      trim: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "teacher",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "pending", "blocked", "temporary"],
      default: "active",
    },
    provider: {
      type: String,
      enum: ["credentials", "google"],
      default: "credentials",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    discriminatorKey: "role", // Sử dụng trường role làm discriminator
  }
);

// Mã hóa mật khẩu trước khi lưu
userSchema.pre("save", async function (next) {
  // Chỉ hash mật khẩu nếu được thay đổi hoặc là mới
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Phương thức kiểm tra mật khẩu
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Không trả về mật khẩu khi chuyển đổi sang JSON
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Model chính
const User = mongoose.model("User", userSchema);

// Tạo schema cho Admin
const adminSchema = new mongoose.Schema({
  adminType: {
    type: String,
    enum: ["system", "department"],
    default: "system",
  },
  permissions: {
    type: [String],
    default: [],
  },
});

// Tạo schema cho Teacher
const teacherSchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  academicTitle: {
    type: String,
    enum: ["Giảng viên", "Trợ giảng", "Tiến sĩ", "Phó giáo sư", "Giáo sư"],
    default: "Giảng viên",
  },
  degree: {
    type: String,
    enum: ["Cử nhân", "Thạc sĩ", "Tiến sĩ"],
  },
  bio: {
    type: String,
    default: "",
  },
});

// Tạo schema cho Student
const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    unique: true,
  },
  phone: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["male", "female"],
    default: "male",
  },
  address: {
    type: String,
  },
  faceImage: {
    type: String,
  },
  faceFeatures: {
    type: [Number],
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
  },
  active: {
    type: Boolean,
    default: true,
  },
});

// Tạo các model con dựa trên discriminator
export const Admin = User.discriminator("admin", adminSchema);
export const Teacher = User.discriminator("teacher", teacherSchema);
export const Student = User.discriminator("student", studentSchema);

export default User;
