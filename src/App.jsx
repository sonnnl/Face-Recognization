import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
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
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
// Import Admin components
import AdminDashboard from "./components/admin/AdminDashboard";
import AccountManagement from "./components/admin/AccountManagement";
import ClassManagement from "./components/admin/ClassManagement";

// Thay YOUR_GOOGLE_CLIENT_ID bằng ID thật từ Google Cloud Console
const GOOGLE_CLIENT_ID =
  "100534880319-vs2rdo9iapvie4phdcnqi6gh10mjb79r.apps.googleusercontent.com";

function AppContent() {
  const { currentUser, isAdmin } = useAuth();

  // Kiểm tra xem có đang đăng nhập không
  const isLoggedIn = !!currentUser;

  return (
    <div className="min-h-screen bg-gray-100">
      <ToastContainer position="top-right" autoClose={3000} />
      <Navbar />

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

          {/* Teacher routes */}
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

          {/* Redirect home based on auth state */}
          <Route
            path="/"
            element={
              isLoggedIn ? (
                isAdmin() ? (
                  <Navigate to="/admin" />
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
