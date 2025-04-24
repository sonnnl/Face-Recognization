import React, { useState, useEffect } from "react";
import axios from "../config/axios";
import { toast } from "react-toastify";

const StudentSelector = ({ isOpen, onClose, classId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [existingStudents, setExistingStudents] = useState([]);
  const [addingStudents, setAddingStudents] = useState(false);
  const [entryYears, setEntryYears] = useState([]);
  const [adminClasses, setAdminClasses] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedAdminClass, setSelectedAdminClass] = useState("");
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [studentIdToAdd, setStudentIdToAdd] = useState("");
  const [loadingYears, setLoadingYears] = useState(false);

  useEffect(() => {
    if (isOpen && classId) {
      fetchData();
      fetchAllAvailableYears();
    }
  }, [isOpen, classId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Lấy danh sách sinh viên hiện có trong lớp
      const existingResponse = await axios.get(
        `/api/teacher/classes/${classId}/students`
      );
      setExistingStudents(existingResponse.data || []);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu sinh viên hiện có:", error);
      toast.error("Không thể tải danh sách sinh viên hiện có trong lớp");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAvailableYears = async () => {
    setLoadingYears(true);
    try {
      // Lấy tất cả các khóa có lớp từ API
      try {
        const response = await axios.get("/api/admin-classes/years");
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          setEntryYears(response.data.sort((a, b) => b - a)); // Sắp xếp giảm dần

          // Tự động chọn năm đầu tiên (mới nhất)
          if (response.data.length > 0) {
            const newestYear = Math.max(...response.data).toString();
            setSelectedYear(newestYear);
            await fetchAdminClasses(newestYear);
          }
          setLoadingYears(false);
          return;
        }
      } catch (err) {
        console.log(
          "Không thể lấy năm từ /api/admin-classes/years, thử phương pháp khác"
        );
      }

      // Nếu API đầu tiên không hoạt động, thử lấy tất cả lớp hành chính và trích xuất năm
      try {
        const response = await axios.get("/api/admin-classes");
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          // Trích xuất năm từ danh sách lớp
          const years = [
            ...new Set(response.data.map((cls) => cls.entryYear)),
          ].filter(Boolean);

          if (years.length > 0) {
            const sortedYears = years.sort((a, b) => b - a); // Sắp xếp giảm dần
            setEntryYears(sortedYears);

            // Tự động chọn năm đầu tiên (mới nhất)
            setSelectedYear(sortedYears[0].toString());

            // Tải lớp của năm đầu tiên
            const classesForYear = response.data.filter(
              (cls) => cls.entryYear === sortedYears[0]
            );
            setAdminClasses(classesForYear);
            return;
          }
        }
      } catch (err) {
        console.log(
          "Không thể lấy danh sách lớp hành chính từ /api/admin-classes"
        );
      }

      // Nếu không có API nào hoạt động, sử dụng danh sách năm tĩnh
      const currentYear = new Date().getFullYear();
      const years = [
        currentYear,
        currentYear - 1,
        currentYear - 2,
        currentYear - 3,
      ];
      setEntryYears(years);
      setSelectedYear(currentYear.toString());

      await fetchAdminClasses(currentYear.toString());
    } catch (error) {
      console.error("Lỗi khi tải danh sách năm học:", error);
      toast.error("Không thể tải danh sách khóa");

      // Fallback: dùng năm hiện tại
      const currentYear = new Date().getFullYear();
      setEntryYears([currentYear]);
      setSelectedYear(currentYear.toString());
    } finally {
      setLoadingYears(false);
    }
  };

  const fetchAdminClasses = async (year) => {
    if (!year) return;

    setLoadingFilters(true);
    try {
      let classesData = [];
      let fetchSuccess = false;

      // Thử API 1: /api/admin-classes
      try {
        const response = await axios.get(
          `/api/admin-classes?entryYear=${year}`
        );
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          classesData = response.data;
          fetchSuccess = true;
        }
      } catch (err) {
        console.log(`Không thể lấy lớp từ /api/admin-classes với khóa ${year}`);
      }

      // Thử API 2: /api/classes
      if (!fetchSuccess) {
        try {
          const response = await axios.get(
            `/api/classes?type=admin&entryYear=${year}`
          );
          if (
            response.data &&
            Array.isArray(response.data) &&
            response.data.length > 0
          ) {
            classesData = response.data;
            fetchSuccess = true;
          }
        } catch (err) {
          console.log(`Không thể lấy lớp từ /api/classes với khóa ${year}`);
        }
      }

      // Thử API 3: Lấy tất cả lớp và lọc theo năm
      if (!fetchSuccess) {
        try {
          const response = await axios.get(`/api/admin-classes`);
          if (response.data && Array.isArray(response.data)) {
            const filteredClasses = response.data.filter(
              (cls) => cls.entryYear?.toString() === year.toString()
            );
            if (filteredClasses.length > 0) {
              classesData = filteredClasses;
              fetchSuccess = true;
            }
          }
        } catch (err) {
          console.log("Không thể lấy tất cả lớp từ /api/admin-classes");
        }
      }

      setAdminClasses(classesData);

      if (classesData.length === 0) {
        toast.info(`Không tìm thấy lớp hành chính nào cho khóa ${year}`);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách lớp hành chính:", error);
      toast.error("Không thể tải danh sách lớp hành chính");
      setAdminClasses([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const fetchStudentsByClass = async (classId) => {
    if (!classId) return;

    setLoading(true);
    try {
      let fetchedStudents = [];
      let fetchSuccess = false;

      // API 1: Thông qua endpoint học sinh của lớp
      try {
        const response = await axios.get(`/api/students/class/${classId}`);
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          fetchedStudents = response.data;
          fetchSuccess = true;
        }
      } catch (err) {
        console.log(
          `Không thể lấy sinh viên của lớp ${classId} qua API sinh viên lớp`
        );
      }

      // API 2: Thông qua endpoint lớp hành chính
      if (!fetchSuccess) {
        try {
          const response = await axios.get(
            `/api/admin-classes/${classId}/students`
          );
          if (
            response.data &&
            Array.isArray(response.data) &&
            response.data.length > 0
          ) {
            fetchedStudents = response.data;
            fetchSuccess = true;
          }
        } catch (err) {
          console.log(
            `Không thể lấy sinh viên của lớp ${classId} qua API admin-classes`
          );
        }
      }

      // API 3: Thông qua endpoint classes
      if (!fetchSuccess) {
        try {
          const response = await axios.get(`/api/classes/${classId}/students`);
          if (
            response.data &&
            Array.isArray(response.data) &&
            response.data.length > 0
          ) {
            fetchedStudents = response.data;
            fetchSuccess = true;
          }
        } catch (err) {
          console.log(
            `Không thể lấy sinh viên của lớp ${classId} qua API classes`
          );
        }
      }

      // API 4: Thử API trực tiếp từ server đối với sinh viên có MSSV bắt đầu bằng tiền tố của năm học
      if (!fetchSuccess && selectedYear) {
        try {
          const yearPrefix = selectedYear.substring(2); // Lấy 2 chữ số cuối của năm
          const response = await axios.get(
            `/api/students?prefix=${yearPrefix}`
          );
          if (
            response.data &&
            Array.isArray(response.data) &&
            response.data.length > 0
          ) {
            fetchedStudents = response.data;
            fetchSuccess = true;
          }
        } catch (err) {
          console.log(
            `Không thể lấy sinh viên có MSSV bắt đầu bằng ${selectedYear.substring(
              2
            )}`
          );
        }
      }

      if (fetchedStudents.length > 0) {
        setStudents(fetchedStudents);
      } else {
        toast.info("Không tìm thấy sinh viên trong lớp này");
        setStudents([]);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách sinh viên:", error);
      toast.error("Không thể tải danh sách sinh viên từ lớp này");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = async (year) => {
    setSelectedYear(year);
    setSelectedAdminClass("");
    setStudents([]);

    if (year) {
      await fetchAdminClasses(year);
    }
  };

  const handleAdminClassChange = async (adminClassId) => {
    setSelectedAdminClass(adminClassId);
    setStudents([]);

    if (adminClassId) {
      await fetchStudentsByClass(adminClassId);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim() !== "") {
      const lowercaseSearch = searchTerm.toLowerCase();
      const filtered = students.filter(
        (student) =>
          student.name?.toLowerCase().includes(lowercaseSearch) ||
          student.studentId?.toLowerCase().includes(lowercaseSearch)
      );
      return filtered;
    }
    return students;
  };

  const getAvailableStudents = () => {
    const existingIds = new Set(existingStudents.map((student) => student._id));
    return handleSearch().filter((student) => !existingIds.has(student._id));
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    const availableStudentIds = getAvailableStudents().map(
      (student) => student._id
    );

    // Nếu đã chọn tất cả rồi, thì bỏ chọn tất cả
    if (
      selectedStudentIds.length === availableStudentIds.length &&
      availableStudentIds.length > 0
    ) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(availableStudentIds);
    }
  };

  const handleAddStudents = async () => {
    if (selectedStudentIds.length === 0 && !studentIdToAdd.trim()) {
      toast.warning(
        "Vui lòng chọn ít nhất một sinh viên hoặc nhập mã số sinh viên để thêm"
      );
      return;
    }

    setAddingStudents(true);
    try {
      let addedCount = 0;

      // Nếu có mã số sinh viên để thêm
      if (studentIdToAdd.trim()) {
        await axios.post(`/api/teacher/classes/${classId}/students`, {
          studentIds: [studentIdToAdd.trim()],
        });
        addedCount += 1;
      }

      // Nếu có sinh viên đã chọn
      if (selectedStudentIds.length > 0) {
        await axios.post(`/api/teacher/classes/${classId}/students`, {
          studentIds: selectedStudentIds,
        });
        addedCount += selectedStudentIds.length;
      }

      toast.success(`Đã thêm ${addedCount} sinh viên vào lớp học`);

      // Reset state
      setSelectedStudentIds([]);
      setStudentIdToAdd("");

      // Gọi callback thành công
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error("Lỗi khi thêm sinh viên:", error);
      let errorMessage = "Không thể thêm sinh viên vào lớp học";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast.error(errorMessage);
    } finally {
      setAddingStudents(false);
    }
  };

  if (!isOpen) return null;

  const availableStudents = getAvailableStudents();
  const canAddStudents =
    selectedStudentIds.length > 0 || studentIdToAdd.trim() !== "";
  const allSelected =
    availableStudents.length > 0 &&
    selectedStudentIds.length === availableStudents.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-11/12 max-w-4xl max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-800 text-white py-4 px-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Thêm sinh viên vào lớp học</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-green-700 p-2 rounded-full transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {/* Thêm sinh viên thủ công */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-gray-800 mb-3">
                Thêm sinh viên bằng mã số
              </h3>
              <div className="flex items-center">
                <input
                  type="text"
                  value={studentIdToAdd}
                  onChange={(e) => setStudentIdToAdd(e.target.value)}
                  placeholder="Nhập mã số sinh viên"
                  className="flex-grow p-2 border rounded-md"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Sinh viên phải đã tồn tại trong hệ thống với dữ liệu khuôn mặt
                đã được đăng ký
              </p>
            </div>

            {/* Filters - Khóa và Lớp hành chính */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chọn khóa */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bước 1: Chọn khóa sinh viên
                </label>
                {loadingYears ? (
                  <div className="w-full p-2 border rounded-md bg-gray-100 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                    Đang tải...
                  </div>
                ) : (
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full p-2 border rounded-md bg-white"
                    disabled={loadingFilters || entryYears.length === 0}
                  >
                    <option value="">-- Chọn khóa --</option>
                    {entryYears.map((year) => (
                      <option key={year} value={year}>
                        Khóa {year}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Chọn lớp hành chính */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bước 2: Chọn lớp hành chính
                </label>
                {loadingFilters ? (
                  <div className="w-full p-2 border rounded-md bg-gray-100 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                    Đang tải danh sách lớp...
                  </div>
                ) : (
                  <select
                    value={selectedAdminClass}
                    onChange={(e) => handleAdminClassChange(e.target.value)}
                    className="w-full p-2 border rounded-md bg-white"
                    disabled={!selectedYear || adminClasses.length === 0}
                  >
                    {adminClasses.length === 0 ? (
                      <option value="">-- Không có dữ liệu lớp --</option>
                    ) : (
                      <>
                        <option value="">-- Chọn lớp hành chính --</option>
                        {adminClasses.map((cls) => (
                          <option key={cls._id} value={cls._id}>
                            {cls.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>
            </div>

            {/* Danh sách sinh viên */}
            <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-base font-medium text-gray-700">
                    Danh sách sinh viên{" "}
                    {selectedStudentIds.length > 0 && (
                      <span className="text-sm font-normal text-gray-500">
                        ({selectedStudentIds.length} đã chọn)
                      </span>
                    )}
                  </h3>
                  {/* Tìm kiếm */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-2 pl-8 border rounded-md text-sm"
                      placeholder="Tìm theo tên hoặc MSSV..."
                      disabled={!selectedAdminClass || loading}
                    />
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student List Content */}
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                  <p className="ml-3 text-gray-600">
                    Đang tải danh sách sinh viên...
                  </p>
                </div>
              ) : !selectedAdminClass ? (
                <div className="p-6 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-gray-400 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">
                    Chọn lớp hành chính
                  </h3>
                  <p className="text-gray-500">
                    Vui lòng chọn lớp hành chính để xem danh sách sinh viên
                  </p>
                </div>
              ) : students.length === 0 ? (
                <div className="p-6 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-gray-400 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">
                    Không tìm thấy sinh viên
                  </h3>
                  <p className="text-gray-500">
                    Không tìm thấy sinh viên nào trong lớp này
                  </p>
                </div>
              ) : availableStudents.length === 0 ? (
                <div className="p-6 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-yellow-400 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">
                    Không có sinh viên nào khả dụng
                  </h3>
                  <p className="text-gray-500">
                    {searchTerm.trim() !== ""
                      ? "Không tìm thấy sinh viên phù hợp với tìm kiếm"
                      : "Tất cả sinh viên đã được thêm vào lớp học"}
                  </p>
                  {searchTerm.trim() !== "" && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="mt-3 px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition"
                    >
                      Xóa tìm kiếm
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                            />
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          MSSV
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Họ tên
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableStudents.map((student) => (
                        <tr
                          key={student._id}
                          className={`hover:bg-gray-50 ${
                            selectedStudentIds.includes(student._id)
                              ? "bg-green-50"
                              : ""
                          }`}
                          onClick={() => toggleStudentSelection(student._id)}
                        >
                          <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(
                                  student._id
                                )}
                                onChange={() => {}} // Handled by row click
                                className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.studentId}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                            {student.name}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.email || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Huỷ bỏ
            </button>
            <button
              onClick={handleAddStudents}
              disabled={!canAddStudents || addingStudents}
              className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                !canAddStudents || addingStudents
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {addingStudents ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang thêm...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="-ml-1 mr-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Thêm sinh viên vào lớp
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSelector;
