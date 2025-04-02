import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Register from "./components/Register";
import Attendance from "./components/Attendance";
import AttendanceList from "./components/AttendanceList";
import ClassList from "./components/ClassList";
import StudentList from "./components/StudentList";

function App() {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-800">
                    Hệ thống điểm danh khuôn mặt
                  </h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    to="/register"
                    className={`${
                      activeTab === "register"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={() => setActiveTab("register")}
                  >
                    Đăng ký
                  </Link>
                  <Link
                    to="/attendance"
                    className={`${
                      activeTab === "attendance"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={() => setActiveTab("attendance")}
                  >
                    Điểm danh
                  </Link>
                  <Link
                    to="/classes"
                    className={`${
                      activeTab === "classes"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={() => setActiveTab("classes")}
                  >
                    Quản lý lớp
                  </Link>
                  <Link
                    to="/students"
                    className={`${
                      activeTab === "students"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={() => setActiveTab("students")}
                  >
                    Danh sách sinh viên
                  </Link>
                  <Link
                    to="/attendance-list"
                    className={`${
                      activeTab === "attendance-list"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    onClick={() => setActiveTab("attendance-list")}
                  >
                    Lịch sử điểm danh
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/classes" element={<ClassList />} />
            <Route path="/students" element={<StudentList />} />
            <Route path="/attendance-list" element={<AttendanceList />} />
            <Route path="/" element={<Register />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
