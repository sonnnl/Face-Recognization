import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  });

  // Fetch departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/departments");
        setDepartments(response.data);
      } catch (error) {
        console.error("Error fetching departments:", error);
        toast.error("Không thể tải danh sách khoa");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Open create/edit modal
  const openModal = (department = null) => {
    if (department) {
      setCurrentDepartment(department);
      setFormData({
        name: department.name,
        code: department.code || "",
        description: department.description || "",
      });
    } else {
      setCurrentDepartment(null);
      setFormData({
        name: "",
        code: "",
        description: "",
      });
    }
    setShowModal(true);
  };

  // Handle form submit (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.code) {
        toast.error("Tên khoa và mã khoa không được để trống");
        return;
      }

      let response;
      if (currentDepartment) {
        // Update existing department
        response = await axios.put(
          `/api/admin/departments/${currentDepartment._id}`,
          formData
        );
        toast.success("Cập nhật khoa thành công");

        // Update departments list
        setDepartments((prevDepartments) =>
          prevDepartments.map((d) =>
            d._id === currentDepartment._id ? response.data : d
          )
        );
      } else {
        // Create new department
        response = await axios.post("/api/admin/departments", formData);
        toast.success("Tạo khoa mới thành công");

        // Add to departments list
        setDepartments([...departments, response.data]);
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving department:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi lưu thông tin khoa"
      );
    }
  };

  // Delete department
  const handleDelete = async (departmentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khoa này?")) {
      return;
    }

    try {
      await axios.delete(`/api/admin/departments/${departmentId}`);
      toast.success("Xóa khoa thành công");

      // Remove from departments list
      setDepartments(departments.filter((d) => d._id !== departmentId));
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa khoa");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Quản lý khoa</h1>
          <p className="text-gray-600">
            Quản lý thông tin khoa và phân bổ lớp học
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Thêm khoa mới
          </button>
          <Link
            to="/admin"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            ← Quay lại Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Đang tải...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Tên khoa</th>
                <th className="px-4 py-3">Mã khoa</th>
                <th className="px-4 py-3">Mô tả</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {departments.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    Chưa có khoa nào
                  </td>
                </tr>
              ) : (
                departments.map((department, index) => (
                  <tr key={department._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">{index + 1}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {department.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {department.code}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {department.description || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => openModal(department)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(department._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal create/edit department */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {currentDepartment ? "Sửa thông tin khoa" : "Thêm khoa mới"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Tên khoa
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Ví dụ: Khoa Công nghệ thông tin"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Mã khoa
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Ví dụ: CNTT"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Mô tả (tùy chọn)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Mô tả về khoa"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {currentDepartment ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;
