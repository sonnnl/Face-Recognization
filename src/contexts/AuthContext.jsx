import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "../config/axios";
import { useNavigate } from "react-router-dom";

// Tạo context
export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // Kiểm tra xem user đã đăng nhập chưa
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("token");

      if (token) {
        // Đặt token vào header
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        try {
          // Kiểm tra token hợp lệ
          const response = await axios.get("/api/auth/me");
          console.log("Me API response:", response.data);
          setCurrentUser(response.data.account);
        } catch (error) {
          console.error("Token không hợp lệ:", error);
          // Xóa token nếu không hợp lệ
          localStorage.removeItem("token");
          localStorage.removeItem("account");
          delete axios.defaults.headers.common["Authorization"];
        }
      }

      setLoading(false);
    };

    checkLoggedIn();
  }, []);

  // Đăng nhập
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post("/api/auth/login", { email, password });

      const { token, account } = response.data;
      console.log("Login response:", response.data);

      // Lưu token và thông tin người dùng
      localStorage.setItem("token", token);
      localStorage.setItem("account", JSON.stringify(account));

      // Đặt header cho axios
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Đặt thông tin người dùng vào context và đợi state được cập nhật
      return new Promise((resolve) => {
        setCurrentUser(account);
        console.log("Current user set in context:", account);
        // Sử dụng setTimeout để đảm bảo state đã cập nhật
        setTimeout(() => resolve(true), 100);
      });
    } catch (error) {
      console.error("Đăng nhập thất bại:", error);

      if (error.response) {
        setError(error.response.data.message || "Đăng nhập thất bại");
      } else {
        setError("Lỗi kết nối server");
      }

      return false;
    }
  };

  // Đăng ký admin
  const registerAdmin = async (fullName, email, password) => {
    try {
      setError(null);
      const response = await axios.post("/api/auth/register", {
        name: fullName,
        email,
        password,
        role: "admin",
      });

      console.log("Đăng ký admin thành công:", response.data);
      return true;
    } catch (error) {
      console.error("Đăng ký admin thất bại:", error);

      if (error.response) {
        setError(error.response.data.message || "Đăng ký thất bại");
      } else {
        setError("Lỗi kết nối server");
      }

      return false;
    }
  };

  // Đăng xuất
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("account");
    delete axios.defaults.headers.common["Authorization"];
    setCurrentUser(null);
    navigate("/login");
  };

  // Kiểm tra quyền admin
  const isAdmin = () => {
    if (!currentUser) return false;

    console.log("Checking admin status:", currentUser);
    console.log("User role:", currentUser.role);

    return currentUser.role === "admin";
  };

  // Kiểm tra tài khoản có active không
  const isActive = () => {
    if (!currentUser) return false;
    return currentUser.status === "active";
  };

  // Đăng nhập bằng Google
  const loginWithGoogle = async (googleToken) => {
    try {
      console.log("Attempting Google login with token");
      const response = await axios.post("/api/auth/google", { googleToken });
      console.log("Google login API response:", response.data);

      // Lưu token và set current user nếu đăng nhập thành công
      localStorage.setItem("token", response.data.token);
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;
      setCurrentUser(response.data.user);
      return response.data;
    } catch (error) {
      console.error("Google login failed:", error);

      // Kiểm tra xem lỗi có phải do tài khoản đang chờ duyệt hay không
      if (error.response?.data?.isPending) {
        throw {
          pendingAccount: true,
          message: error.response.data.message,
        };
      }
      throw error;
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    isAdmin,
    isActive,
    registerAdmin,
    loginWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
