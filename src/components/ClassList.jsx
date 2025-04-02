import React, { useState, useEffect } from "react";
import axios from "../config/axios";

const ClassList = () => {
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingClass, setDeletingClass] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get("/api/classes");
      console.log("Fetched classes:", response.data);
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setError("Không thể tải danh sách lớp học");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/api/classes", {
        name: newClassName,
      });
      console.log("Created new class:", response.data);
      await fetchClasses(); // Refresh the list after creating
      setNewClassName("");
    } catch (error) {
      console.error("Error creating class:", error);
      setError(error.response?.data?.message || "Không thể tạo lớp học mới");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!classId || !window.confirm("Bạn có chắc chắn muốn xóa lớp học này?")) {
      return;
    }

    setDeletingClass(classId);
    setError("");

    try {
      console.log("Deleting class ID:", classId);
      console.log("Type of classId:", typeof classId);

      // First test if class exists
      const testResponse = await axios.get(`/api/classes/test/${classId}`);
      console.log("Test response:", testResponse.data);

      if (!testResponse.data || !testResponse.data.class) {
        setError("Không tìm thấy lớp học để xóa");
        setDeletingClass(null);
        return;
      }

      // Now delete the class
      console.log("Attempting to delete class:", classId);
      const response = await axios.delete(`/api/classes/${classId}`);
      console.log("Delete response:", response.data);

      // Show success message
      alert(response.data.message);

      // Refresh the class list
      await fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      if (error.response) {
        // Server responded with an error
        const errorMessage =
          error.response.data.message || "Lỗi khi xóa lớp học";
        const errorDetails = error.response.data.id
          ? ` (ID: ${error.response.data.id})`
          : "";
        setError(`${errorMessage}${errorDetails}`);
      } else if (error.request) {
        // Request was made but no response
        setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      } else {
        // Something else went wrong
        setError("Đã xảy ra lỗi. Vui lòng thử lại sau.");
      }
    } finally {
      setDeletingClass(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Quản lý lớp học</h2>

      {/* Form to add new class */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Nhập tên lớp học mới"
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading || !newClassName.trim()}
          >
            {loading ? "Đang tạo..." : "Thêm lớp"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* List of classes */}
      <div className="grid gap-4">
        {classes.map((cls) => (
          <div
            key={cls._id}
            className="bg-white rounded-lg shadow-md p-4 border border-gray-200"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{cls.name}</h3>
                <p className="text-gray-600">
                  {cls.students ? cls.students.length : 0} sinh viên
                </p>
              </div>
              <button
                onClick={() => handleDeleteClass(cls._id)}
                className={`px-3 py-1 rounded-md ${
                  cls.students && cls.students.length > 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-red-100 text-red-600 hover:bg-red-200"
                }`}
                disabled={
                  deletingClass === cls._id ||
                  (cls.students && cls.students.length > 0)
                }
              >
                {deletingClass === cls._id ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        ))}

        {!loading && classes.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            Chưa có lớp học nào
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassList;
