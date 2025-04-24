import React, { useState, useEffect } from "react";
import axios from "../../config/axios";
import { FaEdit, FaTrash, FaPlus, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";

const RoomManagement = () => {
  const [rooms, setRooms] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [formData, setFormData] = useState({
    _id: null,
    name: "",
    number: "",
    floor: "",
    building: "",
    campus: "",
    capacity: "",
    features: {
      hasProjector: false,
      hasAirConditioner: false,
      hasComputers: false,
    },
    description: "",
  });

  // Fetch all campuses and rooms on component mount
  useEffect(() => {
    fetchCampuses();
    fetchRooms();
  }, []);

  // Fetch filtered rooms when selected campus changes
  useEffect(() => {
    fetchRooms();
  }, [selectedCampus]);

  // Fetch all campuses
  const fetchCampuses = async () => {
    try {
      const response = await axios.get("/api/campuses");
      setCampuses(response.data);
    } catch (error) {
      console.error("Error fetching campuses:", error);
      toast.error("Lỗi khi tải danh sách cơ sở");
    }
  };

  // Fetch rooms with optional campus filter
  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      let url = "/api/rooms";
      if (selectedCampus) {
        url += `?campus=${selectedCampus}`;
      }
      const response = await axios.get(url);
      setRooms(response.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Lỗi khi tải danh sách phòng học");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle campus filter change
  const handleCampusFilterChange = (e) => {
    setSelectedCampus(e.target.value);
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("features.")) {
      const featureName = name.split(".")[1];
      setFormData({
        ...formData,
        features: {
          ...formData.features,
          [featureName]: e.target.checked,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      _id: null,
      name: "",
      number: "",
      floor: "",
      building: "",
      campus: selectedCampus || "",
      capacity: "",
      features: {
        hasProjector: false,
        hasAirConditioner: false,
        hasComputers: false,
      },
      description: "",
    });
    setIsEditing(false);
    setIsFormOpen(false);
  };

  // Open form for adding a new room
  const handleAddRoom = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Open form for editing an existing room
  const handleEditRoom = (room) => {
    setFormData({
      _id: room._id,
      name: room.name,
      number: room.number,
      floor: room.floor,
      building: room.building,
      campus: room.campus ? room.campus._id : null,
      capacity: room.capacity,
      features: {
        hasProjector: room.features?.hasProjector || false,
        hasAirConditioner: room.features?.hasAirConditioner || false,
        hasComputers: room.features?.hasComputers || false,
      },
      description: room.description || "",
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.number ||
      !formData.floor ||
      !formData.building ||
      !formData.campus ||
      !formData.capacity
    ) {
      toast.error("Vui lòng điền đầy đủ thông tin phòng học");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        // Update existing room
        await axios.put(`/api/rooms/${formData._id}`, formData);
        toast.success("Cập nhật phòng học thành công");
      } else {
        // Create new room
        await axios.post("/api/rooms", formData);
        toast.success("Thêm phòng học mới thành công");
      }
      fetchRooms();
      resetForm();
    } catch (error) {
      console.error("Error saving room:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi lưu thông tin phòng học"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle room deletion
  const handleDeleteRoom = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa phòng học này không?")) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.delete(`/api/rooms/${id}`);
      toast.success("Xóa phòng học thành công");
      fetchRooms();
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa phòng học");
    } finally {
      setIsLoading(false);
    }
  };

  // Format features for display
  const formatFeatures = (features) => {
    if (!features) return "-";

    const featureLabels = [];
    if (features.hasProjector) featureLabels.push("Máy chiếu");
    if (features.hasAirConditioner) featureLabels.push("Điều hòa");
    if (features.hasComputers) featureLabels.push("Máy tính");

    return featureLabels.length ? featureLabels.join(", ") : "-";
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="bg-blue-600 text-white rounded-t-lg px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Quản lý phòng học</h2>
          <button
            onClick={handleAddRoom}
            className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium flex items-center hover:bg-blue-50"
          >
            <FaPlus className="mr-2" /> Thêm phòng học
          </button>
        </div>

        <div className="p-6 border-b">
          <div className="flex items-center mb-6">
            <FaFilter className="text-gray-500 mr-2" />
            <label className="mr-2">Lọc theo cơ sở:</label>
            <select
              value={selectedCampus}
              onChange={handleCampusFilterChange}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả cơ sở</option>
              {campuses.map((campus) => (
                <option key={campus._id} value={campus._id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>

          {isFormOpen && (
            <div className="bg-gray-50 p-6 rounded-md mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {isEditing ? "Cập nhật phòng học" : "Thêm phòng học mới"}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="name">
                      Tên phòng <span className="text-red-500">*</span>
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

                  <div>
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="campus"
                    >
                      Cơ sở <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="campus"
                      name="campus"
                      value={formData.campus}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Chọn cơ sở</option>
                      {campuses.map((campus) => (
                        <option key={campus._id} value={campus._id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="number"
                    >
                      Số phòng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="number"
                      name="number"
                      value={formData.number}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="floor">
                      Tầng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="floor"
                      name="floor"
                      value={formData.floor}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="building"
                    >
                      Tòa nhà <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="building"
                      name="building"
                      value={formData.building}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label
                      className="block text-gray-700 mb-2"
                      htmlFor="capacity"
                    >
                      Sức chứa <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="capacity"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Tiện ích</label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasProjector"
                        name="features.hasProjector"
                        checked={formData.features.hasProjector}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label htmlFor="hasProjector">Máy chiếu</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasAirConditioner"
                        name="features.hasAirConditioner"
                        checked={formData.features.hasAirConditioner}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label htmlFor="hasAirConditioner">Điều hòa</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasComputers"
                        name="features.hasComputers"
                        checked={formData.features.hasComputers}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label htmlFor="hasComputers">Máy tính</label>
                    </div>
                  </div>
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
        </div>

        <div className="p-6">
          {isLoading && !rooms.length ? (
            <div className="text-center py-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              {selectedCampus
                ? "Không có phòng học nào tại cơ sở này"
                : "Chưa có phòng học nào được tạo"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-3 px-4 text-left border-b">STT</th>
                    <th className="py-3 px-4 text-left border-b">Tên phòng</th>
                    <th className="py-3 px-4 text-left border-b">Cơ sở</th>
                    <th className="py-3 px-4 text-left border-b">Vị trí</th>
                    <th className="py-3 px-4 text-left border-b">Sức chứa</th>
                    <th className="py-3 px-4 text-left border-b">Tiện ích</th>
                    <th className="py-3 px-4 text-center border-b">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, index) => (
                    <tr key={room._id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 border-b">{index + 1}</td>
                      <td className="py-3 px-4 border-b">{room.name}</td>
                      <td className="py-3 px-4 border-b">
                        {room.campus ? room.campus.name : "Chưa chọn cơ sở"}
                      </td>
                      <td className="py-3 px-4 border-b">
                        Tòa {room.building}, Tầng {room.floor}, Phòng{" "}
                        {room.number}
                      </td>
                      <td className="py-3 px-4 border-b">
                        {room.capacity} chỗ
                      </td>
                      <td className="py-3 px-4 border-b">
                        {formatFeatures(room.features)}
                      </td>
                      <td className="py-3 px-4 border-b text-center">
                        <button
                          onClick={() => handleEditRoom(room)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                          title="Sửa"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room._id)}
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

export default RoomManagement;
