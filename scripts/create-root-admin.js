import mongoose from "mongoose";
import Account from "../src/models/Account.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

// Load biến môi trường
dotenv.config();

// Thông tin admin gốc
const ROOT_ADMIN = {
  name: "System Admin",
  email: "admin@system.com",
  password: "Admin@123",
  role: "admin",
  status: "active",
};

// Kết nối với MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/attendance")
  .then(() => console.log("Đã kết nối với MongoDB"))
  .catch((err) => {
    console.error("Lỗi kết nối MongoDB:", err);
    process.exit(1);
  });

const createRootAdmin = async () => {
  try {
    console.log("Bắt đầu tạo tài khoản admin hệ thống gốc...");

    // Kiểm tra xem tài khoản admin gốc đã tồn tại chưa
    const existingAdmin = await Account.findOne({ email: ROOT_ADMIN.email });

    if (existingAdmin) {
      console.log(
        `Tài khoản admin gốc với email ${ROOT_ADMIN.email} đã tồn tại.`
      );
      console.log("Thông tin tài khoản:");
      console.log(`- Tên: ${existingAdmin.name}`);
      console.log(`- Email: ${existingAdmin.email}`);
      console.log(`- Vai trò: ${existingAdmin.role}`);
      console.log(`- Trạng thái: ${existingAdmin.status}`);
      process.exit(0);
    }

    // Tạo mật khẩu hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ROOT_ADMIN.password, salt);

    // Tạo tài khoản admin gốc
    const rootAdmin = new Account({
      name: ROOT_ADMIN.name,
      email: ROOT_ADMIN.email,
      password: hashedPassword,
      role: ROOT_ADMIN.role,
      status: ROOT_ADMIN.status,
      createdAt: new Date(),
    });

    await rootAdmin.save();

    console.log("Đã tạo tài khoản admin hệ thống gốc thành công!");
    console.log("Thông tin đăng nhập:");
    console.log(`- Email: ${ROOT_ADMIN.email}`);
    console.log(`- Mật khẩu: ${ROOT_ADMIN.password}`);
  } catch (error) {
    console.error("Lỗi trong quá trình tạo admin gốc:", error);
  } finally {
    mongoose.disconnect();
    console.log("Đã ngắt kết nối với MongoDB.");
  }
};

// Chạy script
createRootAdmin();
