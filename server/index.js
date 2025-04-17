import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Class from "../src/models/Class.js";
import Student from "../src/models/Student.js";
import Attendance from "../src/models/Attendance.js";
import ExcelJS from "exceljs";
import Account from "../src/models/Account.js";
import { auth, adminOnly, generateToken } from "../src/middleware/auth.js";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");

    // Xóa index cũ studentId_1 nếu tồn tại
    try {
      mongoose.connection
        .collection("students")
        .dropIndex("studentId_1")
        .then(() => {
          console.log("Old index 'studentId_1' dropped successfully");
        })
        .catch((err) => {
          // Bỏ qua lỗi nếu index không tồn tại
          if (err.code !== 27) {
            console.error("Error dropping old index:", err);
          } else {
            console.log("No old index to drop");
          }
        });

      // Xóa index student_1_date_1 trong bảng attendances
      mongoose.connection
        .collection("attendances")
        .dropIndex("student_1_date_1")
        .then(() => {
          console.log("Old index 'student_1_date_1' dropped successfully");
        })
        .catch((err) => {
          // Bỏ qua lỗi nếu index không tồn tại
          if (err.code !== 27) {
            console.error("Error dropping attendance index:", err);
          } else {
            console.log("No attendance index to drop");
          }
        });
    } catch (error) {
      console.log("Could not attempt to drop index:", error.message);
    }
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Server status check
app.get("/api/check-server", (req, res) => {
  res.json({
    message: "Server is running",
    timestamp: new Date(),
    nodejs: process.version,
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Add a database check endpoint
app.get("/api/db-check", async (req, res) => {
  try {
    console.log("Checking database connection...");

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        message: "Database not connected",
        state: mongoose.connection.readyState,
        states: {
          0: "disconnected",
          1: "connected",
          2: "connecting",
          3: "disconnecting",
        },
      });
    }

    // Get collection stats
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections.map((c) => c.name);

    // Get count of documents in each collection
    const stats = {};
    for (const name of collectionNames) {
      stats[name] = await mongoose.connection.db
        .collection(name)
        .countDocuments();
    }

    // Check models are properly registered
    const registeredModels = Object.keys(mongoose.models);

    res.json({
      message: "Database connection check successful",
      connection: {
        state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
      collections: collectionNames,
      documentCounts: stats,
      registeredModels,
    });
  } catch (error) {
    console.error("Database check error:", error);
    res.status(500).json({
      message: "Error checking database",
      error: error.message,
    });
  }
});

// Validate MongoDB ObjectID
const isValidObjectId = (id) => {
  if (!id) return false;
  try {
    return mongoose.Types.ObjectId.isValid(id);
  } catch (error) {
    return false;
  }
};

// Convert string ID to ObjectId with validation
const toObjectId = (id) => {
  if (!isValidObjectId(id)) {
    throw new Error("Invalid ObjectId format");
  }
  return new mongoose.Types.ObjectId(id);
};

// ==================== CLASS ROUTES ====================

// GET all classes - sửa để chỉ lấy lớp học của giáo viên hiện tại
app.get("/api/classes", auth, async (req, res) => {
  try {
    console.log("Fetching classes for teacher:", req.account._id);
    let query = {};

    // Nếu không phải admin, chỉ lấy lớp học của giáo viên đó
    if (req.account.role !== "admin") {
      query.teacher = req.account._id;
    }

    const classes = await Class.find(query).sort({ createdAt: -1 });
    console.log(
      `Found ${classes.length} classes for teacher ${req.account.name}`
    );
    res.json(classes);
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách lớp học",
      error: error.message,
    });
  }
});

// Add new endpoint to sync student counts for all classes
app.post(
  "/api/classes/sync-student-counts",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      console.log("Syncing student counts for all classes...");

      // Get all classes
      const classes = await Class.find();
      console.log(`Found ${classes.length} classes to sync`);

      // Update counts for each class
      const updates = [];
      for (const cls of classes) {
        // Count the actual number of students
        const studentCount = await Student.countDocuments({ class: cls._id });

        // Update the class with the correct count
        const updated = await Class.findByIdAndUpdate(
          cls._id,
          {
            $set: { studentCount: studentCount },
          },
          { new: true }
        );

        updates.push({
          className: cls.name,
          oldCount: cls.studentCount,
          newCount: updated.studentCount,
          difference: updated.studentCount - cls.studentCount,
        });
      }

      console.log("Student counts synced successfully:", updates);

      res.json({
        message: "Đã đồng bộ số lượng sinh viên thành công",
        updates,
      });
    } catch (error) {
      console.error("Error syncing student counts:", error);
      res.status(500).json({
        message: "Lỗi khi đồng bộ số lượng sinh viên",
        error: error.message,
      });
    }
  }
);

// IMPORTANT: Keep specific routes BEFORE generic routes with similar paths
// Test class existence by ID - this MUST be before /api/classes/:id
app.get("/api/classes/test/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Testing class ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid ObjectId format:", id);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        id: id,
        isValid: false,
      });
    }

    const classFound = await Class.findById(id);
    console.log("Class lookup result:", classFound);

    if (!classFound) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        id: id,
        isValid: true,
      });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classFound.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized test access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền truy cập lớp học này",
      });
    }

    res.json({
      message: "Tìm thấy lớp học",
      class: classFound,
    });
  } catch (error) {
    console.error("Error testing class:", error);
    res.status(500).json({
      message: "Lỗi khi kiểm tra lớp học",
      error: error.message,
    });
  }
});

// GET single class by ID - this must come AFTER more specific routes like /api/classes/test/:id
app.get("/api/classes/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching class with ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid ObjectId format:", id);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        id: id,
      });
    }

    const classFound = await Class.findById(id);
    console.log("Class lookup result:", classFound);

    if (!classFound) {
      console.log("Class not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        id: id,
      });
    }

    // Kiểm tra quyền: chỉ admin hoặc giáo viên phụ trách mới được xem
    if (
      req.account.role !== "admin" &&
      classFound.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized access attempt by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền truy cập lớp học này",
      });
    }

    res.json(classFound);
  } catch (error) {
    console.error("Error fetching class:", error);
    res.status(500).json({
      message: "Lỗi khi tải thông tin lớp học",
      error: error.message,
    });
  }
});

// CREATE new class
app.post("/api/classes", auth, async (req, res) => {
  try {
    const { name, description, startDate, totalSessions } = req.body;
    console.log("Creating new class:", {
      name,
      description,
      startDate,
      totalSessions,
      teacher: req.account._id,
    });

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      console.log("Invalid class name:", name);
      return res.status(400).json({
        message: "Tên lớp học không hợp lệ hoặc bị bỏ trống",
      });
    }

    if (!startDate || isNaN(new Date(startDate).getTime())) {
      console.log("Invalid start date:", startDate);
      return res.status(400).json({
        message: "Ngày bắt đầu không hợp lệ hoặc bị bỏ trống",
      });
    }

    if (
      !totalSessions ||
      isNaN(parseInt(totalSessions)) ||
      parseInt(totalSessions) <= 0
    ) {
      console.log("Invalid total sessions:", totalSessions);
      return res.status(400).json({
        message: "Số buổi học không hợp lệ hoặc bị bỏ trống",
      });
    }

    // Check if class with same name already exists
    const existingClass = await Class.findOne({ name: name.trim() });
    if (existingClass) {
      console.log("Class with name already exists:", name);
      return res.status(400).json({
        message: "Lớp học với tên này đã tồn tại",
      });
    }

    const newClass = new Class({
      name: name.trim(),
      description: description ? description.trim() : "",
      teacher: req.account._id,
      startDate: new Date(startDate),
      totalSessions: parseInt(totalSessions),
      studentCount: 0,
      students: [],
    });

    const savedClass = await newClass.save();
    console.log("Class created successfully:", savedClass);
    res.status(201).json(savedClass);
  } catch (error) {
    console.error("Error creating class:", error);
    res.status(500).json({
      message: "Lỗi khi tạo lớp học mới",
      error: error.message,
    });
  }
});

// DELETE class by ID
app.delete("/api/classes/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Attempting to delete class with ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid ObjectId format:", id);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        id: id,
      });
    }

    // First check if class exists
    const classToDelete = await Class.findById(id);
    console.log("Class lookup result:", classToDelete);

    if (!classToDelete) {
      console.log("Class not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        id: id,
      });
    }

    // Kiểm tra quyền: chỉ admin hoặc giáo viên phụ trách mới được xóa
    if (
      req.account.role !== "admin" &&
      classToDelete.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized delete attempt by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xóa lớp học này",
      });
    }

    // Check if class has students
    if (classToDelete.students && classToDelete.students.length > 0) {
      console.log("Cannot delete class with students");
      return res.status(400).json({
        message:
          "Không thể xóa lớp học đã có sinh viên. Vui lòng xóa tất cả sinh viên trước.",
        studentCount: classToDelete.students.length,
      });
    }

    // Perform the deletion
    const deletedClass = await Class.findByIdAndDelete(id);
    console.log("Class deleted successfully:", deletedClass);

    res.json({
      message: "Đã xóa lớp học thành công",
      deletedClass,
    });
  } catch (error) {
    console.error("Error deleting class:", error);
    res.status(500).json({
      message: "Lỗi khi xóa lớp học",
      error: error.message,
    });
  }
});

// ==================== STUDENT ROUTES ====================

// GET students by class ID - This must come BEFORE the generic /api/students/:id route
app.get("/api/students/class/:classId", auth, async (req, res) => {
  try {
    const { classId } = req.params;
    console.log("Fetching students for class:", classId);

    if (!isValidObjectId(classId)) {
      console.log("Invalid classId format:", classId);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        id: classId,
      });
    }

    // First check if class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      console.log("Class not found:", classId);
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        id: classId,
      });
    }

    // Kiểm tra quyền: chỉ admin hoặc giáo viên phụ trách mới được xem
    if (
      req.account.role !== "admin" &&
      classExists.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized access attempt by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền truy cập lớp học này",
      });
    }

    const students = await Student.find({ class: classId });
    console.log(`Found ${students.length} students for class ${classId}`);
    res.json(students);
  } catch (error) {
    console.error("Error fetching students by class:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên",
      error: error.message,
    });
  }
});

// DELETE student from class - This must come BEFORE the generic /api/students/:id route
app.delete("/api/students/delete/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Attempting to delete student with ID: ${id}`);

    // Find the student to get their class ID
    const student = await Student.findById(id);
    if (!student) {
      console.log(`Student with ID ${id} not found`);
      return res.status(404).json({ message: "Không tìm thấy sinh viên" });
    }

    const classId = student.class;
    console.log(`Student belongs to class: ${classId}`);

    // Kiểm tra xem giáo viên có quyền quản lý lớp này không
    const classInfo = await Class.findById(classId);
    if (!classInfo) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    if (
      req.account.role !== "admin" &&
      classInfo.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized delete attempt by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xóa sinh viên của lớp học này",
      });
    }

    // Delete the student
    await Student.findByIdAndDelete(id);
    console.log(`Student with ID ${id} deleted successfully`);

    // Update the class to remove the student reference
    await Class.findByIdAndUpdate(
      classId,
      { $pull: { students: id } },
      { new: true }
    );
    console.log(`Student removed from class ${classId}`);

    res.json({ message: "Đã xóa sinh viên thành công" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ message: "Lỗi khi xóa sinh viên" });
  }
});

// GET student by ID - This should come AFTER more specific routes
app.get("/api/students/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching student with ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid student ID format:", id);
      return res.status(400).json({
        message: "ID sinh viên không hợp lệ",
        id: id,
      });
    }

    const student = await Student.findById(id);
    if (!student) {
      console.log("Student not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy sinh viên",
        id: id,
      });
    }

    // Get the class to check permissions
    const classDoc = await Class.findById(student.class);
    if (!classDoc) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy lớp học của sinh viên này" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized student access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền truy cập thông tin sinh viên này",
      });
    }

    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({
      message: "Lỗi khi tải thông tin sinh viên",
      error: error.message,
    });
  }
});

// CREATE new student
app.post("/api/students", auth, async (req, res) => {
  try {
    console.log("=== STUDENT REGISTRATION START ===");
    const { name, studentId, classId, faceFeatures, faceImage } = req.body;
    console.log("Registering new student:", {
      name,
      studentId,
      classId,
      hasFaceFeatures: !!faceFeatures,
      faceDataLength: faceFeatures ? faceFeatures.length : 0,
      hasFaceImage: !!faceImage && faceImage.length > 0,
    });

    // Validate required fields
    if (!name || !studentId || !classId) {
      console.log("Missing required fields:", {
        name: !name,
        studentId: !studentId,
        classId: !classId,
      });
      return res.status(400).json({
        message: "Thông tin sinh viên không đầy đủ",
        missing: {
          name: !name,
          studentId: !studentId,
          classId: !classId,
        },
      });
    }

    // Validate ObjectId format
    if (!isValidObjectId(classId)) {
      console.log("Invalid classId format:", classId);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        classId,
      });
    }

    // Check if student with same ID already exists in the same class
    const existingStudent = await Student.findOne({
      studentId,
      class: classId,
    });

    if (existingStudent) {
      console.log("Student ID already exists in this class:", studentId);
      return res.status(400).json({
        message: "MSSV đã tồn tại trong lớp này",
      });
    }

    // Check if class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      console.log("Class not found with ID:", classId);
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        classId,
      });
    }
    console.log("Found class:", classExists.name);

    // Kiểm tra quyền truy cập
    if (
      req.account.role !== "admin" &&
      classExists.teacher.toString() !== req.account._id.toString()
    ) {
      console.log(
        "Unauthorized registration attempt by teacher:",
        req.account._id
      );
      return res.status(403).json({
        message: "Bạn không có quyền đăng ký sinh viên cho lớp học này",
      });
    }

    // Create and save student
    try {
      // Create new student document
      const newStudent = new Student({
        name,
        studentId,
        class: classId,
        faceFeatures,
        faceImage: faceImage,
      });

      // Save student to database
      const savedStudent = await newStudent.save();
      console.log("Student saved successfully with ID:", savedStudent._id);

      // Update class with new student
      try {
        const updatedClass = await Class.findByIdAndUpdate(
          classId,
          {
            $push: { students: savedStudent._id },
          },
          { new: true }
        );

        console.log("Class updated with new student:", {
          className: updatedClass.name,
          studentCount: updatedClass.students.length,
        });

        console.log("=== STUDENT REGISTRATION COMPLETE ===");
        return res.status(201).json({
          message: "Đăng ký sinh viên thành công",
          student: savedStudent,
          class: {
            id: updatedClass._id,
            name: updatedClass.name,
            studentCount: updatedClass.students.length,
          },
        });
      } catch (updateError) {
        console.error("Error updating class with new student:", updateError);
        // Try to delete the student if class update fails
        await Student.findByIdAndDelete(savedStudent._id);
        throw new Error("Lỗi khi cập nhật lớp học: " + updateError.message);
      }
    } catch (saveError) {
      console.error("Error saving student:", saveError);
      throw new Error("Lỗi khi lưu sinh viên: " + saveError.message);
    }
  } catch (error) {
    console.error("Error registering student:", error);
    console.log("=== STUDENT REGISTRATION FAILED ===");
    return res.status(500).json({
      message: "Lỗi khi đăng ký sinh viên",
      error: error.message,
    });
  }
});

// ==================== ATTENDANCE ROUTES ====================

// CREATE new attendance record
app.post("/api/attendance", async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    console.log("Creating attendance record:", { studentId, classId });

    if (!studentId || !classId) {
      console.log("Missing required fields");
      return res.status(400).json({
        message: "Thiếu thông tin điểm danh",
      });
    }

    if (!isValidObjectId(studentId) || !isValidObjectId(classId)) {
      console.log("Invalid ID format:", { studentId, classId });
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if attendance already exists for today
    const existingAttendance = await Attendance.findOne({
      student: studentId,
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    if (existingAttendance) {
      console.log("Attendance already exists for today");
      return res.status(400).json({
        message: "Đã điểm danh hôm nay",
      });
    }

    const newAttendance = new Attendance({
      student: studentId,
      class: classId,
      date: new Date(),
      status: "present",
    });

    const savedAttendance = await newAttendance.save();
    console.log("Attendance saved:", savedAttendance);

    res.status(201).json(savedAttendance);
  } catch (error) {
    console.error("Error creating attendance record:", error);
    res.status(500).json({
      message: "Lỗi khi tạo điểm danh",
      error: error.message,
    });
  }
});

// GET attendance records by class ID for today
app.get("/api/attendance/:classId", auth, async (req, res) => {
  try {
    const { classId } = req.params;
    console.log("Fetching attendance for class:", classId);

    if (!isValidObjectId(classId)) {
      console.log("Invalid classId format:", classId);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        classId,
      });
    }

    // Check class existence and permissions
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log(
        "Unauthorized attendance access by teacher:",
        req.account._id
      );
      return res.status(403).json({
        message: "Bạn không có quyền truy cập dữ liệu điểm danh của lớp này",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.find({
      class: classId,
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("student");

    console.log(`Found ${attendance.length} attendance records for today`);
    res.json(attendance);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách điểm danh",
      error: error.message,
    });
  }
});

// UPDATE attendance record
app.patch("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log("Updating attendance record:", { id, status });

    if (!isValidObjectId(id)) {
      console.log("Invalid attendance ID format:", id);
      return res.status(400).json({
        message: "ID điểm danh không hợp lệ",
        id,
      });
    }

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("student");

    if (!updatedAttendance) {
      console.log("Attendance record not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy bản ghi điểm danh",
      });
    }

    console.log("Attendance updated:", updatedAttendance);
    res.json(updatedAttendance);
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật điểm danh",
      error: error.message,
    });
  }
});

// DELETE attendance record
app.delete("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Deleting attendance record:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid attendance ID format:", id);
      return res.status(400).json({
        message: "ID điểm danh không hợp lệ",
        id,
      });
    }

    const deletedAttendance = await Attendance.findByIdAndDelete(id);

    if (!deletedAttendance) {
      console.log("Attendance record not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy bản ghi điểm danh",
      });
    }

    console.log("Attendance deleted:", deletedAttendance);
    res.json({
      message: "Đã xóa bản ghi điểm danh",
      deletedAttendance,
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({
      message: "Lỗi khi xóa điểm danh",
      error: error.message,
    });
  }
});

// Tạo lịch học tự động
app.post("/api/classes/:id/schedule", async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    await classDoc.generateSchedule();
    res.json(classDoc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy lịch học của lớp
app.get("/api/classes/:id/schedule", auth, async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền: chỉ admin hoặc giáo viên phụ trách mới được xem
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized schedule access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền truy cập lịch học của lớp này",
      });
    }

    res.json(classDoc.schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET attendance by class ID with optional date range filtering
app.get("/api/attendance/class/:classId", auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    console.log("Fetching attendance by class:", {
      classId,
      startDate,
      endDate,
    });

    if (!isValidObjectId(classId)) {
      console.log("Invalid classId format:", classId);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        classId,
      });
    }

    // Check class existence and permissions
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log(
        "Unauthorized attendance access by teacher:",
        req.account._id
      );
      return res.status(403).json({
        message: "Bạn không có quyền truy cập dữ liệu điểm danh của lớp này",
      });
    }

    const query = { class: classId };

    // Add date filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end,
      };
    }

    // Lấy tất cả bản ghi điểm danh và populate đầy đủ thông tin sinh viên
    const attendanceRecords = await Attendance.find(query)
      .populate("students.student")
      .sort({ date: -1, sessionNumber: -1 });

    // Lọc chỉ giữ lại sinh viên có mặt
    const processedRecords = attendanceRecords.map((record) => {
      const plainRecord = record.toObject();

      if (plainRecord.students && Array.isArray(plainRecord.students)) {
        // Chỉ giữ lại sinh viên có mặt
        plainRecord.students = plainRecord.students
          .filter((student) => student.status === "present")
          .map((student) => {
            // Đảm bảo có timestamp
            if (!student.timestamp) {
              student.timestamp = plainRecord.createdAt || plainRecord.date;
            }
            return student;
          });
      }

      return plainRecord;
    });

    console.log(
      `Found ${processedRecords.length} attendance records for class ${classId}`
    );
    res.json(processedRecords);
  } catch (error) {
    console.error("Error fetching attendance by class:", error);
    res.status(500).json({
      message: "Lỗi khi tải dữ liệu điểm danh theo lớp",
      error: error.message,
    });
  }
});

// GET attendance history by class ID and date range
app.get("/api/attendance/history", auth, async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;
    console.log("Fetching attendance history:", {
      classId,
      startDate,
      endDate,
    });

    if (!classId) {
      return res.status(400).json({
        message: "Thiếu thông tin lớp học",
        classId,
      });
    }

    if (!isValidObjectId(classId)) {
      console.log("Invalid classId format:", classId);
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        classId,
      });
    }

    // Kiểm tra quyền truy cập
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized history access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xem lịch sử điểm danh của lớp học này",
      });
    }

    const query = { class: classId };

    // Add date filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end,
      };
    }

    const attendanceRecords = await Attendance.find(query)
      .populate("students.student")
      .sort({ date: -1, sessionNumber: -1 });

    console.log(
      `Found ${attendanceRecords.length} attendance records for class ${classId}`
    );
    res.json(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({
      message: "Lỗi khi tải lịch sử điểm danh",
      error: error.message,
    });
  }
});

// Bắt đầu điểm danh cho một buổi học
app.post("/api/attendance/start", auth, async (req, res) => {
  try {
    const { classId, sessionNumber } = req.body;
    console.log(
      "Starting attendance for class:",
      classId,
      "session:",
      sessionNumber
    );

    if (!classId || !sessionNumber) {
      return res.status(400).json({
        message: "Thiếu thông tin lớp học hoặc số buổi học",
        classId,
        sessionNumber,
      });
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      console.log("Class not found:", classId);
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized attendance start by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền điểm danh cho lớp học này",
      });
    }

    // Kiểm tra xem đã có bản ghi điểm danh cho buổi học này chưa
    const existingAttendance = await Attendance.findOne({
      class: classId,
      sessionNumber: sessionNumber,
    });

    if (existingAttendance) {
      console.log(
        "Attendance already exists for this session:",
        existingAttendance._id
      );
      // Thay vì trả về lỗi, trả về bản ghi điểm danh hiện có
      return res.json(existingAttendance);
    }

    const session = classDoc.schedule.find(
      (s) => s.sessionNumber === sessionNumber
    );
    if (!session) {
      console.log("Session not found:", sessionNumber);
      return res.status(404).json({ message: "Không tìm thấy buổi học" });
    }

    // Lấy danh sách sinh viên từ lớp học
    const students = [];

    // Chỉ thêm các sinh viên hợp lệ vào danh sách điểm danh
    if (classDoc.students && classDoc.students.length > 0) {
      for (const studentId of classDoc.students) {
        if (studentId) {
          // Đảm bảo studentId không null
          students.push({
            student: studentId,
            status: "absent", // Mặc định là vắng
            score: 0,
          });
        }
      }
    }

    // Tạo bản ghi điểm danh mới
    const attendance = new Attendance({
      class: classId,
      sessionNumber: sessionNumber,
      date: session.date,
      students: students,
      createdBy: req.account._id, // Thêm người tạo điểm danh
    });

    console.log(`Creating attendance with ${students.length} students`);
    const savedAttendance = await attendance.save();
    console.log("Attendance created successfully:", savedAttendance._id);
    res.json(savedAttendance);
  } catch (error) {
    console.error("Error starting attendance:", error);
    res.status(500).json({
      message: "Lỗi khi bắt đầu điểm danh",
      error: error.message,
    });
  }
});

// Cập nhật trạng thái điểm danh của sinh viên
app.put("/api/attendance/:id/student/:studentId", async (req, res) => {
  try {
    const { status } = req.body;
    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi điểm danh" });
    }

    const studentRecord = attendance.students.find(
      (s) => s.student.toString() === req.params.studentId
    );

    if (!studentRecord) {
      return res.status(404).json({ message: "Không tìm thấy sinh viên" });
    }

    studentRecord.status = status;
    await attendance.save();

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Kết thúc điểm danh và tính điểm
app.post("/api/attendance/:id/complete", async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi điểm danh" });
    }

    // Tính điểm và cập nhật trạng thái cấm thi
    await attendance.calculateScores();

    // Cập nhật trạng thái buổi học trong lịch
    const classDoc = await Class.findById(attendance.class);
    const session = classDoc.schedule.find(
      (s) => s.sessionNumber === attendance.sessionNumber
    );
    if (session) {
      session.status = "completed";
      await classDoc.save();
    }

    // Cập nhật trạng thái điểm danh
    attendance.status = "completed";
    await attendance.save();

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy thống kê điểm danh của lớp
app.get("/api/classes/:id/attendance-stats", auth, async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id).populate({
      path: "students",
      select: "name studentId",
    });

    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized stats access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xem thống kê điểm danh của lớp học này",
      });
    }

    const attendances = await Attendance.find({
      class: req.params.id,
      status: "completed",
    });

    // Tính thống kê cho từng sinh viên
    const stats = {};
    for (let student of classDoc.students) {
      stats[student._id] = {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        totalAbsences: 0,
        totalScore: 0,
        isBanned: false,
      };
    }

    for (let att of attendances) {
      for (let student of att.students) {
        const studentId = student.student.toString();
        if (stats[studentId] && student.status === "absent") {
          stats[studentId].totalAbsences++;
          stats[studentId].totalScore += student.score;
        }
        if (stats[studentId]) {
          stats[studentId].isBanned = student.isBanned;
        }
      }
    }

    res.json({
      class: classDoc,
      stats: Object.values(stats),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy lịch sử điểm danh của lớp học
app.get("/api/classes/:id/attendance", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check class existence and permissions
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log(
        "Unauthorized attendance access by teacher:",
        req.account._id
      );
      return res.status(403).json({
        message: "Bạn không có quyền xem lịch sử điểm danh của lớp học này",
      });
    }

    // Tìm tất cả các bản ghi điểm danh của lớp học
    const attendanceRecords = await Attendance.find({ class: id }).populate({
      path: "students.student",
      select: "name studentId",
    });

    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.json([]);
    }

    res.json(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({ message: error.message });
  }
});

// Add endpoint to check indexes
app.get("/api/check-indexes", auth, adminOnly, async (req, res) => {
  try {
    const studentIndexes = await mongoose.connection
      .collection("students")
      .indexes();
    const attendanceIndexes = await mongoose.connection
      .collection("attendances")
      .indexes();

    res.json({
      studentIndexes,
      attendanceIndexes,
    });
  } catch (error) {
    console.error("Error checking indexes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Xuất báo cáo điểm danh dạng Excel
app.get("/api/classes/:id/attendance-export", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    console.log("Exporting attendance report for class:", id);

    // Kiểm tra ID lớp
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID lớp học không hợp lệ" });
    }

    // Lấy thông tin lớp học
    const classDoc = await Class.findById(id).populate({
      path: "students",
      select: "name studentId",
    });

    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Check permissions: only admin or the teacher who owns the class can access
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized export access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xuất báo cáo điểm danh của lớp học này",
      });
    }

    // Tạo query để lấy dữ liệu điểm danh
    const query = { class: id };

    // Thêm bộ lọc theo ngày nếu có
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end,
      };
    }

    // Lấy dữ liệu điểm danh
    const attendances = await Attendance.find(query)
      .populate({
        path: "students.student",
        select: "name studentId",
      })
      .sort({ sessionNumber: 1 });

    // Tạo workbook và worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance Report");

    // Thêm thông tin lớp học
    worksheet.addRow(["BÁO CÁO ĐIỂM DANH"]);
    worksheet.addRow(["Lớp:", classDoc.name]);
    worksheet.addRow([
      "Ngày bắt đầu:",
      classDoc.startDate.toLocaleDateString("vi-VN"),
    ]);
    worksheet.addRow(["Tổng số buổi:", classDoc.totalSessions]);
    worksheet.addRow([""]);

    // Tạo bảng điểm danh
    // Headers cho bảng
    const headerRow = ["STT", "MSSV", "Họ và tên"];

    // Thêm các buổi học vào header
    for (let i = 1; i <= classDoc.totalSessions; i++) {
      headerRow.push(`Buổi ${i}`);
    }

    // Thêm thống kê vào header
    headerRow.push("Số buổi vắng", "Điểm trừ", "Trạng thái");

    worksheet.addRow(headerRow);

    // Chuẩn bị dữ liệu cho từng sinh viên
    const studentMap = new Map();

    // Khởi tạo dữ liệu cho mỗi sinh viên
    classDoc.students.forEach((student) => {
      if (student && student._id) {
        studentMap.set(student._id.toString(), {
          id: student._id.toString(),
          studentId: student.studentId,
          name: student.name,
          sessions: {},
          totalAbsences: 0,
          totalScore: 0,
          isBanned: false,
        });
      }
    });

    // Điền dữ liệu điểm danh
    attendances.forEach((attendance) => {
      attendance.students.forEach((record) => {
        if (record.student) {
          const studentId =
            typeof record.student === "object"
              ? record.student._id.toString()
              : record.student.toString();

          const student = studentMap.get(studentId);

          if (student) {
            student.sessions[attendance.sessionNumber] = record.status;

            if (record.status === "absent") {
              student.totalAbsences++;
              student.totalScore += record.score || -2;
            }

            student.isBanned = record.isBanned || false;
          }
        }
      });
    });

    // Thêm dữ liệu sinh viên vào worksheet
    let index = 1;
    studentMap.forEach((student) => {
      const studentRow = [index++, student.studentId, student.name];

      // Thêm trạng thái điểm danh cho từng buổi
      for (let i = 1; i <= classDoc.totalSessions; i++) {
        const status = student.sessions[i];
        studentRow.push(
          status === "present" ? "P" : status === "absent" ? "A" : ""
        );
      }

      // Thêm thông tin thống kê
      studentRow.push(
        student.totalAbsences,
        student.totalScore,
        student.isBanned ? "Cấm thi" : "Đủ điều kiện"
      );

      worksheet.addRow(studentRow);
    });

    // Định dạng worksheet
    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 12;
    worksheet.getColumn(3).width = 25;

    for (let i = 4; i < 4 + classDoc.totalSessions; i++) {
      worksheet.getColumn(i).width = 8;
    }

    const lastColumns = [
      worksheet.columnCount - 2,
      worksheet.columnCount - 1,
      worksheet.columnCount,
    ];
    lastColumns.forEach((col) => {
      worksheet.getColumn(col).width = 12;
    });

    // Thiết lập header cho file khi gửi về client
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Sửa lại tên file thành tên tĩnh an toàn để tránh lỗi ký tự đặc biệt
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_report.xlsx`
    );

    console.log("Sending Excel report to client");

    // Gửi file về cho client
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting attendance report:", error);
    res.status(500).json({
      message: "Lỗi khi xuất báo cáo điểm danh",
      error: error.message,
    });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Đăng ký tài khoản (chỉ admin mới có thể tạo)
app.post("/api/auth/register", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;

    // Kiểm tra email đã tồn tại chưa
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Tạo tài khoản mới
    const account = new Account({
      name,
      email,
      password,
      role: role || "teacher",
      status: status || "active",
    });

    await account.save();

    res.status(201).json({
      message: "Tạo tài khoản thành công",
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Error registering account:", error);
    res.status(500).json({ message: "Lỗi khi đăng ký", error: error.message });
  }
});

// Đăng nhập
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra email
    const account = await Account.findOne({ email });
    if (!account) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Kiểm tra mật khẩu
    const isMatch = await account.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Kiểm tra tài khoản có active không
    if (account.status !== "active") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    // Cập nhật thời gian đăng nhập cuối
    account.lastLogin = new Date();
    await account.save();

    // Tạo token
    const token = generateToken(account._id);

    res.json({
      message: "Đăng nhập thành công",
      token,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi đăng nhập", error: error.message });
  }
});

// Lấy thông tin người dùng hiện tại
app.get("/api/auth/me", auth, (req, res) => {
  res.json({
    account: {
      id: req.account._id,
      name: req.account.name,
      email: req.account.email,
      role: req.account.role,
      status: req.account.status,
    },
  });
});

// Đăng ký admin đầu tiên (chỉ sử dụng khi chưa có admin nào)
app.post("/api/auth/register-first-admin", async (req, res) => {
  try {
    // Kiểm tra xem đã có admin nào chưa
    const adminExists = await Account.findOne({ role: "admin" });
    if (adminExists) {
      return res.status(400).json({
        message: "Admin đã tồn tại, không thể tạo thêm thông qua route này",
      });
    }

    const { name, email, password } = req.body;

    // Kiểm tra email đã tồn tại chưa
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Tạo admin đầu tiên
    const admin = new Account({
      name,
      email,
      password,
      role: "admin",
      status: "active",
    });

    await admin.save();

    res.status(201).json({
      message: "Tạo tài khoản admin đầu tiên thành công",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("Error registering first admin:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi tạo admin", error: error.message });
  }
});

// Kiểm tra xem đã có admin nào chưa
app.post("/api/auth/check-admin-exists", async (req, res) => {
  try {
    const adminCount = await Account.countDocuments({ role: "admin" });
    res.json({ exists: adminCount > 0, count: adminCount });
  } catch (error) {
    console.error("Error checking admin existence:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi kiểm tra admin", error: error.message });
  }
});

// Đăng nhập bằng Google
app.post("/api/auth/google-login", async (req, res) => {
  try {
    const { tokenId } = req.body;

    // Xác thực token từ Google
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${tokenId}`
    );
    const { email, name, sub: googleId } = response.data;

    if (!email) {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }

    // Kiểm tra xem email đã tồn tại trong hệ thống chưa
    let account = await Account.findOne({ email });

    if (!account) {
      // Tạo tài khoản mới nếu chưa tồn tại
      account = new Account({
        name: name || email.split("@")[0],
        email,
        googleId,
        password: crypto.randomBytes(16).toString("hex"), // Tạo mật khẩu ngẫu nhiên
        role: "teacher", // Mặc định là giáo viên
        status: "active",
      });

      await account.save();
    } else {
      // Cập nhật googleId nếu chưa có
      if (!account.googleId) {
        account.googleId = googleId;
      }

      // Cập nhật thời gian đăng nhập cuối
      account.lastLogin = new Date();
      await account.save();
    }

    // Tạo token JWT
    const token = generateToken(account._id);

    res.json({
      token,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    res
      .status(500)
      .json({ message: "Lỗi xác thực Google", error: error.message });
  }
});

// ==================== TEACHER ROUTES ====================

// Lấy thông tin cơ bản của giáo viên theo ID
app.get("/api/teachers/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching teacher with ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid teacher ID format:", id);
      return res.status(400).json({
        message: "ID giáo viên không hợp lệ",
        id: id,
      });
    }

    const teacher = await Account.findById(id);
    if (!teacher) {
      console.log("Teacher not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy giáo viên",
        id: id,
      });
    }

    // Chỉ trả về thông tin cơ bản, bảo vệ thông tin nhạy cảm
    res.json({
      _id: teacher._id,
      name: teacher.name,
      role: teacher.role,
    });
  } catch (error) {
    console.error("Error fetching teacher:", error);
    res.status(500).json({
      message: "Lỗi khi tải thông tin giáo viên",
      error: error.message,
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Lấy danh sách tất cả giáo viên (chỉ admin)
app.get("/api/admin/teachers", auth, adminOnly, async (req, res) => {
  try {
    console.log("Admin fetching all teachers");
    const teachers = await Account.find({}).select("-password");
    res.json(teachers);
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách giáo viên",
      error: error.message,
    });
  }
});

// Cập nhật thông tin giáo viên (chỉ admin)
app.put("/api/admin/teachers/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID giáo viên không hợp lệ",
      });
    }

    const teacher = await Account.findById(id);
    if (!teacher) {
      return res.status(404).json({
        message: "Không tìm thấy giáo viên",
      });
    }

    // Cập nhật thông tin
    teacher.name = name || teacher.name;
    teacher.email = email || teacher.email;
    teacher.role = role || teacher.role;

    const updatedAccount = await teacher.save();
    res.json({
      message: "Cập nhật thông tin tài khoản thành công",
      teacher: {
        _id: updatedAccount._id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        role: updatedAccount.role,
      },
    });
  } catch (error) {
    console.error("Error updating teacher:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật thông tin giáo viên",
      error: error.message,
    });
  }
});

// Xóa tài khoản giáo viên (chỉ admin)
app.delete("/api/admin/teachers/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID giáo viên không hợp lệ",
      });
    }

    // Không cho phép xóa chính mình
    if (id === req.account._id.toString()) {
      return res.status(400).json({
        message: "Không thể xóa tài khoản của chính mình",
      });
    }

    // Kiểm tra xem giáo viên có đang quản lý lớp nào không
    const classesCount = await Class.countDocuments({ teacher: id });
    if (classesCount > 0) {
      return res.status(400).json({
        message:
          "Giáo viên đang quản lý lớp học. Vui lòng chuyển lớp cho giáo viên khác trước khi xóa.",
        classesCount,
      });
    }

    const deletedAccount = await Account.findByIdAndDelete(id);
    if (!deletedAccount) {
      return res.status(404).json({
        message: "Không tìm thấy giáo viên",
      });
    }

    res.json({
      message: "Xóa tài khoản giáo viên thành công",
      teacher: {
        _id: deletedAccount._id,
        name: deletedAccount.name,
        email: deletedAccount.email,
      },
    });
  } catch (error) {
    console.error("Error deleting teacher:", error);
    res.status(500).json({
      message: "Lỗi khi xóa tài khoản giáo viên",
      error: error.message,
    });
  }
});

// Thay đổi giáo viên phụ trách lớp học (chỉ admin)
app.put("/api/admin/classes/:id/teacher", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    if (!isValidObjectId(id) || !isValidObjectId(teacherId)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    // Kiểm tra lớp học
    const classToUpdate = await Class.findById(id);
    if (!classToUpdate) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    // Kiểm tra giáo viên mới
    const newTeacher = await Account.findById(teacherId);
    if (!newTeacher) {
      return res.status(404).json({
        message: "Không tìm thấy giáo viên",
      });
    }

    // Cập nhật lớp học
    classToUpdate.teacher = teacherId;
    const updatedClass = await classToUpdate.save();

    res.json({
      message: "Đã chuyển lớp học cho giáo viên mới thành công",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Error reassigning class:", error);
    res.status(500).json({
      message: "Lỗi khi chuyển lớp học",
      error: error.message,
    });
  }
});

// Cập nhật thông tin lớp học (chỉ admin)
app.put("/api/admin/classes/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, totalSessions } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
      });
    }

    const classToUpdate = await Class.findById(id);
    if (!classToUpdate) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    // Cập nhật thông tin
    if (name) classToUpdate.name = name;
    if (description !== undefined) classToUpdate.description = description;
    if (startDate) classToUpdate.startDate = new Date(startDate);
    if (totalSessions) {
      classToUpdate.totalSessions = parseInt(totalSessions);
      // Cập nhật maxAbsences
      classToUpdate.maxAbsences = Math.ceil(classToUpdate.totalSessions * 0.2);
    }

    const updatedClass = await classToUpdate.save();

    res.json({
      message: "Cập nhật thông tin lớp học thành công",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Error updating class:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật thông tin lớp học",
      error: error.message,
    });
  }
});

// Xóa sinh viên từ bất kỳ lớp nào (chỉ admin)
app.delete("/api/admin/students/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Admin attempting to delete student with ID: ${id}`);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID sinh viên không hợp lệ",
      });
    }

    // Tìm sinh viên
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        message: "Không tìm thấy sinh viên",
      });
    }

    const classId = student.class;

    // Xóa sinh viên
    await Student.findByIdAndDelete(id);
    console.log(`Student with ID ${id} deleted by admin`);

    // Cập nhật lớp học
    await Class.findByIdAndUpdate(
      classId,
      { $pull: { students: id } },
      { new: true }
    );
    console.log(`Student removed from class ${classId}`);

    res.json({
      message: "Xóa sinh viên thành công",
      student: {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
      },
    });
  } catch (error) {
    console.error("Error deleting student by admin:", error);
    res.status(500).json({
      message: "Lỗi khi xóa sinh viên",
      error: error.message,
    });
  }
});

// Thêm API endpoint để đồng bộ số lượng sinh viên
app.post("/api/admin/sync-student-count", auth, adminOnly, async (req, res) => {
  try {
    console.log("Admin triggered student count synchronization");

    // Lấy tất cả các lớp học
    const classes = await Class.find({});
    let updatedCount = 0;

    // Cập nhật số lượng sinh viên cho từng lớp
    for (const classItem of classes) {
      const actualCount = classItem.students.length;

      // Chỉ cập nhật nếu số lượng không khớp
      if (classItem.studentCount !== actualCount) {
        await Class.findByIdAndUpdate(classItem._id, {
          studentCount: actualCount,
        });
        updatedCount++;
      }
    }

    res.json({
      message: "Đồng bộ số lượng sinh viên thành công",
      totalClasses: classes.length,
      updatedClasses: updatedCount,
    });
  } catch (error) {
    console.error("Error syncing student count:", error);
    res.status(500).json({
      message: "Lỗi khi đồng bộ số lượng sinh viên",
      error: error.message,
    });
  }
});

// ==================== ERROR HANDLING ====================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Đã xảy ra lỗi",
    error: err.message,
  });
});

// 404 handler - must be the last middleware
app.use((req, res) => {
  console.log("404 Not Found:", req.method, req.path);
  res.status(404).json({
    message: "Không tìm thấy tài nguyên",
    path: req.path,
    method: req.method,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
