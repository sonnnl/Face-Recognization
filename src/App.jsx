import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Register from "./components/Register";
import Attendance from "./components/Attendance";
import AttendanceList from "./components/AttendanceList";
import ClassList from "./components/ClassList";
import StudentList from "./components/StudentList";
import AttendanceHistory from "./components/AttendanceHistory";
import Login from "./components/Login";
import AdminRegister from "./components/AdminRegister";
import RegisterFirstAdmin from "./components/RegisterFirstAdmin";
import StudentRegister from "./components/StudentRegister";
import TeacherRegister from "./components/TeacherRegister";
import PendingAccountPage from "./components/PendingAccountPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
// Import Admin components
import AdminDashboard from "./components/admin/AdminDashboard";
import AccountManagement from "./components/admin/AccountManagement";
import ClassManagement from "./components/admin/ClassManagement";
import DepartmentManagement from "./components/admin/DepartmentManagement";
import AdminClassManagement from "./components/admin/AdminClassManagement";
import StudentManagement from "./components/admin/StudentManagement";
import MainClassStudentManagement from "./components/admin/MainClassStudentManagement";
import TemporaryAccountRedirect from "./components/TemporaryAccountRedirect";

// Thay YOUR_GOOGLE_CLIENT_ID bằng ID thật từ Google Cloud Console
const GOOGLE_CLIENT_ID =
  "100534880319-vs2rdo9iapvie4phdcnqi6gh10mjb79r.apps.googleusercontent.com";

function AppContent() {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();

  // Kiểm tra xem có đang đăng nhập không
  const isLoggedIn = !!currentUser;

  // Kiểm tra xem giáo viên đã hoàn tất đăng ký thông tin chưa
  // Lưu ý: Tài khoản tạm thời sẽ được xử lý bởi TemporaryAccountRedirect
  const isTeacherWithoutProfile =
    isLoggedIn &&
    currentUser.role === "teacher" &&
    currentUser.status === "temporary";

  // Những trang không hiển thị navbar
  const noNavbarRoutes = [
    "/student-register",
    "/pending-account",
    "/teacher-register",
  ];
  const shouldShowNavbar = !noNavbarRoutes.includes(location.pathname);

  return (
    <TemporaryAccountRedirect>
      <div className="min-h-screen bg-gray-100">
        <ToastContainer position="top-right" autoClose={3000} />
        {shouldShowNavbar && <Navbar />}

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/admin-register" element={<AdminRegister />} />
            <Route
              path="/register-first-admin"
              element={<RegisterFirstAdmin />}
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teachers"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AccountManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute adminOnly={true}>
                  <ClassManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/departments"
              element={
                <ProtectedRoute adminOnly={true}>
                  <DepartmentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/admin-classes"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminClassManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin-classes"
              element={
                <ProtectedRoute>
                  <AdminClassManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute adminOnly={true}>
                  <StudentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/admin-classes/:classId/students"
              element={
                <ProtectedRoute adminOnly={true}>
                  <MainClassStudentManagement />
                </ProtectedRoute>
              }
            />

            {/* Teacher routes */}
            <Route
              path="/teacher-register"
              element={
                <ProtectedRoute>
                  <TeacherRegister />
                </ProtectedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute>
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute>
                  <Attendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <ClassList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <StudentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance-list"
              element={
                <ProtectedRoute>
                  <AttendanceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <AttendanceHistory />
                </ProtectedRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="/student-register"
              element={
                <ProtectedRoute>
                  <StudentRegister />
                </ProtectedRoute>
              }
            />

            {/* Pending account page */}
            <Route path="/pending-account" element={<PendingAccountPage />} />

            {/* Redirect home based on auth state */}
            <Route
              path="/"
              element={
                isLoggedIn ? (
                  isAdmin() ? (
                    <Navigate to="/admin" />
                  ) : isTeacherWithoutProfile ? (
                    <Navigate to="/teacher-register" />
                  ) : (
                    <Navigate to="/classes" />
                  )
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </TemporaryAccountRedirect>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
