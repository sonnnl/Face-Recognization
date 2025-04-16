import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

// Secret key for JWT - nên đặt trong biến môi trường
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-123456789";

// Middleware để xác thực người dùng
export const auth = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Vui lòng đăng nhập." });
    }

    // Xác minh token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Tìm tài khoản theo ID
    const account = await Account.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
    }

    // Kiểm tra tài khoản có active hay không
    if (account.status !== "active") {
      return res.status(403).json({
        message:
          "Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ quản trị viên.",
      });
    }

    // Thêm thông tin tài khoản vào request
    req.account = account;
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn." });
    }

    res.status(401).json({ message: "Vui lòng đăng nhập lại." });
  }
};

// Middleware để kiểm tra vai trò admin
export const adminOnly = (req, res, next) => {
  if (!req.account || req.account.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Bạn không có quyền thực hiện thao tác này." });
  }

  next();
};

// Hàm tạo JWT token
export const generateToken = (accountId) => {
  return jwt.sign({ id: accountId }, JWT_SECRET, { expiresIn: "7d" });
};

export default { auth, adminOnly, generateToken, JWT_SECRET };
