import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import connectDB from "../src/config/db.js";
import Department from "../src/models/Department.js";
import Class from "../src/models/Class.js";
import Student from "../src/models/Student.js";
import Account from "../src/models/Account.js";
import Attendance from "../src/models/Attendance.js";
import AdminClass from "../src/models/AdminClass.js";
import Teacher from "../src/models/Teacher.js";
import { auth, adminOnly, generateToken } from "../src/middleware/auth.js";
import tempRoutes from "./temp_routes.js";
import Campus from "../src/models/Campus.js";
import Room from "../src/models/Room.js";
import ClassStudent from "../src/models/ClassStudent.js";
import AttendanceRecord from "../src/models/AttendanceRecord.js";

// Thêm log để xác nhận model được load
console.log("Loaded models:", {
  Department: !!Department,
  Class: !!Class,
  Student: !!Student,
  Account: !!Account,
  Attendance: !!Attendance,
  AdminClass: !!AdminClass,
  Teacher: !!Teacher,
  Campus: !!Campus,
  Room: !!Room,
});

const app = express();

// CORS config

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.get("/hello", (req, res) => {
  res.send("Hello World");
});
// VERY BASIC PING ROUTE FOR TESTING
app.get("/ping", (req, res) => {
  console.log("Received request for /ping");
  res.status(200).send("pong");
});

// Connect to MongoDB
connectDB()
  .then(async () => {
    console.log("MongoDB connected successfully");

    // Check if collections exist before attempting to drop indexes
    try {
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      const collectionNames = collections.map((c) => c.name);

      // Only attempt to drop index if the collection exists
      if (collectionNames.includes("students")) {
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
      } else {
        console.log(
          "Collection 'students' does not exist, skipping index drop"
        );
      }

      // Only attempt to drop attendance index if the collection exists
      if (collectionNames.includes("attendances")) {
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
      } else {
        console.log(
          "Collection 'attendances' does not exist, skipping index drop"
        );
      }
    } catch (error) {
      console.log("Could not attempt to drop index:", error.message);
    }
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// Middleware
app.use(express.json());

// Sử dụng các routes từ temp_routes.js
app.use("/api", tempRoutes);

// Endpoint to register a student to a class
app.post("/api/classes/:id/register-student", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Find the class
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if student is already in the class
    if (classDoc.students && classDoc.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Student is already registered in this class",
      });
    }

    // Add student to class
    if (!classDoc.students) {
      classDoc.students = [];
    }
    classDoc.students.push(studentId);
    classDoc.studentCount = (classDoc.studentCount || 0) + 1;
    await classDoc.save();

    // Add class to student's classes array
    if (!student.classes) {
      student.classes = [];
    }
    if (!student.classes.includes(id)) {
      student.classes.push(id);
      await student.save();
    }

    return res.status(200).json({
      success: true,
      message: "Student registered to class successfully",
    });
  } catch (error) {
    console.error("Error registering student to class:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// TESTING ENDPOINT - Moved to beginning
app.get("/api/test/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    console.log(`TEST ENDPOINT Called for class: ${classId}`);

    return res.json({
      success: true,
      message: "Test endpoint working!",
      classId,
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return res.status(500).json({
      success: false,
      message: "Error in test endpoint",
      error: error.message,
    });
  }
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

// IMPORTANT - API for pending students management (MOVED TO TOP)
// API for admin/teacher to get pending students for a class
app.get("/api/admin-classes/:id/student-approvals", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `[EARLY REGISTRATION] Getting pending students for class: ${id}`
    );

    // Validate class ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID lớp không hợp lệ" });
    }

    // Check if class exists
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({ message: "Không tìm thấy lớp quản lý" });
    }

    // Check permissions
    if (
      req.account.role !== "admin" &&
      (!adminClass.mainTeacher ||
        adminClass.mainTeacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem danh sách sinh viên chờ duyệt của lớp này",
      });
    }

    // Tìm pending accounts liên quan đến lớp này
    const pendingAccounts = await Account.find({
      role: "student",
      status: "pending",
      "pendingStudentInfo.adminClass": id,
    });

    console.log(
      `[EARLY REGISTRATION] Found ${pendingAccounts.length} pending students for class ${id}`
    );

    // Format response
    const result = pendingAccounts.map((account) => {
      return {
        _id: account._id,
        name: account.name,
        studentId: account.pendingStudentInfo?.studentIdNumber || "N/A",
        email: account.email,
        phone: account.pendingStudentInfo?.phone || "N/A",
        gender: account.pendingStudentInfo?.gender || "male",
        faceImage: account.pendingStudentInfo?.faceImage || null,
        faceFeatures: account.pendingStudentInfo?.faceFeatures || null,
        createdAt: account.createdAt,
        account: {
          _id: account._id,
          email: account.email,
          status: account.status,
          createdAt: account.createdAt,
        },
      };
    });

    return res.json(result);
  } catch (error) {
    console.error(
      "[EARLY REGISTRATION] Error getting pending students:",
      error
    );
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách sinh viên chờ duyệt",
      error: error.message,
    });
  }
});

// Legacy API endpoint for backward compatibility - redirects to student-approvals endpoint
app.get("/api/admin-classes/:id/pending-students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[LEGACY ENDPOINT] Getting pending students for class: ${id}`);

    // Validate class ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID lớp không hợp lệ" });
    }

    // Check if class exists
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({ message: "Không tìm thấy lớp quản lý" });
    }

    // Check permissions
    if (
      req.account.role !== "admin" &&
      (!adminClass.mainTeacher ||
        adminClass.mainTeacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem danh sách sinh viên chờ duyệt của lớp này",
      });
    }

    // Find pending students for this class
    const pendingStudents = await Student.find({
      adminClass: id,
      status: "pending",
    }).populate({
      path: "accountId",
      select: "email status createdAt",
    });

    console.log(
      `[LEGACY ENDPOINT] Found ${pendingStudents.length} pending students for class ${id}`
    );

    // Format response
    const result = pendingStudents.map((student) => {
      return {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        email: student.email,
        phone: student.phone || "N/A",
        gender: student.gender,
        faceImage: student.faceImage || null,
        faceFeatures: student.faceFeatures || null,
        createdAt: student.createdAt,
        account: student.accountId,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("[LEGACY ENDPOINT] Error getting pending students:", error);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách sinh viên chờ duyệt",
      error: error.message,
    });
  }
});

// API for admin/teacher to approve a student
app.put(
  "/api/admin-classes/:classId/approve-student-new/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;
      console.log(
        `[EARLY REGISTRATION] Approving student: ${studentId} for class: ${classId}`
      );

      // Validate IDs
      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ message: "ID không hợp lệ" });
      }

      // Check if class exists
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({ message: "Không tìm thấy lớp quản lý" });
      }

      // Check permissions
      if (
        req.account.role !== "admin" &&
        (!adminClass.mainTeacher ||
          adminClass.mainTeacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền phê duyệt sinh viên của lớp này",
        });
      }

      // Tìm tài khoản sinh viên chờ duyệt
      const account = await Account.findById(studentId);
      if (!account) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản sinh viên" });
      }

      if (account.status !== "pending") {
        return res.status(400).json({
          message: "Tài khoản sinh viên này không ở trạng thái chờ duyệt",
        });
      }

      if (
        !account.pendingStudentInfo ||
        !account.pendingStudentInfo.adminClass ||
        account.pendingStudentInfo.adminClass.toString() !== classId
      ) {
        return res.status(400).json({
          message: "Sinh viên này không thuộc lớp quản lý được chỉ định",
        });
      }

      // Tạo bản ghi sinh viên mới từ thông tin trong pendingStudentInfo
      const newStudent = new Student({
        name: account.name,
        studentId: account.pendingStudentInfo.studentIdNumber,
        email: account.email,
        phone: account.pendingStudentInfo.phone,
        gender: account.pendingStudentInfo.gender,
        address: account.pendingStudentInfo.address,
        faceImage: account.pendingStudentInfo.faceImage,
        faceFeatures: account.pendingStudentInfo.faceFeatures,
        adminClass: classId,
        mainClassId: classId,
        accountId: account._id,
        status: "approved",
      });

      // Lưu bản ghi sinh viên mới
      const savedStudent = await newStudent.save();
      console.log(
        `[EARLY REGISTRATION] New student record created: ${savedStudent._id}`
      );

      // Cập nhật tài khoản
      account.status = "active";
      account.studentId = savedStudent._id;
      await account.save();
      console.log(
        `[EARLY REGISTRATION] Account status updated to active: ${account._id}`
      );

      // Cập nhật số lượng sinh viên trong lớp
      adminClass.studentCount = (adminClass.studentCount || 0) + 1;
      await adminClass.save();

      return res.json({
        message: "Phê duyệt sinh viên thành công",
        student: {
          _id: savedStudent._id,
          name: savedStudent.name,
          studentId: savedStudent.studentId,
          status: savedStudent.status,
        },
      });
    } catch (error) {
      console.error("[EARLY REGISTRATION] Error approving student:", error);
      return res.status(500).json({
        message: "Lỗi khi phê duyệt sinh viên",
        error: error.message,
      });
    }
  }
);

// API for admin/teacher to reject a student
app.put(
  "/api/admin-classes/:classId/reject-student-new/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;
      console.log(
        `[EARLY REGISTRATION] Rejecting student: ${studentId} for class: ${classId}`
      );

      // Validate IDs
      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ message: "ID không hợp lệ" });
      }

      // Check if class exists
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({ message: "Không tìm thấy lớp quản lý" });
      }

      // Check permissions
      if (
        req.account.role !== "admin" &&
        (!adminClass.mainTeacher ||
          adminClass.mainTeacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền từ chối sinh viên của lớp này",
        });
      }

      // Tìm tài khoản sinh viên
      const account = await Account.findById(studentId);
      if (!account) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy tài khoản sinh viên" });
      }

      if (account.status !== "pending") {
        return res.status(400).json({
          message: "Tài khoản này không ở trạng thái chờ duyệt",
        });
      }

      if (
        !account.pendingStudentInfo ||
        !account.pendingStudentInfo.adminClass ||
        account.pendingStudentInfo.adminClass.toString() !== classId
      ) {
        return res.status(400).json({
          message: "Sinh viên này không thuộc lớp quản lý được chỉ định",
        });
      }

      // Đặt trạng thái tài khoản thành blocked
      account.status = "blocked";
      await account.save();
      console.log(
        `[EARLY REGISTRATION] Account status updated to blocked: ${account._id}`
      );

      return res.json({
        message: "Đã từ chối sinh viên thành công",
        accountId: account._id,
      });
    } catch (error) {
      console.error("[EARLY REGISTRATION] Error rejecting student:", error);
      return res.status(500).json({
        message: "Lỗi khi từ chối sinh viên",
        error: error.message,
      });
    }
  }
);

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
    const {
      name,
      description,
      startDate,
      totalSessions,
      mainClass,
      department,
      campus,
      room,
      classroom,
    } = req.body;

    console.log("Creating new class:", {
      name,
      description,
      startDate,
      totalSessions,
      teacher: req.account._id,
      mainClass,
      department,
      campus,
      room,
      classroom,
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

    // Validate campus if provided
    if (campus && !mongoose.Types.ObjectId.isValid(campus)) {
      return res.status(400).json({
        message: "ID cơ sở không hợp lệ",
      });
    }

    // Validate room if provided
    if (room && !mongoose.Types.ObjectId.isValid(room)) {
      return res.status(400).json({
        message: "ID phòng học không hợp lệ",
      });
    }

    // If room is provided, verify it belongs to the specified campus
    if (room && campus) {
      const roomDetails = await Room.findById(room);
      if (!roomDetails) {
        return res.status(400).json({
          message: "Không tìm thấy phòng học",
        });
      }
      if (roomDetails.campus.toString() !== campus) {
        return res.status(400).json({
          message: "Phòng học không thuộc cơ sở đã chọn",
        });
      }
    }

    const newClass = new Class({
      name: name.trim(),
      description: description ? description.trim() : "",
      teacher: req.account._id,
      startDate: new Date(startDate),
      totalSessions: parseInt(totalSessions),
      studentCount: 0,
      students: [],
      mainClass: mainClass || false,
      department: department || null,
      campus: campus || null,
      room: room || null,
      classroom: classroom
        ? {
            room: classroom.room || "",
            floor: classroom.floor || "",
            building: classroom.building || "",
          }
        : {
            room: "",
            floor: "",
            building: "",
          },
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

    // Find and populate student data
    const students = await Student.find({ classes: { $in: [classId] } })
      .populate("classes")
      .populate("adminClass", "name");

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
// Endpoint này được giữ lại để tương thích ngược (backward compatibility) với mã phía client.
// Nên sử dụng endpoint DELETE /api/students/:id theo chuẩn RESTful API.
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

// GET face image for student by ID (works for both approved students and pending accounts)
app.get("/api/students/:id/face-image", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching face image for ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid ID format:", id);
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Tìm trong bảng Student trước (sinh viên đã được phê duyệt)
    let student = await Student.findById(id);

    // Nếu không tìm thấy trong Student, tìm trong Account (đối với sinh viên chờ phê duyệt)
    if (!student) {
      const account = await Account.findById(id);

      if (
        !account ||
        account.status !== "pending" ||
        !account.pendingStudentInfo
      ) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy dữ liệu khuôn mặt" });
      }

      // Lấy ảnh từ tài khoản pendingStudentInfo
      const faceImage = account.pendingStudentInfo.faceImage;

      if (!faceImage) {
        return res.status(404).json({ message: "Không có dữ liệu khuôn mặt" });
      }

      return res.json({
        faceImage,
        studentId: account.pendingStudentInfo.studentIdNumber || "N/A",
        studentName: account.name || "Unnamed Student",
      });
    }

    // Lấy ảnh từ Student nếu tồn tại
    if (!student.faceImage) {
      return res.status(404).json({ message: "Không có dữ liệu khuôn mặt" });
    }

    res.json({
      faceImage: student.faceImage,
      studentId: student.studentId || "N/A",
      studentName: student.name || "Unnamed Student",
    });
  } catch (error) {
    console.error("Error fetching face image:", error);
    res.status(500).json({
      message: "Lỗi khi tải ảnh khuôn mặt",
      error: error.message,
    });
  }
});

// GET face features for student by ID (works for both approved students and pending accounts)
app.get("/api/students/:id/face-features", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching face features for ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid ID format:", id);
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Tìm trong bảng Student trước (sinh viên đã được phê duyệt)
    let student = await Student.findById(id);

    // Nếu không tìm thấy trong Student, tìm trong Account (đối với sinh viên chờ phê duyệt)
    if (!student) {
      const account = await Account.findById(id);

      if (
        !account ||
        account.status !== "pending" ||
        !account.pendingStudentInfo
      ) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy dữ liệu đặc trưng khuôn mặt" });
      }

      // Lấy đặc trưng khuôn mặt từ tài khoản pendingStudentInfo
      const faceFeatures = account.pendingStudentInfo.faceFeatures;

      if (!faceFeatures || !faceFeatures.length) {
        return res
          .status(404)
          .json({ message: "Không có dữ liệu đặc trưng khuôn mặt" });
      }

      return res.json({
        faceFeatures,
        studentId: account.pendingStudentInfo.studentIdNumber || "N/A",
        studentName: account.name || "Unnamed Student",
      });
    }

    // Lấy đặc trưng khuôn mặt từ Student nếu tồn tại
    if (!student.faceFeatures || !student.faceFeatures.length) {
      return res
        .status(404)
        .json({ message: "Không có dữ liệu đặc trưng khuôn mặt" });
    }

    res.json({
      faceFeatures: student.faceFeatures,
      studentId: student.studentId || "N/A",
      studentName: student.name || "Unnamed Student",
    });
  } catch (error) {
    console.error("Error fetching face features:", error);
    res.status(500).json({
      message: "Lỗi khi tải đặc trưng khuôn mặt",
      error: error.message,
    });
  }
});

// CREATE new student
app.post("/api/students", auth, async (req, res) => {
  try {
    console.log("=== STUDENT REGISTRATION START ===");
    const { name, studentId, classId, faceFeatures, faceImage, mainClassId } =
      req.body;
    console.log("Registering new student:", {
      name,
      studentId,
      classId,
      mainClassId: mainClassId || "None",
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

    // Validate face data
    if (!faceImage || !faceFeatures) {
      console.log("Missing face data:", {
        hasFaceImage: !!faceImage,
        hasFaceFeatures: !!faceFeatures,
      });
      return res.status(400).json({
        message:
          "Dữ liệu khuôn mặt không đầy đủ. Vui lòng chụp và đăng ký khuôn mặt.",
        missing: {
          faceImage: !faceImage,
          faceFeatures: !faceFeatures,
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

    // If mainClassId is provided, validate it
    if (mainClassId && !isValidObjectId(mainClassId)) {
      console.log("Invalid mainClassId format:", mainClassId);
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
        mainClassId,
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

    // If mainClassId is provided, check if it exists
    if (mainClassId) {
      const mainClassExists = await Class.findById(mainClassId);
      if (!mainClassExists) {
        console.log("Main class not found with ID:", mainClassId);
        return res.status(404).json({
          message: "Không tìm thấy lớp quản lý",
          mainClassId,
        });
      }
      console.log("Found main class:", mainClassExists.name);

      // Check if main class is actually marked as a main class
      if (!mainClassExists.mainClass) {
        console.log(
          "Provided class is not marked as a main class:",
          mainClassId
        );
        return res.status(400).json({
          message: "Lớp được chọn không phải là lớp quản lý",
          mainClassId,
        });
      }
    }

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
        mainClassId: mainClassId || null,
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

// API để lấy danh sách lớp chính (main classes) cho sinh viên đăng ký
app.get("/api/classes/main", async (req, res) => {
  try {
    console.log("Fetching main classes for student registration");

    // Lấy các lớp được đánh dấu là lớp chính (mainClass = true)
    const mainClasses = await Class.find({ mainClass: true })
      .sort({ name: 1 })
      .select("_id name department");

    console.log(`Found ${mainClasses.length} main classes`);
    res.json(mainClasses);
  } catch (error) {
    console.error("Error fetching main classes:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách lớp quản lý",
      error: error.message,
    });
  }
});

// API đăng ký thông tin sinh viên mới (từ tài khoản đã có)
app.post("/api/students/register", auth, async (req, res) => {
  try {
    const {
      name,
      gender,
      phone,
      studentId,
      mainClassId,
      faceImage,
      faceFeatures,
    } = req.body;

    console.log(
      `Student registration request: ${name}, ID: ${studentId}, MainClassId: ${mainClassId}`
    );

    // Validate required fields
    if (!name || !studentId || !mainClassId) {
      return res.status(400).json({
        message:
          "Vui lòng cung cấp đầy đủ thông tin họ tên, mã sinh viên và lớp quản lý",
      });
    }

    // Kiểm tra bắt buộc phải có dữ liệu khuôn mặt
    if (!faceImage || !faceFeatures) {
      return res.status(400).json({
        message:
          "Vui lòng đăng ký dữ liệu khuôn mặt trước khi hoàn tất đăng ký",
      });
    }

    // Kiểm tra xem mã sinh viên đã tồn tại chưa trong Students collection
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      return res.status(400).json({
        message: "Mã sinh viên đã tồn tại trong hệ thống",
      });
    }

    // Kiểm tra xem mã sinh viên đã tồn tại chưa trong tài khoản pending nào khác
    const existingPendingAccount = await Account.findOne({
      "pendingStudentInfo.studentIdNumber": studentId,
      status: "pending",
    });

    if (existingPendingAccount) {
      return res.status(400).json({
        message: "Mã sinh viên này đã được đăng ký và đang chờ phê duyệt",
      });
    }

    // Kiểm tra lớp quản lý tồn tại
    const adminClassObj = await AdminClass.findById(mainClassId);
    if (!adminClassObj) {
      return res.status(400).json({
        message: "Lớp quản lý không tồn tại",
      });
    }

    // Thay vì tạo sinh viên mới, lưu thông tin vào tài khoản
    const account = await Account.findById(req.account._id);

    // Lưu thông tin sinh viên vào trường pendingStudentInfo
    account.pendingStudentInfo = {
      studentIdNumber: studentId,
      adminClass: mainClassId,
      gender: gender || "male",
      phone,
      faceImage,
      faceFeatures,
    };

    // Chuyển trạng thái tài khoản sang pending
    account.status = "pending";
    await account.save();

    console.log(`Student registration info saved to account: ${account._id}`);

    res.status(201).json({
      message:
        "Đăng ký thông tin sinh viên thành công. Tài khoản của bạn đang chờ quản trị viên phê duyệt.",
      isPending: true,
    });
  } catch (error) {
    console.error("Error registering student:", error);
    res.status(500).json({
      message: "Lỗi khi đăng ký thông tin sinh viên",
      error: error.message,
    });
  }
});

// Hủy đăng ký sinh viên
app.delete("/api/students/cancel-registration/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    // Tìm và xóa sinh viên theo mã sinh viên
    await Student.findOneAndDelete({ studentId });

    console.log(`Student registration canceled: ${studentId}`);
    res.status(200).json({ message: "Đã hủy đăng ký sinh viên thành công" });
  } catch (error) {
    console.error("Error canceling student registration:", error);
    res.status(500).json({ message: "Lỗi khi hủy đăng ký sinh viên" });
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

    // Process records but include all students, not just present ones
    const processedRecords = attendanceRecords.map((record) => {
      const plainRecord = record.toObject();

      if (plainRecord.students && Array.isArray(plainRecord.students)) {
        // Include all students, not just those with "present" status
        plainRecord.students = plainRecord.students.map((student) => {
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

// API lấy chi tiết điểm danh của một buổi học
app.get("/api/attendance/:id/details", async (req, res) => {
  try {
    // Kiểm tra ID của buổi điểm danh
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "ID buổi điểm danh không hợp lệ" });
    }

    // Tìm buổi điểm danh
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: "Không tìm thấy buổi điểm danh" });
    }

    // Tìm tất cả bản ghi điểm danh của buổi học này
    const attendanceRecords = await AttendanceRecord.find({
      attendance: req.params.id,
    })
      .populate("student", "name studentId")
      .lean();

    // Phân loại theo trạng thái tham dự
    const presentStudents = attendanceRecords.filter(
      (record) => record.present
    );
    const absentStudents = attendanceRecords.filter(
      (record) => !record.present
    );

    // Tính tỷ lệ tham dự
    const totalStudents = attendanceRecords.length;
    const presentCount = presentStudents.length;
    const absentCount = absentStudents.length;
    const attendanceRate =
      totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

    // Cập nhật lại thống kê cho chắc chắn
    if (
      attendance.stats.totalStudents !== totalStudents ||
      attendance.stats.presentCount !== presentCount ||
      attendance.stats.absentCount !== absentCount
    ) {
      attendance.stats = {
        totalStudents,
        presentCount,
        absentCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      };

      await attendance.save();
      console.log(`Updated attendance stats for session ${attendance._id}`);
    }

    // Trả về thông tin chi tiết
    res.json({
      attendance,
      records: {
        all: attendanceRecords,
        present: presentStudents,
        absent: absentStudents,
      },
      stats: {
        totalStudents,
        presentCount,
        absentCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    res.status(500).json({ message: error.message });
  }
});

// Sửa lại API cập nhật trạng thái điểm danh
app.put("/api/attendance/:id/student/:studentId", async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { present = true, method = "manual", note } = req.body;

    console.log(
      `Marking student ${studentId} as ${
        present ? "present" : "absent"
      } for attendance ${id}`
    );

    // Kiểm tra attendance ID có hợp lệ không
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ message: "ID buổi điểm danh không hợp lệ" });
    }

    // Kiểm tra student ID có hợp lệ không
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ message: "ID sinh viên không hợp lệ" });
    }

    // Tìm buổi điểm danh
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Không tìm thấy buổi điểm danh" });
    }

    // Tìm lớp học
    const classDoc = await Class.findById(attendance.class);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra xem sinh viên có thuộc lớp học này không
    const isStudentInClass = await ClassStudent.findOne({
      class: attendance.class,
      student: studentId,
    });

    if (!isStudentInClass) {
      return res
        .status(404)
        .json({ message: "Sinh viên không thuộc lớp học này" });
    }

    // Tìm hoặc tạo bản ghi điểm danh
    let record = await AttendanceRecord.findOne({
      attendance: id,
      student: studentId,
    });

    if (record) {
      // Cập nhật bản ghi hiện có
      record.present = present;
      record.method = method;
      record.recordTime = new Date();
      if (note) record.note = note;
    } else {
      // Tạo bản ghi mới
      record = new AttendanceRecord({
        attendance: id,
        class: attendance.class,
        student: studentId,
        present: present,
        method: method,
        recordTime: new Date(),
        note: note,
      });
    }

    // Lưu bản ghi điểm danh
    await record.save();

    // Nếu buổi điểm danh đã hoàn thành, cập nhật lại thống kê
    if (attendance.status === "completed") {
      // Tính lại thống kê
      const allRecords = await AttendanceRecord.find({ attendance: id });
      const totalStudents = allRecords.length;
      const presentCount = allRecords.filter((r) => r.present).length;
      const absentCount = totalStudents - presentCount;
      const attendanceRate =
        totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

      // Cập nhật thống kê
      attendance.stats = {
        totalStudents,
        presentCount,
        absentCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      };

      await attendance.save();
      console.log(`Updated stats for completed attendance session ${id}`);
    }

    // Trả về thông tin bản ghi điểm danh
    res.json({
      message: `Đã đánh dấu sinh viên ${present ? "có mặt" : "vắng mặt"}`,
      record,
    });
  } catch (error) {
    console.error("Error marking student attendance:", error);
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
    const attendanceRecords = await Attendance.find({ class: id }).lean();

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
      .lean()
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
    if (account.status !== "active" && account.status !== "temporary") {
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

// Xử lý đăng nhập Google
app.post("/api/auth/google", async (req, res) => {
  try {
    console.log("Đang xử lý đăng nhập Google với dữ liệu:", {
      hasGoogleToken: !!req.body.googleToken,
      role: req.body.role,
    });

    const { googleToken, role = "teacher" } = req.body;

    if (!googleToken) {
      return res.status(400).json({ message: "googleToken is required" });
    }

    // Giải mã token để lấy thông tin người dùng
    let decodedToken;
    try {
      decodedToken = jwt.decode(googleToken);
      if (!decodedToken) {
        console.error(
          "Token không giải mã được:",
          googleToken.substring(0, 20) + "..."
        );
        return res.status(400).json({ message: "Token không hợp lệ" });
      }
    } catch (decodeErr) {
      console.error("Lỗi giải mã token:", decodeErr);
      return res.status(400).json({
        message: "Không thể giải mã token",
        error: decodeErr.message,
      });
    }

    const { email, name, sub: googleId } = decodedToken;

    console.log(
      `Google login attempt for: ${email}, GoogleID: ${googleId}, Role: ${role}`
    );

    try {
      // Tìm xem tài khoản đã tồn tại chưa
      let account = await Account.findOne({ $or: [{ email }, { googleId }] });
      let isNewUser = false;

      if (account) {
        // Tài khoản đã tồn tại
        console.log(
          "Found existing account:",
          account.email,
          "Status:",
          account.status,
          "Role:",
          account.role
        );

        // Kiểm tra nếu role không khớp với yêu cầu
        if (account.role !== role) {
          return res.status(403).json({
            message: `Tài khoản của bạn đã đăng ký với vai trò ${
              account.role === "teacher" ? "giảng viên" : "sinh viên"
            }. Vui lòng đăng nhập đúng vai trò.`,
            wrongRole: true,
          });
        }

        if (account.status === "pending") {
          return res.status(403).json({
            message: `Tài khoản ${
              role === "teacher" ? "giảng viên" : "sinh viên"
            } của bạn đang chờ được phê duyệt`,
            isPending: true,
          });
        }

        if (account.status === "blocked") {
          return res
            .status(403)
            .json({ message: "Tài khoản của bạn đã bị khóa" });
        }

        // Cập nhật googleId nếu chưa có
        if (!account.googleId) {
          account.googleId = googleId;
          await account.save();
        }
      } else {
        // Tạo tài khoản mới với trạng thái khác nhau tùy theo role
        console.log(`Creating new ${role} account for:`, email);

        // Cả giảng viên và sinh viên đều bắt đầu với trạng thái temporary
        const initialStatus = "temporary";
        isNewUser = true;

        const newAccountData = {
          name,
          email,
          googleId,
          password: crypto.randomBytes(20).toString("hex"), // Mật khẩu ngẫu nhiên
          role: role, // Lấy từ request
          status: initialStatus,
          createdAt: new Date(),
        };

        console.log("Creating account with data:", newAccountData);

        account = new Account(newAccountData);

        await account.save();
        console.log("Account created successfully:", account._id);

        // Cả sinh viên và giảng viên đều được tiếp tục để đăng ký thông tin
        console.log(
          `New ${role} account created with temporary status, redirecting to registration`
        );
      }

      // Tạo token JWT cho đăng nhập thành công - trực tiếp thay vì dùng hàm
      // Sử dụng cùng secret key và cấu trúc payload với middleware auth.js
      const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-123456789";
      const token = jwt.sign({ id: account._id }, JWT_SECRET, {
        expiresIn: "7d",
      });

      // Cập nhật thời gian đăng nhập cuối
      account.lastLogin = new Date();
      await account.save();

      console.log("Login successful for:", account.email);

      res.json({
        token,
        user: account,
        isNewUser, // Gửi flag để biết có phải user mới không (dùng cho sinh viên)
      });
    } catch (dbError) {
      console.error("Database error in Google auth:", dbError);
      return res.status(500).json({
        message: "Lỗi cơ sở dữ liệu khi xử lý đăng nhập",
        error: dbError.message,
        stack: dbError.stack,
      });
    }
  } catch (error) {
    console.error("Uncaught error in Google authentication:", error);
    res.status(500).json({
      message: "Lỗi xác thực Google",
      error: error.message,
      stack: error.stack,
    });
  }
});

// ==================== TEACHER ROUTES ====================

// Thêm route đăng ký thông tin giảng viên
app.post("/api/teachers/register", auth, async (req, res) => {
  try {
    const { name, departmentId, phone, address, title, bio } = req.body;
    const userId = req.account._id;

    console.log(`Processing teacher registration for account: ${userId}`);

    // Kiểm tra account
    const account = await Account.findById(userId);
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Kiểm tra khoa
    if (departmentId) {
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({ message: "Không tìm thấy khoa" });
      }
    }

    // Cập nhật thông tin giảng viên
    let teacher = await Teacher.findOne({ account: userId });

    if (teacher) {
      // Cập nhật nếu đã tồn tại
      teacher.name = name;
      teacher.department = departmentId;
      teacher.phone = phone;
      teacher.address = address;
      teacher.title = title || "Giảng viên";
      teacher.bio = bio || "";
      await teacher.save();
      console.log(`Updated existing teacher record: ${teacher._id}`);
    } else {
      // Tạo mới nếu chưa tồn tại
      teacher = await Teacher.create({
        account: userId,
        name,
        department: departmentId,
        phone,
        address,
        title: title || "Giảng viên",
        bio: bio || "",
      });
      console.log(`Created new teacher record: ${teacher._id}`);
    }

    // Cập nhật tài khoản nhưng giữ trạng thái "pending"
    account.name = name;
    // Không đổi trạng thái thành active, giữ nguyên để admin phê duyệt
    if (account.status === "temporary") {
      account.status = "pending"; // Nếu là tài khoản tạm thời, chuyển sang pending
    }
    await account.save();

    console.log(
      `Teacher registration completed for: ${account.name}, status: ${account.status}`
    );
    res.status(200).json(account);
  } catch (error) {
    console.error("Error registering teacher info:", error);
    res.status(500).json({ message: "Lỗi khi đăng ký thông tin giảng viên" });
  }
});

// Kiểm tra thông tin giảng viên - Xem giảng viên đã hoàn tất đăng ký thông tin chưa
app.get("/api/teachers/profile/:accountId", auth, async (req, res) => {
  try {
    const { accountId } = req.params;

    console.log(`Checking teacher profile for account: ${accountId}`);

    // Kiểm tra xem có phải chính tài khoản của người dùng hoặc admin không
    if (
      req.account.role !== "admin" &&
      req.account._id.toString() !== accountId
    ) {
      return res
        .status(403)
        .json({ message: "Không có quyền truy cập thông tin này" });
    }

    // Tìm thông tin tài khoản thay vì tìm thông tin từ model Teacher
    const account = await Account.findById(accountId);

    if (!account || account.role !== "teacher") {
      console.log(`No teacher profile found for account: ${accountId}`);
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin giảng viên" });
    }

    // Nếu vẫn cần thông tin từ Teacher model (đối với code đang chuyển đổi)
    let additionalInfo = {};
    const teacherInfo = await Teacher.findOne({ account: accountId }).populate(
      "department"
    );
    if (teacherInfo) {
      additionalInfo = {
        departmentId: teacherInfo.department?._id,
        departmentName: teacherInfo.department?.name,
        phone: teacherInfo.phone,
        address: teacherInfo.address,
        title: teacherInfo.title,
        bio: teacherInfo.bio,
      };
    }

    console.log(`Teacher profile found for: ${account.name}`);
    res.status(200).json({
      _id: account._id,
      name: account.name,
      email: account.email,
      role: account.role,
      status: account.status,
      createdAt: account.createdAt,
      lastLogin: account.lastLogin,
      ...additionalInfo,
    });
  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin giảng viên" });
  }
});

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

    // Tìm kiếm trong Account model
    const teacher = await Account.findById(id);

    // Log kết quả tìm kiếm
    console.log(
      "Teacher lookup result:",
      teacher
        ? {
            _id: teacher._id,
            name: teacher.name,
            email: teacher.email,
            role: teacher.role,
          }
        : "Not found"
    );

    // Trả về thông tin mặc định nếu không tìm thấy
    if (!teacher) {
      return res.json({
        _id: id,
        name: "Không xác định",
        role: "unknown",
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
    // Trả về thông tin mặc định thay vì báo lỗi
    res.json({
      _id: req.params.id,
      name: "Không có thông tin",
      role: "unknown",
      error: true,
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Lấy danh sách tất cả giáo viên (admin và giảng viên)
app.get("/api/admin/teachers", auth, async (req, res) => {
  try {
    // Kiểm tra quyền: chỉ cho phép admin hoặc giảng viên
    if (req.account.role !== "admin" && req.account.role !== "teacher") {
      return res.status(403).json({
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    console.log(
      `User ${req.account.name} (${req.account.role}) fetching teachers list`
    );
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

// Endpoint duyệt tài khoản giáo viên (chỉ admin)
app.put(
  "/api/admin/teachers/:id/approve",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Approving teacher account: ${id}`);

      // Kiểm tra ID hợp lệ
      if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "ID tài khoản không hợp lệ" });
      }

      // Tìm tài khoản
      const account = await Account.findById(id);
      if (!account) {
        return res.status(404).json({ message: "Không tìm thấy tài khoản" });
      }

      // Cập nhật trạng thái
      account.status = "active";
      await account.save();

      console.log(`Teacher account approved: ${account.email}`);
      res
        .status(200)
        .json({ message: "Đã duyệt tài khoản thành công", account });
    } catch (error) {
      console.error("Error approving teacher account:", error);
      res.status(500).json({ message: "Lỗi khi duyệt tài khoản giảng viên" });
    }
  }
);

// Endpoint từ chối tài khoản giáo viên (chỉ admin)
app.put("/api/admin/teachers/:id/reject", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Rejecting teacher account: ${id}`);

    // Kiểm tra ID hợp lệ
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID tài khoản không hợp lệ" });
    }

    // Tìm tài khoản
    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Tìm và xóa thông tin giảng viên liên quan
    const teacher = await Teacher.findOne({ account: id });
    if (teacher) {
      console.log(`Xóa thông tin giảng viên ID: ${teacher._id}`);
      await Teacher.findByIdAndDelete(teacher._id);
    } else {
      console.log(`Không tìm thấy thông tin giảng viên cho tài khoản: ${id}`);
    }

    // Cập nhật trạng thái tài khoản
    account.status = "blocked";
    await account.save();

    console.log(`Teacher account rejected: ${account.email}`);
    res
      .status(200)
      .json({ message: "Đã từ chối tài khoản thành công", account });
  } catch (error) {
    console.error("Error rejecting teacher account:", error);
    res.status(500).json({ message: "Lỗi khi từ chối tài khoản giảng viên" });
  }
});

// Endpoint từ chối tài khoản sinh viên (chỉ admin và giáo viên)
app.put("/api/admin/students/:id/reject", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Rejecting student account: ${id}`);

    // Kiểm tra quyền: admin hoặc giáo viên
    if (req.account.role !== "admin" && req.account.role !== "teacher") {
      return res.status(403).json({ message: "Không có quyền thực hiện" });
    }

    // Kiểm tra ID hợp lệ
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID tài khoản không hợp lệ" });
    }

    // Tìm tài khoản
    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Kiểm tra xem tài khoản có phải đang pending không
    if (account.status !== "pending") {
      return res.status(400).json({
        message: "Chỉ có thể từ chối tài khoản đang chờ duyệt",
      });
    }

    // Kiểm tra liên kết sinh viên hiện tại (cách cũ)
    if (account.studentId) {
      const student = await Student.findById(account.studentId);
      if (student) {
        console.log(`Xóa thông tin sinh viên ID: ${student._id}`);

        // Xóa sinh viên khỏi các lớp học
        if (student.classes && student.classes.length > 0) {
          for (const classId of student.classes) {
            await Class.findByIdAndUpdate(classId, {
              $pull: { students: student._id },
            });
            console.log(`Đã xóa sinh viên khỏi lớp ${classId}`);
          }
        }

        // Xóa sinh viên
        await Student.findByIdAndDelete(student._id);
      }
    }

    // Xóa thông tin tạm thời (cách mới)
    account.pendingStudentInfo = null;
    account.studentId = null;
    account.status = "blocked";
    await account.save();

    console.log(`Student account rejected: ${account.email}`);
    res
      .status(200)
      .json({ message: "Đã từ chối tài khoản sinh viên thành công", account });
  } catch (error) {
    console.error("Error rejecting student account:", error);
    res.status(500).json({ message: "Lỗi khi từ chối tài khoản sinh viên" });
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
    const {
      name,
      description,
      startDate,
      totalSessions,
      mainClass,
      department,
      campus,
      room,
      classroom,
    } = req.body;

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

    // Cập nhật thông tin mainClass
    if (mainClass !== undefined) {
      classToUpdate.mainClass = mainClass;
    }

    // Cập nhật thông tin khoa
    if (department !== undefined) {
      classToUpdate.department = department ? department : null;
    }

    // Cập nhật thông tin phòng học
    if (room) {
      classToUpdate.room = {
        room: room.room || "",
        floor: room.floor || "",
        building: room.building || "",
      };
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

// ==================== DEPARTMENT ROUTES ====================

// Lấy danh sách tất cả khoa
app.get("/api/departments", async (req, res) => {
  try {
    console.log("Fetching all departments");
    const departments = await Department.find().sort({ name: 1 });
    console.log(`Found ${departments.length} departments`);
    res.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách khoa",
      error: error.message,
    });
  }
});

// Tạo khoa mới (chỉ admin có quyền)
app.post("/api/admin/departments", auth, adminOnly, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    console.log(`Creating new department: ${name}, code: ${code}`);

    if (!name || !code) {
      return res.status(400).json({
        message: "Tên khoa và mã khoa không được để trống",
      });
    }

    // Kiểm tra tên khoa đã tồn tại
    const existingDepartmentByName = await Department.findOne({ name });
    if (existingDepartmentByName) {
      return res.status(400).json({
        message: "Tên khoa đã tồn tại",
      });
    }

    // Kiểm tra mã khoa đã tồn tại
    const existingDepartmentByCode = await Department.findOne({ code });
    if (existingDepartmentByCode) {
      return res.status(400).json({
        message: "Mã khoa đã tồn tại",
      });
    }

    const department = new Department({
      name,
      code,
      description,
    });

    await department.save();
    console.log(`Department created with ID: ${department._id}`);

    res.status(201).json(department);
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      message: "Lỗi khi tạo khoa mới",
      error: error.message,
    });
  }
});

// Cập nhật thông tin khoa (chỉ admin có quyền)
app.put("/api/admin/departments/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    console.log(`Updating department: ${id}, name: ${name}, code: ${code}`);

    if (!name || !code) {
      return res.status(400).json({
        message: "Tên khoa và mã khoa không được để trống",
      });
    }

    // Kiểm tra nếu tên mới đã tồn tại (ngoại trừ khoa hiện tại)
    const existingDepartmentByName = await Department.findOne({
      name,
      _id: { $ne: id },
    });

    if (existingDepartmentByName) {
      return res.status(400).json({
        message: "Tên khoa đã tồn tại",
      });
    }

    // Kiểm tra nếu mã mới đã tồn tại (ngoại trừ khoa hiện tại)
    const existingDepartmentByCode = await Department.findOne({
      code,
      _id: { $ne: id },
    });

    if (existingDepartmentByCode) {
      return res.status(400).json({
        message: "Mã khoa đã tồn tại",
      });
    }

    const department = await Department.findByIdAndUpdate(
      id,
      { name, code, description },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({
        message: "Không tìm thấy khoa",
      });
    }

    console.log(`Department updated: ${department._id}`);
    res.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật thông tin khoa",
      error: error.message,
    });
  }
});

// Xóa khoa (chỉ admin có quyền)
app.delete("/api/admin/departments/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting department: ${id}`);

    // Kiểm tra xem có lớp nào thuộc khoa này không
    const classesInDepartment = await Class.find({ department: id });
    if (classesInDepartment.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa khoa này vì có lớp học đang sử dụng",
      });
    }

    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      return res.status(404).json({
        message: "Không tìm thấy khoa",
      });
    }

    console.log(`Department deleted: ${id}`);
    res.json({
      message: "Đã xóa khoa thành công",
      department,
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      message: "Lỗi khi xóa khoa",
      error: error.message,
    });
  }
});

// Lấy tất cả lớp học trong một khoa
app.get("/api/departments/:id/classes", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching classes for department: ${id}`);

    const classes = await Class.find({
      department: id,
      mainClass: true,
    }).sort({ name: 1 });

    console.log(`Found ${classes.length} classes in department`);
    res.json(classes);
  } catch (error) {
    console.error("Error fetching classes by department:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách lớp học theo khoa",
      error: error.message,
    });
  }
});

// Lấy tất cả sinh viên trong một khoa
app.get("/api/departments/:id/students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching students for department: ${id}`);

    // Tìm tất cả các lớp chính thuộc khoa
    const classesInDepartment = await Class.find({
      department: id,
      mainClass: true,
    }).select("_id");

    const classIds = classesInDepartment.map((c) => c._id);

    // Tìm tất cả sinh viên thuộc các lớp chính trong khoa
    const students = await Student.find({
      mainClassId: { $in: classIds },
    }).sort({ name: 1 });

    console.log(`Found ${students.length} students in department`);
    res.json(students);
  } catch (error) {
    console.error("Error fetching students by department:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên theo khoa",
      error: error.message,
    });
  }
});

// ==================== ADMIN CLASS ROUTES ====================

// Lấy danh sách tất cả lớp quản lý (AdminClass)
app.get("/api/admin-classes", auth, async (req, res) => {
  try {
    console.log(
      `User ${req.account?.name} (${req.account?.role}) fetching admin classes`
    );

    let query = {};

    // Kiểm tra query parameter "all"
    const showAll = req.query.all === "true";

    // Nếu là giảng viên và không yêu cầu xem tất cả, chỉ hiển thị các lớp họ là chủ nhiệm
    if (req.account && req.account.role === "teacher" && !showAll) {
      console.log(
        `Teacher ${req.account.name} requesting their managed classes`
      );
      query.mainTeacher = req.account._id;
    }

    const adminClasses = await AdminClass.find(query)
      .populate("department", "name code")
      .populate("mainTeacher", "name email")
      .sort({ name: 1 });

    console.log(`Found ${adminClasses.length} admin classes`);
    res.json(adminClasses);
  } catch (error) {
    console.error("Error fetching admin classes:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách lớp quản lý",
      error: error.message,
    });
  }
});

// Lấy thông tin chi tiết lớp quản lý theo ID
app.get("/api/admin-classes/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching admin class with ID: ${id}`);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    const adminClass = await AdminClass.findById(id)
      .populate("department", "name code")
      .populate("mainTeacher", "name email");

    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    res.json(adminClass);
  } catch (error) {
    console.error("Error fetching admin class:", error);
    res.status(500).json({
      message: "Lỗi khi tải thông tin lớp quản lý",
      error: error.message,
    });
  }
});

// Tạo lớp quản lý mới (giảng viên & admin)
app.post("/api/admin-classes", auth, async (req, res) => {
  try {
    console.log("Request body:", req.body); // Debug: Kiểm tra dữ liệu gửi lên
    const { name, code, department, entryYear, description, mainTeacher } =
      req.body;
    console.log(
      `User ${req.account.name} (${req.account.role}) creating new admin class: ${name}, code: ${code}, mainTeacher: ${mainTeacher}`
    );

    // Chỉ cho phép admin và giảng viên tạo lớp quản lý
    if (req.account.role !== "admin" && req.account.role !== "teacher") {
      return res.status(403).json({
        message: "Bạn không có quyền tạo lớp quản lý",
      });
    }

    // Validate required fields
    if (!name || !code || !department || !entryYear) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ thông tin lớp quản lý",
      });
    }

    if (!isValidObjectId(department)) {
      return res.status(400).json({
        message: "ID khoa không hợp lệ",
      });
    }

    // Check if department exists
    const departmentExists = await Department.findById(department);
    if (!departmentExists) {
      return res.status(404).json({
        message: "Không tìm thấy khoa",
      });
    }

    // Check if class code already exists
    const existingClass = await AdminClass.findOne({ code });
    if (existingClass) {
      return res.status(400).json({
        message: "Mã lớp đã tồn tại",
      });
    }

    // Xử lý giá trị mainTeacher
    let finalMainTeacher = null;

    // Nếu mainTeacher được chỉ định và không phải null/undefined
    if (mainTeacher) {
      if (!isValidObjectId(mainTeacher)) {
        return res.status(400).json({
          message: "ID giảng viên chủ nhiệm không hợp lệ",
        });
      }

      const teacherExists = await Account.findById(mainTeacher);
      if (!teacherExists || teacherExists.role !== "teacher") {
        return res.status(400).json({
          message:
            "Không tìm thấy giảng viên chủ nhiệm hoặc không có quyền giảng viên",
        });
      }

      finalMainTeacher = mainTeacher;
    }
    // Giảng viên tạo lớp sẽ tự động trở thành chủ nhiệm nếu không chỉ định
    else if (req.account.role === "teacher") {
      finalMainTeacher = req.account._id;
    }

    console.log("Final mainTeacher value for new class:", finalMainTeacher); // Debug

    // Create new admin class
    const newAdminClass = new AdminClass({
      name,
      code,
      department,
      entryYear: parseInt(entryYear),
      description: description || "",
      mainTeacher: finalMainTeacher,
    });

    const savedClass = await newAdminClass.save();

    console.log("Saved class:", savedClass); // Debug

    // Populate department and mainTeacher for response
    const populatedClass = await AdminClass.findById(savedClass._id)
      .populate("department", "name code")
      .populate("mainTeacher", "name email");

    // Update department class count
    await Department.updateAdminClassCount(department);

    console.log(`Admin class created successfully with ID: ${savedClass._id}`);
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error("Error creating admin class:", error);
    res.status(500).json({
      message: "Lỗi khi tạo lớp quản lý mới",
      error: error.message,
    });
  }
});

// Cập nhật thông tin lớp quản lý (chỉ admin)
app.put("/api/admin-classes/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Update request body:", req.body); // Debug
    const { name, description, entryYear, mainTeacher } = req.body;
    console.log(
      `Updating admin class with ID: ${id}, mainTeacher: ${mainTeacher}`
    );

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Validate mainTeacher if not null or undefined
    if (mainTeacher && !isValidObjectId(mainTeacher)) {
      return res.status(400).json({
        message: "ID giảng viên chủ nhiệm không hợp lệ",
      });
    }

    // Check if main teacher exists (if provided)
    if (mainTeacher) {
      const teacherExists = await Account.findById(mainTeacher);
      if (!teacherExists || teacherExists.role !== "teacher") {
        return res.status(404).json({
          message:
            "Không tìm thấy giảng viên chủ nhiệm hoặc không có quyền giảng viên",
        });
      }
    }

    // Update fields
    if (name) adminClass.name = name;
    if (description !== undefined) adminClass.description = description;
    if (entryYear) adminClass.entryYear = parseInt(entryYear);

    // Xử lý cập nhật mainTeacher
    // Chỉ cập nhật nếu mainTeacher xuất hiện trong request (kể cả khi giá trị là null)
    if (mainTeacher !== undefined) {
      console.log("Setting mainTeacher to:", mainTeacher); // Debug
      adminClass.mainTeacher = mainTeacher;
    }

    const updatedClass = await adminClass.save();
    console.log("Saved updated class:", updatedClass); // Debug

    // Populate department and mainTeacher for response
    const populatedClass = await AdminClass.findById(updatedClass._id)
      .populate("department", "name code")
      .populate("mainTeacher", "name email");

    console.log(`Admin class updated successfully: ${updatedClass._id}`);

    res.json({
      message: "Cập nhật thông tin lớp quản lý thành công",
      adminClass: populatedClass,
    });
  } catch (error) {
    console.error("Error updating admin class:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật thông tin lớp quản lý",
      error: error.message,
    });
  }
});

// Xóa lớp quản lý (chỉ admin)
app.delete("/api/admin-classes/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting admin class with ID: ${id}`);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Check if class has students
    const studentCount = await Student.countDocuments({ adminClass: id });
    if (studentCount > 0) {
      return res.status(400).json({
        message: "Không thể xóa lớp quản lý đã có sinh viên",
        studentCount,
      });
    }

    // Store department ID for updating count later
    const departmentId = adminClass.department;

    // Delete the admin class
    await AdminClass.findByIdAndDelete(id);
    console.log(`Admin class deleted successfully: ${id}`);

    // Update department class count
    if (departmentId) {
      await Department.updateAdminClassCount(departmentId);
    }

    res.json({
      message: "Xóa lớp quản lý thành công",
    });
  } catch (error) {
    console.error("Error deleting admin class:", error);
    res.status(500).json({
      message: "Lỗi khi xóa lớp quản lý",
      error: error.message,
    });
  }
});

// Lấy danh sách sinh viên trong lớp quản lý
app.get("/api/admin-classes/:id/students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { showPending } = req.query; // Thêm tham số query để hiển thị cả sinh viên pending nếu cần
    console.log(`Fetching students for admin class with ID: ${id}`);
    console.log(`Show pending students: ${showPending ? "Yes" : "No"}`);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    // Kiểm tra xem lớp quản lý có tồn tại không
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Tìm tất cả sinh viên thuộc lớp quản lý này
    const studentsQuery = Student.find({ adminClass: id }).sort({ name: 1 });
    const allStudents = await studentsQuery;

    // Nếu không yêu cầu hiển thị pending, lọc ra sinh viên có tài khoản đã active
    if (!showPending) {
      // Lấy danh sách tất cả ID sinh viên
      const studentIds = allStudents.map((student) => student._id);

      // Tìm tài khoản pending liên kết với các sinh viên này
      const pendingAccounts = await Account.find({
        studentId: { $in: studentIds },
        status: "pending",
      });

      // Lấy ra ID của sinh viên có tài khoản pending
      const pendingStudentIds = pendingAccounts
        .map((account) =>
          account.studentId ? account.studentId.toString() : null
        )
        .filter((id) => id !== null);

      // Lọc ra những sinh viên không có trong danh sách pending
      const activeStudents = allStudents.filter(
        (student) => !pendingStudentIds.includes(student._id.toString())
      );

      console.log(
        `Found ${allStudents.length} total students, ${activeStudents.length} active students in admin class ${id}`
      );
      return res.json(activeStudents);
    }

    console.log(
      `Found ${allStudents.length} students in admin class ${id} (including pending)`
    );
    res.json(allStudents);
  } catch (error) {
    console.error("Error fetching students in admin class:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên trong lớp quản lý",
      error: error.message,
    });
  }
});

// Lấy danh sách sinh viên chờ duyệt trong lớp quản lý (alias)
app.get("/api/admin-classes/:id/students-pending", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `API (Alias): Fetching pending students for admin class with ID: ${id}`
    );

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    // Kiểm tra xem lớp quản lý có tồn tại không
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Kiểm tra quyền truy cập: chỉ admin hoặc giảng viên chủ nhiệm mới được xem
    if (
      req.account.role !== "admin" &&
      (!adminClass.mainTeacher ||
        adminClass.mainTeacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập thông tin lớp quản lý này",
      });
    }

    // Get all students in this admin class first
    const students = await Student.find({ adminClass: id });

    // No students in this class at all
    if (students.length === 0) {
      return res.json([]);
    }

    // Get student IDs for looking up in accounts
    const studentIds = students.map((student) => student._id);

    // Find all accounts that reference these students and are pending
    const pendingAccounts = await Account.find({
      studentId: { $in: studentIds },
      status: "pending",
    });

    // Prepare result by combining student data with account data
    const result = [];
    for (const account of pendingAccounts) {
      if (account.studentId) {
        const student = students.find(
          (s) => s._id.toString() === account.studentId.toString()
        );
        if (student) {
          result.push({
            ...student.toObject(),
            account: {
              _id: account._id,
              email: account.email,
              status: account.status,
              createdAt: account.createdAt,
            },
          });
        }
      }
    }

    console.log(`Alias endpoint returning ${result.length} pending students`);
    res.json(result);
  } catch (error) {
    console.error("Error fetching pending students (alias):", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên chờ duyệt",
      error: error.message,
    });
  }
});

// Lấy tất cả sinh viên chờ duyệt cho tất cả các lớp (endpoint mới)
app.get("/api/admin-classes/all-pending-students", auth, async (req, res) => {
  try {
    console.log(`API: Fetching all pending students for all classes`);
    console.log(
      `User: ${req.account.name}, Role: ${req.account.role}, ID: ${req.account._id}`
    );

    // Nếu không phải admin, chỉ lấy sinh viên chờ duyệt cho các lớp mà giáo viên quản lý
    let adminClassQuery = {};
    if (req.account.role !== "admin") {
      adminClassQuery.mainTeacher = req.account._id;
    }

    // Lấy danh sách lớp
    const adminClasses = await AdminClass.find(adminClassQuery).select("_id");
    const adminClassIds = adminClasses.map((c) => c._id);

    // Tìm tài khoản sinh viên chờ duyệt thuộc các lớp này
    const pendingAccounts = await Account.find({
      role: "student",
      status: "pending",
      "pendingStudentInfo.adminClass": { $in: adminClassIds },
    });

    if (pendingAccounts.length === 0) {
      console.log(`No pending student accounts found`);
      return res.json([]);
    }

    // Format response with minimal data (for backward compatibility)
    const result = pendingAccounts.map((account) => {
      return {
        _id: account._id,
        adminClass: account.pendingStudentInfo?.adminClass,
        accountId: account._id,
      };
    });

    console.log(`Found ${result.length} pending students across all classes`);
    res.json(result);
  } catch (error) {
    console.error("Error fetching all pending students:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên chờ duyệt",
      error: error.message,
    });
  }
});

// Endpoint mới - Lấy tất cả sinh viên chờ duyệt cho tất cả các lớp (student-approvals)
app.get("/api/admin-classes/all-student-approvals", auth, async (req, res) => {
  try {
    console.log(`API: Fetching all student approvals for all classes`);
    console.log(
      `User: ${req.account.name}, Role: ${req.account.role}, ID: ${req.account._id}`
    );

    // Nếu không phải admin, chỉ lấy sinh viên chờ duyệt cho các lớp mà giáo viên quản lý
    let adminClassQuery = {};
    if (req.account.role !== "admin") {
      adminClassQuery.mainTeacher = req.account._id;
    }

    // Lấy danh sách lớp
    const adminClasses = await AdminClass.find(adminClassQuery).select("_id");
    const adminClassIds = adminClasses.map((c) => c._id);

    // Tìm tài khoản sinh viên chờ duyệt thuộc các lớp này
    const pendingAccounts = await Account.find({
      role: "student",
      status: "pending",
      "pendingStudentInfo.adminClass": { $in: adminClassIds },
    });

    console.log(
      `Found ${pendingAccounts.length} pending students across all classes`
    );

    // Format response
    const result = pendingAccounts.map((account) => {
      return {
        _id: account._id,
        adminClass: account.pendingStudentInfo?.adminClass,
        name: account.name,
        studentId: account.pendingStudentInfo?.studentIdNumber || "N/A",
        email: account.email,
        phone: account.pendingStudentInfo?.phone || "N/A",
        gender: account.pendingStudentInfo?.gender || "male",
        account: {
          _id: account._id,
          email: account.email,
          status: account.status,
          createdAt: account.createdAt,
        },
        createdAt: account.createdAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching all student approvals:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách sinh viên chờ duyệt",
      error: error.message,
    });
  }
});

// Thêm sinh viên vào lớp quản lý
app.post("/api/admin-classes/:id/students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, studentId, email, phone, gender } = req.body;
    console.log(
      `User ${req.account.name} (${req.account.role}) adding student to admin class with ID: ${id}`
    );

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    // Kiểm tra thông tin bắt buộc
    if (!name || !studentId) {
      return res.status(400).json({
        message: "Vui lòng cung cấp tên và mã sinh viên",
      });
    }

    // Kiểm tra xem lớp quản lý có tồn tại không
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Kiểm tra quyền hạn: Admin hoặc giảng viên chủ nhiệm của lớp này
    if (
      req.account.role !== "admin" &&
      (!adminClass.mainTeacher ||
        adminClass.mainTeacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền thêm sinh viên vào lớp này",
      });
    }

    // Kiểm tra xem mã sinh viên đã tồn tại chưa
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      // Thêm kiểm tra xem sinh viên đã thuộc lớp quản lý này chưa
      if (
        existingStudent.adminClass &&
        existingStudent.adminClass.toString() === id
      ) {
        return res.status(400).json({
          message: "Sinh viên này đã thuộc lớp quản lý này",
        });
      }

      // Nếu sinh viên thuộc lớp quản lý khác
      if (existingStudent.adminClass) {
        const currentClass = await AdminClass.findById(
          existingStudent.adminClass
        );
        const className = currentClass ? currentClass.name : "Không xác định";

        return res.status(400).json({
          message: "Mã sinh viên đã tồn tại và thuộc lớp khác",
          studentInfo: {
            id: existingStudent._id,
            name: existingStudent.name,
            studentId: existingStudent.studentId,
            currentClassName: className,
          },
        });
      }

      return res.status(400).json({
        message: "Mã sinh viên đã tồn tại trong hệ thống",
        studentInfo: {
          id: existingStudent._id,
          name: existingStudent.name,
          studentId: existingStudent.studentId,
        },
      });
    }

    // Tạo sinh viên mới
    const newStudent = new Student({
      name,
      studentId,
      email,
      phone,
      gender,
      adminClass: id,
    });

    const savedStudent = await newStudent.save();
    console.log(`Student added to admin class ${id}: ${savedStudent._id}`);

    // Cập nhật số lượng sinh viên trong lớp
    await AdminClass.updateStudentCount(id);

    res.status(201).json({
      message: "Đã thêm sinh viên vào lớp thành công",
      student: savedStudent,
      classInfo: {
        id: adminClass._id,
        name: adminClass.name,
      },
    });
  } catch (error) {
    console.error("Error adding student to admin class:", error);
    res.status(500).json({
      message: "Lỗi khi thêm sinh viên vào lớp quản lý",
      error: error.message,
    });
  }
});

// Xóa sinh viên khỏi lớp quản lý
app.delete(
  "/api/admin-classes/:classId/students/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;
      console.log(
        `User ${req.account.name} (${req.account.role}) removing student ${studentId} from admin class ${classId}`
      );

      // Kiểm tra định dạng ID
      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          message: "ID lớp quản lý không hợp lệ",
          classId,
        });
      }

      if (!isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID sinh viên không hợp lệ",
          studentId,
        });
      }

      // Kiểm tra xem lớp quản lý có tồn tại không
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({
          message: "Không tìm thấy lớp quản lý",
          classId,
        });
      }

      // Kiểm tra quyền hạn: Admin hoặc giảng viên chủ nhiệm của lớp này
      if (
        req.account.role !== "admin" &&
        (!adminClass.mainTeacher ||
          adminClass.mainTeacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền xóa sinh viên khỏi lớp này",
        });
      }

      // Tìm sinh viên
      const student = await Student.findById(studentId);
      if (!student) {
        // Kiểm tra xem có sinh viên nào có mã như vậy không
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
          studentId,
        });
      }

      // Kiểm tra xem sinh viên có thuộc lớp quản lý này không
      if (!student.adminClass) {
        return res.status(400).json({
          message: "Sinh viên này không thuộc lớp quản lý nào",
          studentId,
          studentName: student.name,
        });
      }

      if (student.adminClass.toString() !== classId) {
        return res.status(400).json({
          message: "Sinh viên không thuộc lớp quản lý này",
          studentId,
          studentName: student.name,
          studentClass: student.adminClass.toString(),
          requestedClass: classId,
        });
      }

      // Xóa sinh viên khỏi hệ thống
      await Student.findByIdAndDelete(studentId);
      console.log(`Student ${studentId} removed from admin class ${classId}`);

      // Cập nhật số lượng sinh viên trong lớp
      await AdminClass.updateStudentCount(classId);

      res.json({
        message: "Đã xóa sinh viên khỏi lớp thành công",
        studentInfo: {
          id: studentId,
          name: student.name,
          studentId: student.studentId,
        },
      });
    } catch (error) {
      console.error("Error removing student from admin class:", error);
      res.status(500).json({
        message: "Lỗi khi xóa sinh viên khỏi lớp quản lý",
        error: error.message,
      });
    }
  }
);

// Vô hiệu hóa hoặc kích hoạt lại sinh viên
app.put(
  "/api/admin-classes/:classId/students/:studentId/toggle-status",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;
      console.log(
        `User ${req.account.name} (${req.account.role}) toggling status for student ${studentId} in class ${classId}`
      );

      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID không hợp lệ",
        });
      }

      // Kiểm tra xem lớp quản lý có tồn tại không
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({
          message: "Không tìm thấy lớp quản lý",
        });
      }

      // Kiểm tra quyền hạn: Admin hoặc giảng viên chủ nhiệm của lớp này
      if (
        req.account.role !== "admin" &&
        (!adminClass.mainTeacher ||
          adminClass.mainTeacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền thay đổi trạng thái của sinh viên trong lớp này",
        });
      }

      // Tìm sinh viên
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
        });
      }

      // Kiểm tra xem sinh viên có thuộc lớp quản lý này không
      if (student.adminClass?.toString() !== classId) {
        return res.status(400).json({
          message: "Sinh viên không thuộc lớp quản lý này",
        });
      }

      // Cập nhật trạng thái của sinh viên (đảo ngược trạng thái active)
      student.active = !student.active;
      await student.save();

      // Cập nhật trạng thái tài khoản liên kết nếu có
      if (student.accountId) {
        const account = await Account.findById(student.accountId);
        if (account) {
          account.status = student.active ? "active" : "blocked";
          await account.save();
          console.log(
            `Account status updated to ${account.status}: ${account._id}`
          );
        }
      }

      console.log(
        `Student ${studentId} status toggled to ${
          student.active ? "active" : "inactive"
        }`
      );

      res.json({
        message: `Đã ${
          student.active ? "kích hoạt" : "vô hiệu hóa"
        } sinh viên thành công`,
        active: student.active,
      });
    } catch (error) {
      console.error("Error toggling student status:", error);
      res.status(500).json({
        message: "Lỗi khi thay đổi trạng thái sinh viên",
        error: error.message,
      });
    }
  }
);

// Import sinh viên từ CSV
app.post("/api/admin-classes/:id/import-students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Importing students to admin class with ID: ${id}`);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID lớp quản lý không hợp lệ",
      });
    }

    // Kiểm tra xem lớp quản lý có tồn tại không
    const adminClass = await AdminClass.findById(id);
    if (!adminClass) {
      return res.status(404).json({
        message: "Không tìm thấy lớp quản lý",
      });
    }

    // Giả sử req.body.students là một mảng các sinh viên để import
    const { students } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        message: "Dữ liệu sinh viên không hợp lệ",
      });
    }

    const addedStudents = [];
    let addedCount = 0;
    let errorCount = 0;

    // Xử lý từng sinh viên
    for (const student of students) {
      try {
        // Kiểm tra dữ liệu bắt buộc
        if (!student.name || !student.studentId) {
          console.log(`Invalid student data: ${JSON.stringify(student)}`);
          errorCount++;
          continue;
        }

        // Kiểm tra sinh viên đã tồn tại
        const existingStudent = await Student.findOne({
          studentId: student.studentId,
        });
        if (existingStudent) {
          console.log(`Student already exists: ${student.studentId}`);
          continue;
        }

        // Tạo sinh viên mới
        const newStudent = new Student({
          name: student.name,
          studentId: student.studentId,
          email: student.email,
          phone: student.phone,
          gender: student.gender || "male",
          adminClass: id,
        });

        const savedStudent = await newStudent.save();
        addedStudents.push(savedStudent);
        addedCount++;
      } catch (error) {
        console.error(`Error adding student:`, error);
        errorCount++;
      }
    }

    console.log(`Added ${addedCount} students to admin class ${id}`);
    res.status(201).json({
      message: `Đã thêm ${addedCount} sinh viên vào lớp quản lý`,
      addedCount,
      errorCount,
    });
  } catch (error) {
    console.error("Error importing students:", error);
    res.status(500).json({
      message: "Lỗi khi nhập danh sách sinh viên",
      error: error.message,
    });
  }
});

// Endpoint đơn giản để xóa tài khoản giảng viên
app.delete("/api/teachers/cancel", auth, async (req, res) => {
  try {
    const userId = req.account._id;
    console.log(`Simple teacher account deletion for account: ${userId}`);

    // Tìm thông tin tài khoản
    const account = await Account.findById(userId);
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Tìm và xóa thông tin giảng viên nếu có
    await Teacher.deleteOne({ account: userId });

    // Xóa tham chiếu trong lớp học nếu có
    await Class.updateMany({ teacher: userId }, { $unset: { teacher: 1 } });

    // Xóa tài khoản
    await Account.findByIdAndDelete(userId);
    console.log(`Account successfully deleted: ${userId}`);

    res.status(200).json({ message: "Tài khoản đã được xóa thành công" });
  } catch (error) {
    console.error("Error deleting teacher account:", error);
    res.status(500).json({ message: "Lỗi khi xóa tài khoản" });
  }
});
// Add the tester endpoint
app.get("/tester", async (req, res) => {
  res.send("Hello World");
});

// ==================== CAMPUS ROUTES ====================

// Get all campuses
app.get("/api/campuses", async (req, res) => {
  try {
    const campuses = await Campus.find().sort({ name: 1 });
    res.json(campuses);
  } catch (error) {
    console.error("Error fetching campuses:", error);
    res.status(500).json({ message: "Lỗi khi tải danh sách cơ sở" });
  }
});

// Get campus by ID
app.get("/api/campuses/:id", auth, async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: "Không tìm thấy cơ sở" });
    }
    res.json(campus);
  } catch (error) {
    console.error("Error fetching campus:", error);
    res.status(500).json({ message: "Lỗi khi tải thông tin cơ sở" });
  }
});

// Create new campus (admin only)
app.post("/api/campuses", auth, adminOnly, async (req, res) => {
  try {
    const { name, address, description } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        message: "Vui lòng cung cấp tên và địa chỉ cơ sở",
      });
    }

    // Check if campus with the same name already exists
    const existingCampus = await Campus.findOne({ name });
    if (existingCampus) {
      return res.status(400).json({ message: "Tên cơ sở đã tồn tại" });
    }

    const newCampus = new Campus({
      name,
      address,
      description,
    });

    const savedCampus = await newCampus.save();
    res.status(201).json(savedCampus);
  } catch (error) {
    console.error("Error creating campus:", error);
    res.status(500).json({ message: "Lỗi khi tạo cơ sở mới" });
  }
});

// Update campus (admin only)
app.put("/api/campuses/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, address, description } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        message: "Vui lòng cung cấp tên và địa chỉ cơ sở",
      });
    }

    // Check if update would create a duplicate name
    const existingCampus = await Campus.findOne({
      name,
      _id: { $ne: req.params.id },
    });

    if (existingCampus) {
      return res.status(400).json({ message: "Tên cơ sở đã tồn tại" });
    }

    const updatedCampus = await Campus.findByIdAndUpdate(
      req.params.id,
      { name, address, description },
      { new: true }
    );

    if (!updatedCampus) {
      return res.status(404).json({ message: "Không tìm thấy cơ sở" });
    }

    res.json(updatedCampus);
  } catch (error) {
    console.error("Error updating campus:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật cơ sở" });
  }
});

// Delete campus (admin only)
app.delete("/api/campuses/:id", auth, adminOnly, async (req, res) => {
  try {
    // Check if campus is associated with any rooms
    const roomCount = await Room.countDocuments({ campus: req.params.id });
    if (roomCount > 0) {
      return res.status(400).json({
        message:
          "Không thể xóa cơ sở đang có phòng học. Vui lòng xóa tất cả phòng học trước.",
      });
    }

    // Check if campus is associated with any classes
    const classCount = await Class.countDocuments({ campus: req.params.id });
    if (classCount > 0) {
      return res.status(400).json({
        message:
          "Không thể xóa cơ sở đang có lớp học. Vui lòng thay đổi cơ sở của các lớp học trước.",
      });
    }

    const deletedCampus = await Campus.findByIdAndDelete(req.params.id);
    if (!deletedCampus) {
      return res.status(404).json({ message: "Không tìm thấy cơ sở" });
    }

    res.json({ message: "Đã xóa cơ sở thành công" });
  } catch (error) {
    console.error("Error deleting campus:", error);
    res.status(500).json({ message: "Lỗi khi xóa cơ sở" });
  }
});

// ==================== ROOM ROUTES ====================

// Get all rooms with optional campus filter
app.get("/api/rooms", async (req, res) => {
  try {
    const { campus } = req.query;

    let query = {};
    if (campus) {
      query.campus = campus;
    }

    const rooms = await Room.find(query)
      .populate("campus", "name")
      .sort({ building: 1, floor: 1, number: 1 });

    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ message: "Lỗi khi tải danh sách phòng học" });
  }
});

// Test endpoint for rooms API
app.get("/api/rooms/test", async (req, res) => {
  res.send("Hello World");
});

// Get room by ID
app.get("/api/rooms/:id", auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate("campus", "name");
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng học" });
    }
    res.json(room);
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ message: "Lỗi khi tải thông tin phòng học" });
  }
});

// Create new room (admin only)
app.post("/api/rooms", auth, adminOnly, async (req, res) => {
  try {
    const {
      name,
      number,
      floor,
      building,
      campus,
      capacity,
      features,
      description,
    } = req.body;

    if (!name || !number || !floor || !building || !campus || !capacity) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ thông tin phòng học",
      });
    }

    // Check if campus exists
    const campusExists = await Campus.findById(campus);
    if (!campusExists) {
      return res.status(400).json({ message: "Cơ sở không tồn tại" });
    }

    // Check for duplicate room
    const existingRoom = await Room.findOne({
      number,
      floor,
      building,
      campus,
    });

    if (existingRoom) {
      return res.status(400).json({
        message: "Phòng học này đã tồn tại ở cơ sở này",
      });
    }

    const newRoom = new Room({
      name,
      number,
      floor,
      building,
      campus,
      capacity: parseInt(capacity),
      features: features || {
        hasProjector: false,
        hasAirConditioner: false,
        hasComputers: false,
      },
      description,
    });

    const savedRoom = await newRoom.save();
    const populatedRoom = await Room.findById(savedRoom._id).populate(
      "campus",
      "name"
    );

    res.status(201).json(populatedRoom);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Lỗi khi tạo phòng học mới" });
  }
});

// Update room (admin only)
app.put("/api/rooms/:id", auth, adminOnly, async (req, res) => {
  try {
    const {
      name,
      number,
      floor,
      building,
      campus,
      capacity,
      features,
      description,
    } = req.body;

    if (!name || !number || !floor || !building || !campus || !capacity) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ thông tin phòng học",
      });
    }

    // Check if campus exists
    const campusExists = await Campus.findById(campus);
    if (!campusExists) {
      return res.status(400).json({ message: "Cơ sở không tồn tại" });
    }

    // Check for duplicate room but not this one
    const existingRoom = await Room.findOne({
      number,
      floor,
      building,
      campus,
      _id: { $ne: req.params.id },
    });

    if (existingRoom) {
      return res.status(400).json({
        message: "Phòng học này đã tồn tại ở cơ sở này",
      });
    }

    const updatedRoom = await Room.findByIdAndUpdate(
      req.params.id,
      {
        name,
        number,
        floor,
        building,
        campus,
        capacity: parseInt(capacity),
        features,
        description,
      },
      { new: true }
    ).populate("campus", "name");

    if (!updatedRoom) {
      return res.status(404).json({ message: "Không tìm thấy phòng học" });
    }

    res.json(updatedRoom);
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật phòng học" });
  }
});

// Delete room (admin only)
app.delete("/api/rooms/:id", auth, adminOnly, async (req, res) => {
  try {
    // Check if room is associated with any classes
    const classCount = await Class.countDocuments({ room: req.params.id });
    if (classCount > 0) {
      return res.status(400).json({
        message:
          "Không thể xóa phòng học đang được sử dụng cho lớp học. Vui lòng thay đổi phòng học của các lớp trước.",
      });
    }

    const deletedRoom = await Room.findByIdAndDelete(req.params.id);
    if (!deletedRoom) {
      return res.status(404).json({ message: "Không tìm thấy phòng học" });
    }

    res.json({ message: "Đã xóa phòng học thành công" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ message: "Lỗi khi xóa phòng học" });
  }
});
// Xóa sinh viên (Chuẩn RESTful API)
app.delete("/api/students/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `User ${req.account.name} (${req.account.role}) attempting to delete student with ID: ${id}`
    );

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID sinh viên không hợp lệ",
        studentId: id,
      });
    }

    // Tìm sinh viên
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        message: "Không tìm thấy sinh viên",
        studentId: id,
      });
    }

    // Kiểm tra quyền hạn: Admin hoặc giảng viên chủ nhiệm của lớp
    if (req.account.role !== "admin") {
      // Nếu sinh viên thuộc lớp quản lý, kiểm tra xem người dùng có phải là giáo viên chủ nhiệm không
      if (student.adminClass) {
        const adminClass = await AdminClass.findById(student.adminClass);
        if (
          !adminClass ||
          !adminClass.mainTeacher ||
          adminClass.mainTeacher.toString() !== req.account._id.toString()
        ) {
          return res.status(403).json({
            message: "Bạn không có quyền xóa sinh viên này",
          });
        }
      } else {
        return res.status(403).json({
          message: "Bạn không có quyền xóa sinh viên này",
        });
      }
    }

    // Lưu classId để cập nhật sau khi xóa
    const adminClassId = student.adminClass;
    const regularClassIds = student.classes || [];
    console.log(
      `Student classes: Admin=${adminClassId}, Regular=${regularClassIds.join(
        ", "
      )}`
    );

    // 1. Xóa các bản ghi điểm danh liên quan đến sinh viên
    const attendanceUpdates = await Attendance.updateMany(
      { "students.student": id },
      { $pull: { students: { student: id } } }
    );
    console.log(
      `Updated ${attendanceUpdates.modifiedCount} attendance records`
    );

    // 2. Xóa sinh viên
    await Student.findByIdAndDelete(id);
    console.log(`Student with ID ${id} deleted successfully`);

    // 3. Cập nhật số lượng sinh viên trong lớp quản lý
    if (adminClassId) {
      await AdminClass.updateStudentCount(adminClassId);
      console.log(`Updated student count for admin class ${adminClassId}`);
    }

    // 4. Cập nhật các lớp học thông thường
    for (const classId of regularClassIds) {
      // Xóa tham chiếu sinh viên từ lớp học
      await Class.findByIdAndUpdate(
        classId,
        { $pull: { students: id } },
        { new: true }
      );

      // Cập nhật số lượng sinh viên
      const classDoc = await Class.findById(classId);
      if (classDoc) {
        classDoc.studentCount = classDoc.students
          ? classDoc.students.length
          : 0;
        await classDoc.save();
        console.log(
          `Updated student count for class ${classId}: ${classDoc.studentCount}`
        );
      }
    }

    res.json({
      message: "Đã xóa sinh viên thành công",
      studentInfo: {
        id: student._id,
        name: student.name,
        studentId: student.studentId,
      },
      updates: {
        attendanceRecords: attendanceUpdates.modifiedCount,
        adminClass: adminClassId ? true : false,
        regularClasses: regularClassIds.length,
      },
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({
      message: "Lỗi khi xóa sinh viên",
      error: error.message,
    });
  }
});

// ==================== API ROUTES RESTRUCTURED ====================

// ===== ADMIN ROUTES =====

// Lấy tất cả sinh viên trong hệ thống
app.get("/api/admin/students", auth, adminOnly, async (req, res) => {
  try {
    const students = await Student.find()
      .populate("adminClass", "name code entryYear department")
      .sort({ adminClass: 1, name: 1 });

    res.json(students);
  } catch (error) {
    console.error("Error fetching all students:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách sinh viên",
      error: error.message,
    });
  }
});

// Thêm sinh viên vào lớp chính (AdminClass)
app.post(
  "/api/admin/classes/:classId/students",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { name, studentId, email, phone, gender } = req.body;

      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          message: "ID lớp chính không hợp lệ",
        });
      }

      // Kiểm tra lớp tồn tại
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({
          message: "Không tìm thấy lớp chính",
        });
      }

      // Kiểm tra sinh viên đã tồn tại trong hệ thống chưa
      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        // Nếu sinh viên đã thuộc lớp này
        if (
          existingStudent.adminClass &&
          existingStudent.adminClass.toString() === classId
        ) {
          return res.status(400).json({
            message: "Sinh viên đã thuộc lớp chính này",
            studentInfo: existingStudent,
          });
        }

        return res.status(400).json({
          message: "Mã sinh viên đã tồn tại trong hệ thống",
          studentInfo: existingStudent,
        });
      }

      // Tạo sinh viên mới
      const newStudent = new Student({
        name,
        studentId,
        email: email || `${studentId}@example.com`,
        phone,
        gender: gender || "male",
        adminClass: classId,
        active: true,
      });

      await newStudent.save();

      // Cập nhật số lượng sinh viên trong lớp
      await AdminClass.updateStudentCount(classId);

      res.status(201).json({
        message: "Đã thêm sinh viên vào lớp chính thành công",
        student: newStudent,
      });
    } catch (error) {
      console.error("Error adding student to admin class:", error);
      res.status(500).json({
        message: "Lỗi khi thêm sinh viên vào lớp chính",
        error: error.message,
      });
    }
  }
);

// Xóa sinh viên khỏi hệ thống (xóa hoàn toàn)
app.delete(
  "/api/admin/students/:studentId",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (!isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID sinh viên không hợp lệ",
        });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
        });
      }

      // Lưu thông tin các lớp của sinh viên
      const adminClassId = student.adminClass;
      const regularClassIds = student.classes || [];

      // 1. Xóa sinh viên khỏi các bản ghi điểm danh
      await Attendance.updateMany(
        { "students.student": studentId },
        { $pull: { students: { student: studentId } } }
      );

      // 2. Xóa sinh viên khỏi các lớp học
      for (const classId of regularClassIds) {
        await Class.findByIdAndUpdate(classId, {
          $pull: { students: studentId },
        });

        // Cập nhật số lượng sinh viên
        const classDoc = await Class.findById(classId);
        if (classDoc) {
          classDoc.studentCount = classDoc.students
            ? classDoc.students.length
            : 0;
          await classDoc.save();
        }
      }

      // 3. Xóa sinh viên
      await Student.findByIdAndDelete(studentId);

      // 4. Cập nhật số sinh viên trong lớp chính
      if (adminClassId) {
        await AdminClass.updateStudentCount(adminClassId);
      }

      res.json({
        message: "Đã xóa sinh viên khỏi hệ thống thành công",
        studentInfo: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
        },
      });
    } catch (error) {
      console.error("Error deleting student from system:", error);
      res.status(500).json({
        message: "Lỗi khi xóa sinh viên khỏi hệ thống",
        error: error.message,
      });
    }
  }
);

// Gỡ sinh viên khỏi lớp chính (không xóa sinh viên khỏi hệ thống)
app.delete(
  "/api/admin/classes/:classId/students/:studentId",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;

      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID không hợp lệ",
        });
      }

      // Kiểm tra lớp và sinh viên tồn tại
      const adminClass = await AdminClass.findById(classId);
      if (!adminClass) {
        return res.status(404).json({
          message: "Không tìm thấy lớp chính",
        });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
        });
      }

      // Kiểm tra sinh viên có thuộc lớp này không
      if (!student.adminClass || student.adminClass.toString() !== classId) {
        return res.status(400).json({
          message: "Sinh viên không thuộc lớp chính này",
        });
      }

      // Cập nhật sinh viên: gỡ khỏi lớp chính nhưng giữ trong hệ thống
      student.adminClass = null;
      await student.save();

      // Cập nhật số lượng sinh viên trong lớp
      await AdminClass.updateStudentCount(classId);

      res.json({
        message: "Đã gỡ sinh viên khỏi lớp chính thành công",
        studentInfo: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
        },
      });
    } catch (error) {
      console.error("Error removing student from admin class:", error);
      res.status(500).json({
        message: "Lỗi khi gỡ sinh viên khỏi lớp chính",
        error: error.message,
      });
    }
  }
);

// ===== TEACHER ROUTES =====

// Lấy danh sách sinh viên trong lớp học
app.get("/api/teacher/classes/:classId/students", auth, async (req, res) => {
  try {
    const { classId } = req.params;

    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
      });
    }

    // Kiểm tra lớp tồn tại
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    // Kiểm tra quyền: admin hoặc giáo viên phụ trách lớp
    if (
      req.account.role !== "admin" &&
      classObj.teacher.toString() !== req.account._id.toString()
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách sinh viên của lớp này",
      });
    }

    // Lấy danh sách sinh viên
    const students = await Student.find({ classes: { $in: [classId] } })
      .populate("adminClass", "name code")
      .sort({ name: 1 });

    res.json(students);
  } catch (error) {
    console.error("Error fetching students in class:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách sinh viên trong lớp",
      error: error.message,
    });
  }
});

// Thêm sinh viên vào lớp học (sinh viên phải đã tồn tại trong hệ thống)
app.post("/api/teacher/classes/:classId/students", auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentIds } = req.body; // Mảng các ID sinh viên cần thêm vào lớp

    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
      });
    }

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        message: "Danh sách sinh viên không hợp lệ",
      });
    }

    // Kiểm tra lớp tồn tại
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    // Kiểm tra quyền: admin hoặc giáo viên phụ trách lớp
    if (
      req.account.role !== "admin" &&
      classObj.teacher.toString() !== req.account._id.toString()
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền thêm sinh viên vào lớp này",
      });
    }

    const addedStudents = [];
    const existingStudents = [];
    const notFoundStudents = [];

    // Xử lý từng sinh viên
    for (const studentId of studentIds) {
      if (!isValidObjectId(studentId)) {
        notFoundStudents.push(studentId);
        continue;
      }

      // Kiểm tra sinh viên tồn tại
      const student = await Student.findById(studentId);
      if (!student) {
        notFoundStudents.push(studentId);
        continue;
      }

      // Kiểm tra sinh viên đã thuộc lớp này chưa
      if (student.classes && student.classes.includes(classId)) {
        existingStudents.push({
          id: student._id,
          name: student.name,
          studentId: student.studentId,
        });
        continue;
      }

      // Thêm lớp vào danh sách lớp của sinh viên
      if (!student.classes) {
        student.classes = [classId];
      } else {
        student.classes.push(classId);
      }

      await student.save();

      // Thêm sinh viên vào danh sách sinh viên của lớp
      if (!classObj.students) {
        classObj.students = [studentId];
      } else {
        classObj.students.push(studentId);
      }

      addedStudents.push({
        id: student._id,
        name: student.name,
        studentId: student.studentId,
      });
    }

    // Cập nhật số lượng sinh viên trong lớp
    classObj.studentCount = classObj.students ? classObj.students.length : 0;
    await classObj.save();

    res.json({
      message: "Đã thêm sinh viên vào lớp học",
      addedCount: addedStudents.length,
      addedStudents,
      existingStudents,
      notFoundStudents,
    });
  } catch (error) {
    console.error("Error adding students to class:", error);
    res.status(500).json({
      message: "Lỗi khi thêm sinh viên vào lớp học",
      error: error.message,
    });
  }
});

// Xóa sinh viên khỏi lớp học (không xóa sinh viên khỏi hệ thống)
app.delete(
  "/api/teacher/classes/:classId/students/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;

      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID không hợp lệ",
        });
      }

      // Kiểm tra lớp tồn tại
      const classObj = await Class.findById(classId);
      if (!classObj) {
        return res.status(404).json({
          message: "Không tìm thấy lớp học",
        });
      }

      // Kiểm tra quyền: admin hoặc giáo viên phụ trách lớp
      if (
        req.account.role !== "admin" &&
        classObj.teacher.toString() !== req.account._id.toString()
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền xóa sinh viên khỏi lớp này",
        });
      }

      // Kiểm tra sinh viên tồn tại
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
        });
      }

      // Kiểm tra sinh viên có thuộc lớp này không
      if (!student.classes || !student.classes.includes(classId)) {
        return res.status(400).json({
          message: "Sinh viên không thuộc lớp học này",
        });
      }

      // 1. Xóa lớp khỏi danh sách lớp của sinh viên
      student.classes = student.classes.filter(
        (id) => id.toString() !== classId
      );
      await student.save();

      // 2. Xóa sinh viên khỏi danh sách sinh viên của lớp
      classObj.students = classObj.students.filter(
        (id) => id.toString() !== studentId
      );
      classObj.studentCount = classObj.students.length;
      await classObj.save();

      // 3. Xử lý điểm danh nếu cần thiết
      // Nếu muốn giữ lại lịch sử điểm danh, không cần xóa
      // Nếu muốn xóa lịch sử điểm danh:
      // await Attendance.updateMany(
      //   { class: classId, 'students.student': studentId },
      //   { $pull: { students: { student: studentId } } }
      // );

      res.json({
        message: "Đã xóa sinh viên khỏi lớp học thành công",
        studentInfo: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
        },
      });
    } catch (error) {
      console.error("Error removing student from class:", error);
      res.status(500).json({
        message: "Lỗi khi xóa sinh viên khỏi lớp học",
        error: error.message,
      });
    }
  }
);

// ===== STUDENT ROUTES =====

// Lấy thông tin các lớp học của sinh viên
app.get("/api/student/classes", auth, async (req, res) => {
  try {
    if (req.account.role !== "student") {
      return res.status(403).json({
        message: "Chỉ sinh viên mới có thể sử dụng API này",
      });
    }

    // Tìm thông tin sinh viên từ tài khoản
    const student = await Student.findOne({ accountId: req.account._id });
    if (!student) {
      return res.status(404).json({
        message: "Không tìm thấy thông tin sinh viên",
      });
    }

    // Nếu sinh viên không có lớp nào
    if (!student.classes || student.classes.length === 0) {
      return res.json([]);
    }

    // Lấy danh sách các lớp học của sinh viên
    const classes = await Class.find({ _id: { $in: student.classes } })
      .populate("teacher", "name email phone")
      .sort({ createdAt: -1 });

    res.json(classes);
  } catch (error) {
    console.error("Error fetching student's classes:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách lớp học của sinh viên",
      error: error.message,
    });
  }
});

// Kết thúc API cấu trúc mới
// ... existing code (routes that should remain) ...

/* ==================== TEACHER CLASSES API ROUTES ==================== */
// API routes for teacher's regular classes management
// GET - Get classes for teacher
app.get("/api/teacher/classes", auth, async (req, res) => {
  try {
    // Kiểm tra quyền - Chỉ giảng viên và admin mới được xem danh sách lớp
    if (req.account.role !== "teacher" && req.account.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Không có quyền xem danh sách lớp" });
    }

    let query = {};

    // Nếu là admin, có thể xem tất cả lớp
    if (req.account.role !== "admin") {
      // Nếu là giảng viên, chỉ xem các lớp mình phụ trách
      query.teacher = req.account._id;
    }

    const classes = await Class.find(query)
      .populate("teacher", "name email")
      .sort({ createdAt: -1 });

    res.json(classes);
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ message: "Lỗi khi tải danh sách lớp học" });
  }
});

// GET - Get specific class for teacher
app.get("/api/teacher/classes/:id", auth, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id).populate(
      "teacher",
      "name email"
    );

    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền - Giảng viên chỉ xem được lớp mình phụ trách
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher._id.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xem lớp này" });
    }

    res.json(classItem);
  } catch (error) {
    console.error("Error fetching class:", error);
    res.status(500).json({ message: "Lỗi khi tải thông tin lớp học" });
  }
});

// POST - Create class (for teacher)
app.post("/api/teacher/classes", auth, async (req, res) => {
  try {
    // Kiểm tra quyền - Chỉ giảng viên và admin mới được tạo lớp
    if (req.account.role !== "teacher" && req.account.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền tạo lớp học" });
    }

    const { name, code, subject, semester, schoolYear, adminClass } = req.body;

    // Kiểm tra xem mã lớp đã tồn tại chưa
    const existingClass = await Class.findOne({ code });
    if (existingClass) {
      return res.status(400).json({ message: "Mã lớp đã tồn tại" });
    }

    // Tạo lớp mới
    const newClass = new Class({
      name,
      code,
      subject,
      semester,
      schoolYear,
      adminClass,
      teacher: req.account._id, // Giảng viên tạo lớp sẽ là giáo viên phụ trách
      studentCount: 0,
    });

    const savedClass = await newClass.save();
    res.status(201).json(savedClass);
  } catch (error) {
    console.error("Error creating class:", error);
    res.status(500).json({ message: "Lỗi khi tạo lớp học" });
  }
});

// PUT - Update class
app.put("/api/teacher/classes/:id", auth, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);

    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền cập nhật lớp này" });
    }

    const { name, subject, semester, schoolYear, adminClass } = req.body;

    // Cập nhật thông tin lớp
    if (name) classItem.name = name;
    if (subject) classItem.subject = subject;
    if (semester) classItem.semester = semester;
    if (schoolYear) classItem.schoolYear = schoolYear;
    if (adminClass) classItem.adminClass = adminClass;

    const updatedClass = await classItem.save();
    res.json(updatedClass);
  } catch (error) {
    console.error("Error updating class:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật lớp học" });
  }
});

// DELETE - Delete class
app.delete("/api/teacher/classes/:id", auth, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);

    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa lớp này" });
    }

    // Kiểm tra xem lớp đã có điểm danh chưa
    const hasAttendance = await Attendance.findOne({ class: req.params.id });
    if (hasAttendance) {
      return res
        .status(400)
        .json({ message: "Không thể xóa lớp đã có dữ liệu điểm danh" });
    }

    // Xóa lớp
    await Class.findByIdAndDelete(req.params.id);

    res.json({ message: "Xóa lớp học thành công" });
  } catch (error) {
    console.error("Error deleting class:", error);
    res.status(500).json({ message: "Lỗi khi xóa lớp học" });
  }
});

// GET - Get students in a class
app.get("/api/teacher/classes/:id/students", auth, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);
    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xem sinh viên của lớp này" });
    }

    const students = await ClassStudent.find({
      class: req.params.id,
    })
      .populate("student", "name studentId email phone gender")
      .sort({ "student.name": 1 });

    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Lỗi khi tải danh sách sinh viên" });
  }
});

// POST - Add students to class
app.post("/api/teacher/classes/:id/students", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const classItem = await Class.findById(id);

    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thêm sinh viên vào lớp này" });
    }

    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách sinh viên không hợp lệ" });
    }

    // Kiểm tra sinh viên đã tồn tại trong lớp chưa
    const existingStudents = await ClassStudent.find({
      class: id,
      student: { $in: studentIds },
    });

    // Lọc ra các sinh viên chưa có trong lớp
    const existingStudentIds = existingStudents.map((item) =>
      item.student.toString()
    );
    const newStudentIds = studentIds.filter(
      (studentId) => !existingStudentIds.includes(studentId)
    );

    // Thêm sinh viên mới vào lớp
    const newClassStudents = newStudentIds.map((studentId) => ({
      class: id,
      student: studentId,
    }));

    if (newClassStudents.length > 0) {
      await ClassStudent.insertMany(newClassStudents);

      // Cập nhật số lượng sinh viên trong lớp
      classItem.studentCount = await ClassStudent.countDocuments({ class: id });
      await classItem.save();
    }

    res.json({
      message: `Đã thêm ${newClassStudents.length} sinh viên vào lớp`,
      addedCount: newClassStudents.length,
      skippedCount: studentIds.length - newClassStudents.length,
    });
  } catch (error) {
    console.error("Error adding students to class:", error);
    res.status(500).json({ message: "Lỗi khi thêm sinh viên vào lớp" });
  }
});

// DELETE - Remove student from class
app.delete(
  "/api/teacher/classes/:classId/students/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;

      const classItem = await Class.findById(classId);
      if (!classItem) {
        return res.status(404).json({ message: "Không tìm thấy lớp học" });
      }

      // Kiểm tra quyền
      if (
        req.account.role !== "admin" &&
        (!classItem.teacher ||
          classItem.teacher.toString() !== req.account._id.toString())
      ) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xóa sinh viên khỏi lớp này" });
      }

      // Kiểm tra xem sinh viên đã có điểm danh trong lớp chưa
      const hasAttendance = await AttendanceRecord.findOne({
        student: studentId,
        class: classId,
      });

      if (hasAttendance) {
        return res
          .status(400)
          .json({ message: "Không thể xóa sinh viên đã có dữ liệu điểm danh" });
      }

      // Xóa sinh viên khỏi lớp
      const result = await ClassStudent.findOneAndDelete({
        class: classId,
        student: studentId,
      });

      if (!result) {
        return res
          .status(404)
          .json({ message: "Sinh viên không tồn tại trong lớp" });
      }

      // Cập nhật số lượng sinh viên trong lớp
      classItem.studentCount = await ClassStudent.countDocuments({
        class: classId,
      });
      await classItem.save();

      res.json({ message: "Đã xóa sinh viên khỏi lớp học" });
    } catch (error) {
      console.error("Error removing student from class:", error);
      res.status(500).json({ message: "Lỗi khi xóa sinh viên khỏi lớp" });
    }
  }
);

/* ==================== TEACHER ATTENDANCE API ROUTES ==================== */
// API chuẩn hóa cho điểm danh
// POST - Start attendance session
app.post("/api/teacher/attendance/start", auth, async (req, res) => {
  try {
    // Kiểm tra quyền
    if (req.account.role !== "teacher" && req.account.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền điểm danh" });
    }

    const { classId, date, startTime, endTime, title, description, location } =
      req.body;

    // Kiểm tra lớp học
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền đối với lớp
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không phải là giảng viên của lớp này" });
    }

    // Kiểm tra xem có buổi điểm danh nào đang diễn ra không
    const activeAttendance = await Attendance.findOne({
      class: classId,
      status: "in_progress",
    });

    if (activeAttendance) {
      return res
        .status(400)
        .json({ message: "Đã có buổi điểm danh đang diễn ra cho lớp này" });
    }

    // Tạo buổi điểm danh mới
    const newAttendance = new Attendance({
      class: classId,
      date: date ? new Date(date) : new Date(),
      startTime: startTime || new Date(),
      endTime: endTime,
      title: title || `Buổi điểm danh ${new Date().toLocaleDateString()}`,
      description: description || "",
      location: location || "",
      status: "in_progress",
      createdBy: req.account._id, // Sử dụng Account ID thay vì Teacher ID
      students: [], // Sẽ được cập nhật khi sinh viên điểm danh
    });

    const savedAttendance = await newAttendance.save();

    // Populate thông tin cơ bản để trả về
    const populatedAttendance = await Attendance.findById(
      savedAttendance._id
    ).populate("class", "name code");

    res.status(201).json({
      message: "Đã bắt đầu buổi điểm danh",
      attendance: populatedAttendance,
    });
  } catch (error) {
    console.error("Error starting attendance:", error);
    res.status(500).json({ message: "Lỗi khi bắt đầu buổi điểm danh" });
  }
});

// PUT - Mark student as present
app.put(
  "/api/teacher/attendance/:attendanceId/student/:studentId",
  auth,
  async (req, res) => {
    try {
      const { attendanceId, studentId } = req.params;

      // Kiểm tra ID buổi điểm danh hợp lệ
      if (!isValidObjectId(attendanceId)) {
        return res.status(400).json({
          message: "ID buổi điểm danh không hợp lệ",
          details: { providedAttendanceId: attendanceId },
        });
      }

      // Kiểm tra ID sinh viên hợp lệ
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID sinh viên không hợp lệ",
          details: { providedStudentId: studentId },
        });
      }

      // Kiểm tra buổi điểm danh
      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        return res.status(404).json({
          message: "Không tìm thấy buổi điểm danh",
          details: { attendanceId },
        });
      }

      // Kiểm tra lớp học
      const classItem = await Class.findById(attendance.class);
      if (!classItem) {
        return res.status(404).json({
          message: "Không tìm thấy lớp học",
          details: { classId: attendance.class },
        });
      }

      // Kiểm tra quyền điểm danh
      if (
        req.account.role !== "admin" &&
        (!classItem.teacher ||
          classItem.teacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không phải là giảng viên của lớp này",
          details: {
            teacherId: classItem.teacher?.toString(),
            accountId: req.account._id.toString(),
          },
        });
      }

      // Kiểm tra trạng thái điểm danh
      if (attendance.status !== "in_progress") {
        return res.status(400).json({
          message: "Buổi điểm danh đã kết thúc",
          details: { status: attendance.status },
        });
      }

      // Kiểm tra sinh viên
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
          details: { studentId },
        });
      }

      // Kiểm tra sinh viên có trong lớp không
      const classStudent = await ClassStudent.findOne({
        class: attendance.class,
        student: studentId,
      });

      if (!classStudent) {
        // Thử phương pháp thay thế bằng việc kiểm tra trực tiếp từ model Student
        const studentWithClass = await Student.findOne({
          _id: studentId,
          classes: { $in: [attendance.class] },
        });

        if (!studentWithClass) {
          // Sinh viên không thuộc lớp theo cả hai phương pháp kiểm tra
          return res.status(404).json({
            message: "Sinh viên không thuộc lớp này",
            details: {
              classId: attendance.class.toString(),
              className: classItem.name,
              studentId,
              studentName: student.name,
              studentCode: student.studentId,
            },
          });
        }

        // Nếu tìm thấy trong model Student nhưng không có trong ClassStudent, tự động tạo ClassStudent
        const newClassStudent = new ClassStudent({
          class: attendance.class,
          student: studentId,
          enrollmentDate: new Date(),
          status: "active",
        });

        try {
          await newClassStudent.save();
          console.log(
            `Tự động tạo liên kết ClassStudent cho sinh viên ${student.name} với lớp ${classItem.name}`
          );
        } catch (error) {
          console.error("Lỗi khi tạo liên kết ClassStudent:", error);
          // Tiếp tục xử lý bất kể lỗi tạo liên kết
        }
      }

      // Kiểm tra sinh viên đã được điểm danh chưa
      let attendanceRecord = await AttendanceRecord.findOne({
        attendance: attendanceId,
        student: studentId,
      });

      if (attendanceRecord) {
        // Cập nhật trạng thái điểm danh
        attendanceRecord.present = true;
        attendanceRecord.method = req.body.method || "manual";
        attendanceRecord.recordTime = new Date();
        if (req.body.note) attendanceRecord.note = req.body.note;

        await attendanceRecord.save();
      } else {
        // Tạo bản ghi điểm danh mới
        attendanceRecord = new AttendanceRecord({
          attendance: attendanceId,
          class: attendance.class,
          student: studentId,
          present: true,
          method: req.body.method || "manual",
          recordTime: new Date(),
          note: req.body.note,
        });

        await attendanceRecord.save();
      }

      // Trả về thông tin đầy đủ
      res.json({
        message: "Đã điểm danh thành công",
        record: attendanceRecord,
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
        },
      });
    } catch (error) {
      console.error("Error marking attendance:", error);
      res.status(500).json({
        message: "Lỗi khi đánh dấu điểm danh",
        error: error.message,
      });
    }
  }
);

// PUT - Complete attendance session
app.put("/api/teacher/attendance/:id/complete", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ID hợp lệ
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID buổi điểm danh không hợp lệ",
        details: { providedId: id },
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        message: "Không tìm thấy buổi điểm danh",
        details: { attendanceId: id },
      });
    }

    // Kiểm tra lớp học
    const classItem = await Class.findById(attendance.class);
    if (!classItem) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        details: { classId: attendance.class },
      });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không phải là giảng viên của lớp này",
        details: {
          teacherId: classItem.teacher?.toString(),
          accountId: req.account._id.toString(),
        },
      });
    }

    // Kiểm tra trạng thái hiện tại và cung cấp thông tin chi tiết hơn
    if (attendance.status !== "in_progress") {
      return res.status(400).json({
        message: "Buổi điểm danh không ở trạng thái đang diễn ra",
        details: {
          currentStatus: attendance.status,
          attendanceId: id,
        },
      });
    }

    // Cập nhật thông tin buổi điểm danh
    attendance.status = "completed";
    attendance.endTime = req.body.endTime || new Date();

    // Đánh dấu vắng mặt cho các sinh viên chưa điểm danh
    const classStudents = await ClassStudent.find({ class: attendance.class });
    const attendedStudents = await AttendanceRecord.find({
      attendance: req.params.id,
    });

    const attendedStudentIds = attendedStudents.map((record) =>
      record.student.toString()
    );
    const absentStudentIds = classStudents
      .map((item) => item.student.toString())
      .filter((studentId) => !attendedStudentIds.includes(studentId));

    // Tạo bản ghi vắng mặt cho các sinh viên chưa điểm danh
    if (absentStudentIds.length > 0) {
      const absentRecords = absentStudentIds.map((studentId) => ({
        attendance: req.params.id,
        class: attendance.class,
        student: studentId,
        present: false,
        method: "auto",
        recordTime: new Date(),
      }));

      await AttendanceRecord.insertMany(absentRecords);
    }

    // Lưu buổi điểm danh
    await attendance.save();

    // Tính tỷ lệ tham dự
    const presentCount = await AttendanceRecord.countDocuments({
      attendance: req.params.id,
      present: true,
    });

    const totalCount = classStudents.length;
    const attendanceRate =
      totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

    res.json({
      message: "Đã kết thúc buổi điểm danh",
      attendance: {
        ...attendance.toObject(),
        stats: {
          presentCount,
          absentCount: totalCount - presentCount,
          totalCount,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error completing attendance:", error);
    res.status(500).json({
      message: "Lỗi khi kết thúc buổi điểm danh",
      error: error.message,
    });
  }
});

// GET - Get attendance history for a class
app.get("/api/teacher/attendance/class/:classId", auth, async (req, res) => {
  try {
    const { classId } = req.params;

    // Kiểm tra lớp học
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không phải là giảng viên của lớp này" });
    }

    // Lấy danh sách buổi điểm danh
    const attendances = await Attendance.find({ class: classId }).sort({
      date: -1,
      startTime: -1,
    });

    // Tính tỷ lệ tham dự cho từng buổi
    const attendanceWithStats = await Promise.all(
      attendances.map(async (attendance) => {
        const records = await AttendanceRecord.find({
          attendance: attendance._id,
        });
        const presentCount = records.filter((record) => record.present).length;
        const totalCount = records.length;
        const attendanceRate =
          totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

        return {
          ...attendance.toObject(),
          stats: {
            presentCount,
            absentCount: totalCount - presentCount,
            totalCount,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
          },
        };
      })
    );

    res.json(attendanceWithStats);
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({ message: "Lỗi khi tải lịch sử điểm danh" });
  }
});

// Thêm API lấy thống kê điểm danh của lớp học dành cho giảng viên
app.get("/api/teacher/classes/:id/attendance-stats", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    console.log("Fetching teacher attendance stats for class:", id, {
      startDate,
      endDate,
    });

    // Kiểm tra ID lớp
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID lớp học không hợp lệ" });
    }

    // Lấy thông tin lớp học kèm danh sách sinh viên
    const classDoc = await Class.findById(id).populate({
      path: "students",
      select: "name studentId",
    });

    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra quyền truy cập: chỉ admin hoặc giảng viên của lớp được phép xem
    if (
      req.account.role !== "admin" &&
      classDoc.teacher.toString() !== req.account._id.toString()
    ) {
      console.log("Unauthorized stats access by teacher:", req.account._id);
      return res.status(403).json({
        message: "Bạn không có quyền xem thống kê điểm danh của lớp học này",
      });
    }

    // Tạo query để lọc theo ngày nếu có
    const query = { class: id, status: "completed" };
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end,
      };
      console.log("Filtering by date range:", query.date);
    }

    // Lấy dữ liệu điểm danh
    const attendances = await Attendance.find(query);
    console.log(`Found ${attendances.length} attendance records`);

    // Tính thống kê cho từng sinh viên
    const stats = {};
    const sessionStats = {};

    // Khởi tạo thống kê cho mỗi sinh viên
    for (let student of classDoc.students || []) {
      stats[student._id] = {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        totalPresent: 0,
        totalAbsent: 0,
        totalSessions: attendances.length,
        attendanceRate: 0,
        totalScore: 0,
        isBanned: false,
        sessions: {},
      };
    }

    // Tính thống kê cho mỗi buổi học
    for (let attendance of attendances) {
      const sessionId = attendance._id.toString();
      sessionStats[sessionId] = {
        _id: sessionId,
        date: attendance.date,
        sessionNumber: attendance.sessionNumber,
        totalPresent: 0,
        totalAbsent: 0,
        presentRate: 0,
      };

      // Duyệt qua từng sinh viên trong buổi học
      for (let student of attendance.students || []) {
        const studentId = student.student.toString();
        const isPresent = student.status === "present";

        // Cập nhật thống kê của sinh viên
        if (stats[studentId]) {
          if (isPresent) {
            stats[studentId].totalPresent++;
            sessionStats[sessionId].totalPresent++;
          } else {
            stats[studentId].totalAbsent++;
            sessionStats[sessionId].totalAbsent++;
            stats[studentId].totalScore += student.score || 0;
          }

          // Lưu thông tin điểm danh theo buổi học
          stats[studentId].sessions[sessionId] = {
            present: isPresent,
            score: student.score || 0,
            date: attendance.date,
            sessionNumber: attendance.sessionNumber,
          };

          // Cập nhật trạng thái cấm thi
          if (student.isBanned) {
            stats[studentId].isBanned = true;
          }
        }
      }

      // Tính tỷ lệ tham dự của buổi học
      const totalStudents = classDoc.students ? classDoc.students.length : 0;
      if (totalStudents > 0) {
        sessionStats[sessionId].presentRate =
          (sessionStats[sessionId].totalPresent / totalStudents) * 100;
      }
    }

    // Tính tỷ lệ tham dự của mỗi sinh viên
    for (let studentId in stats) {
      const student = stats[studentId];
      if (student.totalSessions > 0) {
        student.attendanceRate =
          (student.totalPresent / student.totalSessions) * 100;
      }
    }

    // Trả về kết quả
    res.json({
      class: {
        _id: classDoc._id,
        name: classDoc.name,
        code: classDoc.code,
        totalStudents: classDoc.students ? classDoc.students.length : 0,
        totalSessions: attendances.length,
      },
      students: Object.values(stats),
      sessions: Object.values(sessionStats),
      startDate: startDate || null,
      endDate: endDate || null,
    });
  } catch (error) {
    console.error("Error fetching teacher attendance stats:", error);
    res.status(500).json({
      message: "Lỗi khi lấy thống kê điểm danh",
      error: error.message,
    });
  }
});
// API endpoint để lấy thống kê điểm danh của lớp học
app.get("/api/classes/:id/attendance-stats", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID lớp học không hợp lệ",
      });
    }

    // Kiểm tra lớp học tồn tại
    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học",
      });
    }

    // Lấy số lượng sinh viên trong lớp từ ClassStudent
    const classStudentCount = await ClassStudent.countDocuments({ class: id });
    // Nếu không có trong ClassStudent, lấy từ Class.studentCount hoặc Class.students.length
    const totalStudentsInClass =
      classStudentCount > 0
        ? classStudentCount
        : classDoc.studentCount ||
          (classDoc.students ? classDoc.students.length : 0);

    // Lấy thông tin các buổi điểm danh từ bảng Attendance
    const attendanceSessions = await Attendance.find({ class: id }).sort({
      sessionNumber: 1,
    });

    // Tính toán thống kê theo buổi học
    const sessionStats = [];
    const maxSessions = classDoc.sessions || 15; // Mặc định là 15 buổi nếu không có thông tin

    // Tạo mảng các session number từ 1 đến maxSessions
    for (let i = 1; i <= maxSessions; i++) {
      // Tìm buổi điểm danh tương ứng nếu có
      const sessionAttendance = attendanceSessions.find(
        (record) => record.sessionNumber === i
      );

      if (sessionAttendance) {
        // Lấy số liệu điểm danh từ AttendanceRecord
        const attendanceRecords = await AttendanceRecord.find({
          attendance: sessionAttendance._id,
        });

        const presentCount = attendanceRecords.filter(
          (record) => record.present
        ).length;
        const absentCount = totalStudentsInClass - presentCount;
        const attendanceRate =
          totalStudentsInClass > 0
            ? ((presentCount / totalStudentsInClass) * 100).toFixed(1)
            : 0;

        sessionStats.push({
          sessionNumber: i,
          totalStudents: totalStudentsInClass,
          attendedCount: presentCount,
          absentCount: absentCount,
          attendanceRate: attendanceRate,
          date: sessionAttendance.date || null,
          status: sessionAttendance.status || "not_started",
          id: sessionAttendance._id,
        });
      } else {
        // Buổi học chưa có điểm danh
        sessionStats.push({
          sessionNumber: i,
          totalStudents: totalStudentsInClass,
          attendedCount: 0,
          absentCount: totalStudentsInClass,
          attendanceRate: 0,
          date: null,
          status: "not_started",
          id: null,
        });
      }
    }

    return res.status(200).json(sessionStats);
  } catch (error) {
    console.error("Lỗi khi lấy thống kê điểm danh:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ nội bộ",
    });
  }
});

// Đánh dấu điểm danh của sinh viên (API mới sử dụng AttendanceRecord)
app.put("/api/attendance/:id/student/:studentId", async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { present = true, method = "manual", note } = req.body;

    console.log(
      `Marking student ${studentId} as ${
        present ? "present" : "absent"
      } for attendance ${id}`
    );

    // Kiểm tra attendance ID có hợp lệ không
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ message: "ID buổi điểm danh không hợp lệ" });
    }

    // Kiểm tra student ID có hợp lệ không
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ message: "ID sinh viên không hợp lệ" });
    }

    // Tìm buổi điểm danh
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Không tìm thấy buổi điểm danh" });
    }

    // Tìm lớp học
    const classDoc = await Class.findById(attendance.class);
    if (!classDoc) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // Kiểm tra xem sinh viên có thuộc lớp học này không
    const isStudentInClass = await ClassStudent.findOne({
      class: attendance.class,
      student: studentId,
    });

    if (!isStudentInClass) {
      return res
        .status(404)
        .json({ message: "Sinh viên không thuộc lớp học này" });
    }

    // Tìm hoặc tạo bản ghi điểm danh
    let record = await AttendanceRecord.findOne({
      attendance: id,
      student: studentId,
    });

    if (record) {
      // Cập nhật bản ghi hiện có
      record.present = present;
      record.method = method;
      record.recordTime = new Date();
      if (note) record.note = note;
    } else {
      // Tạo bản ghi mới
      record = new AttendanceRecord({
        attendance: id,
        class: attendance.class,
        student: studentId,
        present: present,
        method: method,
        recordTime: new Date(),
        note: note,
      });
    }

    // Lưu bản ghi điểm danh
    await record.save();

    // Trả về thông tin bản ghi điểm danh
    res.json({
      message: `Đã đánh dấu sinh viên ${present ? "có mặt" : "vắng mặt"}`,
      record,
    });
  } catch (error) {
    console.error("Error marking student attendance:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET - Get specific attendance session for a class by session number
app.get("/api/teacher/classes/:classId/attendance", auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { sessionNumber, date } = req.query;

    // Kiểm tra ID lớp học hợp lệ
    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        message: "ID lớp học không hợp lệ",
        details: { providedId: classId },
      });
    }

    // Kiểm tra lớp học
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        details: { classId },
      });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không phải là giảng viên của lớp này",
        details: {
          teacherId: classItem.teacher?.toString(),
          accountId: req.account._id.toString(),
        },
      });
    }

    // Xây dựng query để tìm buổi điểm danh
    const query = { class: classId };

    // Nếu có sessionNumber, thêm vào query
    if (sessionNumber) {
      query.sessionNumber = parseInt(sessionNumber, 10);
    }
    // Nếu có date, thêm vào query
    else if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      query.date = { $gte: startDate, $lte: endDate };
    }
    // Yêu cầu ít nhất một tham số
    else {
      return res.status(400).json({
        message: "Cần cung cấp số buổi học (sessionNumber) hoặc ngày (date)",
        details: { params: req.query },
      });
    }

    // Tìm buổi điểm danh cụ thể cho lớp này
    const attendance = await Attendance.findOne(query);

    if (!attendance) {
      return res.status(404).json({
        message: "Không tìm thấy buổi điểm danh",
        details: {
          query,
          classId,
          sessionNumber: sessionNumber || null,
          date: date || null,
        },
      });
    }

    // Lấy danh sách điểm danh cho buổi này
    const attendanceRecords = await AttendanceRecord.find({
      attendance: attendance._id,
    }).populate("student", "name studentId");

    // Trả về dữ liệu đầy đủ
    const result = {
      ...attendance.toObject(),
      records: attendanceRecords,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching attendance session:", error);
    res.status(500).json({
      message: "Lỗi khi tải thông tin buổi điểm danh",
      error: error.message,
    });
  }
});

// GET - Check attendance status
app.get("/api/teacher/attendance/:id/status", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ID hợp lệ
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID buổi điểm danh không hợp lệ",
        details: { providedId: id },
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        message: "Không tìm thấy buổi điểm danh",
        details: { attendanceId: id },
      });
    }

    // Kiểm tra lớp học
    const classItem = await Class.findById(attendance.class);
    if (!classItem) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        details: { classId: attendance.class },
      });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không phải là giảng viên của lớp này",
        details: {
          teacherId: classItem.teacher?.toString(),
          accountId: req.account._id.toString(),
        },
      });
    }

    // Lấy số lượng bản ghi điểm danh
    const recordCount = await AttendanceRecord.countDocuments({
      attendance: id,
    });

    const presentCount = await AttendanceRecord.countDocuments({
      attendance: id,
      present: true,
    });

    // Trả về thông tin trạng thái
    res.json({
      attendanceId: id,
      classId: attendance.class.toString(),
      className: classItem.name,
      status: attendance.status,
      date: attendance.date,
      startTime: attendance.startTime,
      endTime: attendance.endTime,
      sessionNumber: attendance.sessionNumber,
      recordCount: recordCount,
      presentCount: presentCount,
      canComplete: attendance.status === "in_progress",
      canRestart: attendance.status === "completed",
    });
  } catch (error) {
    console.error("Error checking attendance status:", error);
    res.status(500).json({
      message: "Lỗi khi kiểm tra trạng thái buổi điểm danh",
      error: error.message,
    });
  }
});

// API để đặt lại trạng thái buổi điểm danh (chỉ dành cho giảng viên và admin)
app.put("/api/teacher/attendance/:id/reset", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ID hợp lệ
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID buổi điểm danh không hợp lệ",
        details: { providedId: id },
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        message: "Không tìm thấy buổi điểm danh",
        details: { attendanceId: id },
      });
    }

    // Kiểm tra lớp học
    const classItem = await Class.findById(attendance.class);
    if (!classItem) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
        details: { classId: attendance.class },
      });
    }

    // Kiểm tra quyền
    if (
      req.account.role !== "admin" &&
      (!classItem.teacher ||
        classItem.teacher.toString() !== req.account._id.toString())
    ) {
      return res.status(403).json({
        message: "Bạn không phải là giảng viên của lớp này",
        details: {
          teacherId: classItem.teacher?.toString(),
          accountId: req.account._id.toString(),
        },
      });
    }

    // Đặt lại trạng thái thành in_progress
    attendance.status = "in_progress";

    // Nếu đã có endTime, xóa endTime
    if (attendance.endTime) {
      attendance.endTime = null;
    }

    await attendance.save();

    res.json({
      message: "Đã đặt lại trạng thái buổi điểm danh thành đang diễn ra",
      attendance: attendance,
    });
  } catch (error) {
    console.error("Error resetting attendance status:", error);
    res.status(500).json({
      message: "Lỗi khi đặt lại trạng thái buổi điểm danh",
      error: error.message,
    });
  }
});

// POST - Add student to class
app.post(
  "/api/teacher/classes/:classId/add-student",
  auth,
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { studentId } = req.body;

      // Kiểm tra ID lớp học hợp lệ
      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          message: "ID lớp học không hợp lệ",
          details: { providedClassId: classId },
        });
      }

      // Kiểm tra ID sinh viên hợp lệ
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID sinh viên không hợp lệ",
          details: { providedStudentId: studentId },
        });
      }

      // Kiểm tra lớp học
      const classItem = await Class.findById(classId);
      if (!classItem) {
        return res.status(404).json({
          message: "Không tìm thấy lớp học",
          details: { classId },
        });
      }

      // Kiểm tra quyền
      if (
        req.account.role !== "admin" &&
        (!classItem.teacher ||
          classItem.teacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không phải là giảng viên của lớp này",
          details: {
            teacherId: classItem.teacher?.toString(),
            accountId: req.account._id.toString(),
          },
        });
      }

      // Kiểm tra sinh viên
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
          details: { studentId },
        });
      }

      // Kiểm tra xem sinh viên đã thuộc lớp học chưa
      const existingRelation = await ClassStudent.findOne({
        class: classId,
        student: studentId,
      });

      if (existingRelation) {
        return res.status(400).json({
          message: "Sinh viên đã thuộc lớp học này",
          details: {
            classId,
            className: classItem.name,
            studentId,
            studentName: student.name,
            studentCode: student.studentId,
          },
        });
      }

      // Tạo mối quan hệ giữa lớp học và sinh viên
      const classStudent = new ClassStudent({
        class: classId,
        student: studentId,
        joinDate: new Date(),
        status: "active",
      });

      await classStudent.save();

      // Cập nhật số lượng sinh viên trong lớp học
      classItem.studentCount = (classItem.studentCount || 0) + 1;
      await classItem.save();

      res.status(201).json({
        message: "Đã thêm sinh viên vào lớp học thành công",
        classStudent,
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
        },
        class: {
          _id: classItem._id,
          name: classItem.name,
          code: classItem.code,
          studentCount: classItem.studentCount,
        },
      });
    } catch (error) {
      console.error("Error adding student to class:", error);
      res.status(500).json({
        message: "Lỗi khi thêm sinh viên vào lớp học",
        error: error.message,
      });
    }
  }
);

// POST - Create attendance session with advanced options
app.post(
  "/api/teacher/classes/:classId/create-attendance",
  auth,
  async (req, res) => {
    try {
      const { classId } = req.params;
      const {
        sessionNumber,
        date,
        title,
        description,
        location,
        autoCompleteAfter,
      } = req.body;

      // Kiểm tra ID lớp học hợp lệ
      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          message: "ID lớp học không hợp lệ",
          details: { providedClassId: classId },
        });
      }

      // Kiểm tra lớp học
      const classItem = await Class.findById(classId);
      if (!classItem) {
        return res.status(404).json({
          message: "Không tìm thấy lớp học",
          details: { classId },
        });
      }

      // Kiểm tra quyền
      if (
        req.account.role !== "admin" &&
        (!classItem.teacher ||
          classItem.teacher.toString() !== req.account._id.toString())
      ) {
        return res.status(403).json({
          message: "Bạn không phải là giảng viên của lớp này",
          details: {
            teacherId: classItem.teacher?.toString(),
            accountId: req.account._id.toString(),
          },
        });
      }

      // Kiểm tra xem đã có buổi điểm danh nào cho số buổi học này chưa
      const existingSession = await Attendance.findOne({
        class: classId,
        sessionNumber: sessionNumber,
      });

      if (existingSession) {
        return res.status(400).json({
          message: "Đã tồn tại buổi điểm danh cho số buổi học này",
          details: {
            classId,
            className: classItem.name,
            sessionNumber,
            existingSessionId: existingSession._id,
          },
        });
      }

      // Tạo buổi điểm danh mới
      const attendance = new Attendance({
        class: classId,
        sessionNumber,
        date: date || new Date(),
        status: "in_progress",
        createdBy: req.account._id,
        startTime: new Date(),
        title: title || `Buổi ${sessionNumber} - ${classItem.name}`,
        description: description || "",
        location: location || classItem.location || "",
      });

      await attendance.save();

      // Nếu có tùy chọn tự động kết thúc
      if (autoCompleteAfter && !isNaN(autoCompleteAfter)) {
        // Lên lịch tự động kết thúc sau số phút đã chỉ định
        setTimeout(async () => {
          try {
            const session = await Attendance.findById(attendance._id);
            if (session && session.status === "in_progress") {
              // Kết thúc buổi điểm danh
              session.status = "completed";
              session.endTime = new Date();
              await session.save();

              // Đánh dấu vắng mặt cho các sinh viên chưa điểm danh
              const classStudents = await ClassStudent.find({ class: classId });
              const attendedStudents = await AttendanceRecord.find({
                attendance: attendance._id,
              });

              const attendedStudentIds = attendedStudents.map((record) =>
                record.student.toString()
              );
              const absentStudentIds = classStudents
                .map((item) => item.student.toString())
                .filter((studentId) => !attendedStudentIds.includes(studentId));

              // Tạo bản ghi vắng mặt cho các sinh viên chưa điểm danh
              if (absentStudentIds.length > 0) {
                const absentRecords = absentStudentIds.map((studentId) => ({
                  attendance: attendance._id,
                  class: classId,
                  student: studentId,
                  present: false,
                  method: "auto",
                  recordTime: new Date(),
                }));

                await AttendanceRecord.insertMany(absentRecords);
              }
              console.log(
                `Auto-completed attendance session ${attendance._id} after ${autoCompleteAfter} minutes`
              );
            }
          } catch (error) {
            console.error("Error in auto-complete attendance:", error);
          }
        }, autoCompleteAfter * 60 * 1000); // Chuyển đổi phút thành mili giây
      }

      res.status(201).json({
        message: "Đã tạo buổi điểm danh thành công",
        attendance,
      });
    } catch (error) {
      console.error("Error creating attendance session:", error);
      res.status(500).json({
        message: "Lỗi khi tạo buổi điểm danh",
        error: error.message,
      });
    }
  }
);

// GET - Search student by student ID (code)
app.get("/api/teacher/students/search", auth, async (req, res) => {
  try {
    const { query, exact } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        message: "Cần có từ khóa tìm kiếm",
        details: { providedQuery: query },
      });
    }

    let searchCondition;

    // Nếu exact=true, tìm chính xác mã sinh viên
    if (exact === "true") {
      searchCondition = { studentId: query.trim() };
    } else {
      // Tìm theo regex (mã sinh viên hoặc tên)
      const searchRegex = new RegExp(query.trim(), "i");
      searchCondition = {
        $or: [{ studentId: searchRegex }, { name: searchRegex }],
      };
    }

    // Tìm sinh viên
    const students = await Student.find(searchCondition)
      .select("_id name studentId email phone avatar department")
      .limit(10);

    if (students.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy sinh viên",
        details: { query },
      });
    }

    // Nếu tìm với exact=true và chỉ có 1 kết quả, trả về thông tin chi tiết
    if (exact === "true" && students.length === 1) {
      const student = students[0];

      // Lấy thông tin các lớp học mà sinh viên đã tham gia
      const classStudents = await ClassStudent.find({ student: student._id });
      const classIds = classStudents.map((cs) => cs.class);

      const classes = await Class.find({ _id: { $in: classIds } }).select(
        "_id name code department"
      );

      return res.json({
        student: {
          ...student.toObject(),
          classes,
        },
      });
    }

    // Trả về danh sách kết quả tìm kiếm
    res.json({
      message: `Tìm thấy ${students.length} sinh viên`,
      students,
      query,
    });
  } catch (error) {
    console.error("Error searching students:", error);
    res.status(500).json({
      message: "Lỗi khi tìm kiếm sinh viên",
      error: error.message,
    });
  }
});

// GET - Check if student is in class
app.get(
  "/api/teacher/classes/:classId/check-student/:studentId",
  auth,
  async (req, res) => {
    try {
      const { classId, studentId } = req.params;

      // Kiểm tra ID hợp lệ
      if (!isValidObjectId(classId) || !isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "ID không hợp lệ",
          details: { classId, studentId },
        });
      }

      // Kiểm tra lớp học
      const classItem = await Class.findById(classId);
      if (!classItem) {
        return res.status(404).json({
          message: "Không tìm thấy lớp học",
          details: { classId },
        });
      }

      // Kiểm tra sinh viên
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Không tìm thấy sinh viên",
          details: { studentId },
        });
      }

      // Kiểm tra quan hệ
      const relation = await ClassStudent.findOne({
        class: classId,
        student: studentId,
      });

      if (relation) {
        // Sinh viên đã trong lớp
        res.json({
          isInClass: true,
          message: "Sinh viên đã thuộc lớp học này",
          student: {
            _id: student._id,
            name: student.name,
            studentId: student.studentId,
          },
          class: {
            _id: classItem._id,
            name: classItem.name,
            code: classItem.code,
          },
          relation,
        });
      } else {
        // Sinh viên chưa trong lớp
        res.json({
          isInClass: false,
          message: "Sinh viên chưa thuộc lớp học này",
          student: {
            _id: student._id,
            name: student.name,
            studentId: student.studentId,
          },
          class: {
            _id: classItem._id,
            name: classItem.name,
            code: classItem.code,
          },
        });
      }
    } catch (error) {
      console.error("Error checking student in class:", error);
      res.status(500).json({
        message: "Lỗi khi kiểm tra sinh viên trong lớp học",
        error: error.message,
      });
    }
  }
);
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

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
