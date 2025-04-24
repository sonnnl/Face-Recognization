import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// MongoDB Models
import Account from "../src/models/Account.js";
import Attendance from "../src/models/Attendance.js";
import Class from "../src/models/Class.js";
import AttendanceRecord from "../src/models/AttendanceRecord.js";
import Teacher from "../src/models/Teacher.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/face-attendance-system";

// Connect to MongoDB
console.log(`Connecting to MongoDB at ${MONGODB_URI}`);
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/**
 * Main migration function
 */
const migrateData = async () => {
  try {
    console.log("Starting data model migration...");

    // Step 1: Update Attendance createdBy field from Teacher to Account
    console.log("Step 1: Updating Attendance createdBy field references");
    await migrateAttendanceCreator();

    // Step 2: Migrate embedded student attendance data to AttendanceRecord
    console.log(
      "Step 2: Migrating embedded student attendance to AttendanceRecord"
    );
    await migrateEmbeddedAttendanceToRecords();

    // Step 3: Update Classes to ensure they reference Account instead of Teacher
    console.log(
      "Step 3: Verifying Class references to Account instead of Teacher"
    );
    await verifyClassTeacherReferences();

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

/**
 * Update Attendance createdBy field from Teacher to Account
 */
const migrateAttendanceCreator = async () => {
  try {
    // Find all attendance records that have a createdBy field referencing Teacher
    const attendances = await Attendance.find({ createdBy: { $exists: true } });

    console.log(
      `Found ${attendances.length} attendance records with createdBy field`
    );

    let updatedCount = 0;
    for (const attendance of attendances) {
      try {
        // Find the Teacher document
        const teacher = await Teacher.findById(attendance.createdBy);

        if (teacher && teacher.account) {
          // Update the createdBy field to reference the Account
          attendance.createdBy = teacher.account;
          await attendance.save();
          updatedCount++;
        } else {
          console.log(
            `Could not find Account for Teacher: ${attendance.createdBy}`
          );
        }
      } catch (error) {
        console.error(
          `Error processing attendance ${attendance._id}:`,
          error.message
        );
      }
    }

    console.log(
      `Updated createdBy reference for ${updatedCount} attendance records`
    );
  } catch (error) {
    console.error("Error migrating attendance creator references:", error);
    throw error;
  }
};

/**
 * Migrate embedded student attendance data to AttendanceRecord
 */
const migrateEmbeddedAttendanceToRecords = async () => {
  try {
    // Find all attendance records that have embedded students array
    const attendances = await Attendance.find({
      "students.0": { $exists: true },
    });

    console.log(
      `Found ${attendances.length} attendance records with embedded students`
    );

    let recordsCreated = 0;

    for (const attendance of attendances) {
      try {
        // For each student in the embedded array, create an AttendanceRecord
        for (const studentEntry of attendance.students || []) {
          // Check if AttendanceRecord already exists to avoid duplicates
          const existingRecord = await AttendanceRecord.findOne({
            attendance: attendance._id,
            student: studentEntry.student,
          });

          if (!existingRecord) {
            // Create new AttendanceRecord
            const record = new AttendanceRecord({
              attendance: attendance._id,
              class: attendance.class,
              student: studentEntry.student,
              present: studentEntry.status === "present",
              recordTime: studentEntry.timestamp || attendance.createdAt,
              method: "manual", // Default to manual, as we don't know the original method
              note: studentEntry.isBanned
                ? "Marked as banned in old system"
                : "",
            });

            await record.save();
            recordsCreated++;
          }
        }

        // Update attendance stats
        const records = await AttendanceRecord.find({
          attendance: attendance._id,
        });
        const totalStudents = records.length;
        const presentCount = records.filter((r) => r.present).length;
        const absentCount = totalStudents - presentCount;
        const attendanceRate =
          totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

        // Update the attendance with stats
        attendance.stats = {
          totalStudents,
          presentCount,
          absentCount,
          attendanceRate,
        };

        // If attendance was already completed, make sure it's marked as such
        if (attendance.status === "completed") {
          attendance.endTime = attendance.endTime || new Date(attendance.date);
        }

        await attendance.save();
      } catch (error) {
        console.error(
          `Error processing attendance ${attendance._id}:`,
          error.message
        );
      }
    }

    console.log(`Created ${recordsCreated} AttendanceRecord documents`);
  } catch (error) {
    console.error("Error migrating embedded attendance to records:", error);
    throw error;
  }
};

/**
 * Verify Class references to Account instead of Teacher
 */
const verifyClassTeacherReferences = async () => {
  try {
    // Find all classes
    const classes = await Class.find();

    console.log(`Found ${classes.length} classes to verify`);

    let updatedCount = 0;

    for (const classDoc of classes) {
      if (!classDoc.teacher) {
        console.log(`Class ${classDoc._id} has no teacher assigned`);
        continue;
      }

      // Check if the teacher reference is an Account
      const account = await Account.findById(classDoc.teacher);

      if (account) {
        // Already referencing an Account, no change needed
        continue;
      }

      // Try to find a Teacher and get their Account
      const teacher = await Teacher.findById(classDoc.teacher);

      if (teacher && teacher.account) {
        // Update the class to reference the Account
        classDoc.teacher = teacher.account;
        await classDoc.save();
        updatedCount++;
      } else {
        console.log(
          `Could not find Account for Teacher referenced in class ${classDoc._id}`
        );
      }
    }

    console.log(`Updated teacher reference for ${updatedCount} classes`);
  } catch (error) {
    console.error("Error verifying class teacher references:", error);
    throw error;
  }
};

// Run the migration
migrateData();
