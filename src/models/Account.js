import mongoose from "mongoose";
import bcrypt from "bcrypt";

const accountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
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
    required: true,
    minlength: 6,
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ["teacher", "admin"],
    default: "teacher",
  },
  status: {
    type: String,
    enum: ["active", "inactive", "pending", "blocked"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
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
