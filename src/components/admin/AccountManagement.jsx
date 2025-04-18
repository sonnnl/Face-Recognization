import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../../config/axios";

const AccountManagement = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "teacher",
    status: "active",
  });
  const [activeTab, setActiveTab] = useState("active"); // 'active', 'pending'

  // Lấy danh sách tài khoản
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/admin/teachers");
      setAccounts(response.data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Không thể tải danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  };

  // Xử lý thay đổi form
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Mở modal thêm tài khoản
  const openAddModal = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "teacher",
      status: "active",
    });
    setShowAddModal(true);
  };

  // Mở modal sửa tài khoản
  const openEditModal = (account) => {
    setCurrentAccount(account);
    setFormData({
      name: account.name,
      email: account.email,
      role: account.role,
      status: account.status || "active",
      password: "", // Để trống, chỉ cập nhật khi nhập vào
    });
    setShowEditModal(true);
  };

  // Mở modal xóa tài khoản
  const openDeleteModal = (account) => {
    setCurrentAccount(account);
    setShowDeleteModal(true);
  };

  // Thêm tài khoản
  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.email || !formData.password) {
        toast.error("Vui lòng điền đầy đủ thông tin");
        return;
      }

      // Đảm bảo role mặc định là "teacher" nếu không được chọn
      const accountData = {
        ...formData,
        role: formData.role || "teacher",
      };

      await axios.post("/api/auth/register", accountData);
      toast.success("Thêm tài khoản thành công");
      setShowAddModal(false);
      fetchAccounts();
    } catch (error) {
      console.error("Error adding account:", error);
      toast.error(error.response?.data?.message || "Lỗi khi thêm tài khoản");
    }
  };

  // Cập nhật tài khoản
  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.email) {
        toast.error("Vui lòng điền đầy đủ thông tin");
        return;
      }

      // Chỉ lấy những trường đã có giá trị
      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
      };

      // Nếu có nhập mật khẩu mới thì cập nhật
      if (formData.password) {
        updateData.password = formData.password;
      }

      await axios.put(`/api/admin/teachers/${currentAccount._id}`, updateData);
      toast.success("Cập nhật tài khoản thành công");
      setShowEditModal(false);
      fetchAccounts();
    } catch (error) {
      console.error("Error updating account:", error);
      toast.error(
        error.response?.data?.message || "Lỗi khi cập nhật tài khoản"
      );
    }
  };

  // Xóa tài khoản
  const handleDeleteAccount = async () => {
    try {
      await axios.delete(`/api/admin/teachers/${currentAccount._id}`);
      toast.success("Xóa tài khoản thành công");
      setShowDeleteModal(false);
      fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa tài khoản");
    }
  };

  // Thêm hàm lọc tài khoản theo trạng thái
  const filteredAccounts = accounts.filter((account) => {
    if (activeTab === "active") return account.status === "active";
    if (activeTab === "pending") return account.status === "pending";
    return true;
  });

  // Thêm hàm duyệt tài khoản
  const handleApproveAccount = async (accountId) => {
    try {
      await axios.put(`/api/admin/teachers/${accountId}/approve`);

      // Cập nhật state
      setAccounts(
        accounts.map((account) =>
          account._id === accountId ? { ...account, status: "active" } : account
        )
      );

      toast.success("Đã duyệt tài khoản thành công");
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi duyệt tài khoản");
    }
  };

  // Thêm hàm từ chối tài khoản
  const handleRejectAccount = async (accountId) => {
    try {
      await axios.put(`/api/admin/teachers/${accountId}/reject`);

      // Cập nhật state
      setAccounts(
        accounts.map((account) =>
          account._id === accountId
            ? { ...account, status: "blocked" }
            : account
        )
      );

      toast.success("Đã từ chối tài khoản thành công");
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi từ chối tài khoản");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">
            Quản lý tài khoản
          </h1>
          <p className="text-gray-600">
            Quản lý tài khoản hệ thống và phân quyền người dùng
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            to="/admin"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            ← Quay lại Dashboard
          </Link>
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Thêm UI tab cho danh sách tài khoản */}
      <div className="mb-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("active")}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === "active"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Tài khoản đang hoạt động
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Tài khoản chờ duyệt
              {accounts.filter((a) => a.status === "pending").length > 0 && (
                <span className="ml-2 py-0.5 px-2 bg-red-500 text-white text-xs rounded-full">
                  {accounts.filter((a) => a.status === "pending").length}
                </span>
              )}
            </button>
          </nav>
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
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vai trò
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Chưa có tài khoản nào
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {account.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {account.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          account.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {account.role === "admin" ? "Admin" : "Giảng viên"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          account.status === "active"
                            ? "bg-green-100 text-green-800"
                            : account.status === "inactive"
                            ? "bg-gray-100 text-gray-800"
                            : account.status === "blocked"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {account.status === "active"
                          ? "Hoạt động"
                          : account.status === "inactive"
                          ? "Không hoạt động"
                          : account.status === "blocked"
                          ? "Bị khóa"
                          : "Chờ duyệt"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(account.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {activeTab === "pending" ? (
                        <>
                          <button
                            onClick={() => handleApproveAccount(account._id)}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleRejectAccount(account._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Từ chối
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openEditModal(account)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => openDeleteModal(account)}
                            className="text-red-600 hover:text-red-900"
                            disabled={account.role === "admin"}
                          >
                            Xóa
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm tài khoản */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
            <h2 className="text-xl font-semibold mb-4">Thêm tài khoản mới</h2>
            <form onSubmit={handleAddAccount}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Họ tên
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập họ tên"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập email"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập mật khẩu"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Vai trò
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="teacher">Giảng viên</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Trạng thái
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Không hoạt động</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="blocked">Bị khóa</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Thêm tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal sửa tài khoản */}
      {showEditModal && currentAccount && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
            <h2 className="text-xl font-semibold mb-4">
              Chỉnh sửa tài khoản: {currentAccount.name}
            </h2>
            <form onSubmit={handleUpdateAccount}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Họ tên
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập họ tên"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập email"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Mật khẩu mới (để trống nếu không đổi)
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Vai trò
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="teacher">Giảng viên</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Trạng thái
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Không hoạt động</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="blocked">Bị khóa</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xóa tài khoản */}
      {showDeleteModal && currentAccount && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
            <h2 className="text-xl font-semibold mb-4">
              Xác nhận xóa tài khoản
            </h2>
            <p className="mb-4">
              Bạn có chắc chắn muốn xóa tài khoản{" "}
              <strong>{currentAccount.name}</strong>? Hành động này không thể
              hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => setShowDeleteModal(false)}
              >
                Hủy
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                onClick={handleDeleteAccount}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
