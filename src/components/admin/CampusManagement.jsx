import React, { useState, useEffect } from "react";
import axios from "../../config/axios";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";

const CampusManagement = () => {
  const [campuses, setCampuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    _id: null,
    name: "",
    address: "",
    description: "",
  });

  // Fetch all campuses on component mount
  useEffect(() => {
    fetchCampuses();
  }, []);

  // Fetch all campuses
  const fetchCampuses = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/campuses");
      setCampuses(response.data);
    } catch (error) {
      console.error("Error fetching campuses:", error);
      toast.error("Lỗi khi tải danh sách cơ sở");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      _id: null,
      name: "",
      address: "",
      description: "",
    });
    setIsEditing(false);
    setIsFormOpen(false);
  };

  // Open form for adding a new campus
  const handleAddCampus = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Open form for editing an existing campus
  const handleEditCampus = (campus) => {
    setFormData({
      _id: campus._id,
      name: campus.name,
      address: campus.address,
      description: campus.description || "",
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.address) {
      toast.error("Vui lòng điền đầy đủ thông tin cơ sở");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        // Update existing campus
        await axios.put(`/api/campuses/${formData._id}`, formData);
        toast.success("Cập nhật cơ sở thành công");
      } else {
        // Create new campus
        await axios.post("/api/campuses", formData);
        toast.success("Thêm cơ sở mới thành công");
      }
      fetchCampuses();
      resetForm();
    } catch (error) {
      console.error("Error saving campus:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi lưu thông tin cơ sở"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle campus deletion
  const handleDeleteCampus = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa cơ sở này không?")) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.delete(`/api/campuses/${id}`);
      toast.success("Xóa cơ sở thành công");
      fetchCampuses();
    } catch (error) {
      console.error("Error deleting campus:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa cơ sở");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="bg-blue-600 text-white rounded-t-lg px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Quản lý cơ sở</h2>
          <button
            onClick={handleAddCampus}
            className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium flex items-center hover:bg-blue-50"
          >
            <FaPlus className="mr-2" /> Thêm cơ sở
          </button>
        </div>

        {isFormOpen && (
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold mb-4">
              {isEditing ? "Cập nhật cơ sở" : "Thêm cơ sở mới"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="name">
                  Tên cơ sở <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="address">
                  Địa chỉ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 mb-2"
                  htmlFor="description"
                >
                  Mô tả
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading
                    ? "Đang xử lý..."
                    : isEditing
                    ? "Cập nhật"
                    : "Thêm mới"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {isLoading && !campuses.length ? (
            <div className="text-center py-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : campuses.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              Chưa có cơ sở nào được tạo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-3 px-4 text-left border-b">STT</th>
                    <th className="py-3 px-4 text-left border-b">Tên cơ sở</th>
                    <th className="py-3 px-4 text-left border-b">Địa chỉ</th>
                    <th className="py-3 px-4 text-left border-b">Mô tả</th>
                    <th className="py-3 px-4 text-center border-b">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {campuses.map((campus, index) => (
                    <tr key={campus._id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 border-b">{index + 1}</td>
                      <td className="py-3 px-4 border-b">{campus.name}</td>
                      <td className="py-3 px-4 border-b">{campus.address}</td>
                      <td className="py-3 px-4 border-b">
                        {campus.description || "-"}
                      </td>
                      <td className="py-3 px-4 border-b text-center">
                        <button
                          onClick={() => handleEditCampus(campus)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Sửa"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteCampus(campus._id)}
                          className="text-red-600 hover:text-red-800"
                          title="Xóa"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampusManagement;
