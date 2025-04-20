import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// Component kiểm tra tài khoản tạm thời và chuyển hướng đến trang đăng ký
const TemporaryAccountRedirect = ({ children }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Nếu không có người dùng hoặc đang ở trang login, không làm gì cả
    if (!currentUser || window.location.pathname === "/login") {
      return;
    }

    // Kiểm tra xem tài khoản có phải là temporary không
    if (currentUser.status === "temporary") {
      console.log("Phát hiện tài khoản tạm thời:", currentUser.role);

      if (currentUser.role === "student") {
        console.log("Chuyển hướng đến trang đăng ký sinh viên");
        navigate("/student-register");
      } else if (currentUser.role === "teacher") {
        console.log("Chuyển hướng đến trang đăng ký giảng viên");
        navigate("/teacher-register");
      }
    }

    // Kiểm tra xem tài khoản có ở trạng thái pending không
    if (
      currentUser.status === "pending" &&
      window.location.pathname !== "/pending-account"
    ) {
      console.log("Tài khoản đang chờ duyệt, chuyển hướng đến trang thông báo");
      navigate("/pending-account");
    }
  }, [currentUser, navigate]);

  return <>{children}</>;
};

export default TemporaryAccountRedirect;
