import mongoose from "mongoose";
import bcrypt from "bcrypt";

const accountSchema = new mongoose.Schema({
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
  },
  status: {
    type: String,
    enum: ["active", "pending", "blocked", "temporary"],
    default: "active", // Admin vẫn mặc định là active
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
  // Thêm tham chiếu đến Student nếu là tài khoản sinh viên
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    default: null,
  },
});

// Mã hóa mật khẩu trước khi lưu
accountSchema.pre("save", async function (next) {
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
accountSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Không trả về mật khẩu khi chuyển đổi sang JSON
accountSchema.methods.toJSON = function () {
  const accountObject = this.toObject();
  delete accountObject.password;
  return accountObject;
};

export default mongoose.model("Account", accountSchema);
