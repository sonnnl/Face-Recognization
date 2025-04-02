import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Class from "../src/models/Class.js";
import Student from "../src/models/Student.js";
import Attendance from "../src/models/Attendance.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
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

// GET all classes
app.get("/api/classes", async (req, res) => {
  try {
    console.log("Fetching all classes...");
    const classes = await Class.find().sort({ createdAt: -1 });
    console.log(`Found ${classes.length} classes`);
    res.json(classes);
  } catch (error) {
    console.error("Error fetching all classes:", error);
    res.status(500).json({
      message: "Lỗi khi tải danh sách lớp học",
      error: error.message,
    });
  }
});

// Add new endpoint to sync student counts for all classes
app.post("/api/classes/sync-student-counts", async (req, res) => {
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
});

// IMPORTANT: Keep specific routes BEFORE generic routes with similar paths
// Test class existence by ID - this MUST be before /api/classes/:id
app.get("/api/classes/test/:id", async (req, res) => {
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
app.get("/api/classes/:id", async (req, res) => {
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
app.post("/api/classes", async (req, res) => {
  try {
    const { name, description } = req.body;
    console.log("Creating new class:", { name, description });

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      console.log("Invalid class name:", name);
      return res.status(400).json({
        message: "Tên lớp học không hợp lệ hoặc bị bỏ trống",
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
app.delete("/api/classes/:id", async (req, res) => {
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

// GET students by class ID
app.get("/api/students/class/:classId", async (req, res) => {
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

// GET student by ID
app.get("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching student with ID:", id);

    if (!isValidObjectId(id)) {
      console.log("Invalid student ID format:", id);
      return res.status(400).json({
        message: "ID sinh viên không hợp lệ",
        id,
      });
    }

    const student = await Student.findById(id).populate("class");

    if (!student) {
      console.log("Student not found:", id);
      return res.status(404).json({
        message: "Không tìm thấy sinh viên",
        id,
      });
    }

    console.log("Found student:", student);
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
app.post("/api/students", async (req, res) => {
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

    // Check if student with same ID already exists
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      console.log("Student ID already exists:", studentId);
      return res.status(400).json({
        message: "MSSV đã tồn tại",
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
app.get("/api/attendance/:classId", async (req, res) => {
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
