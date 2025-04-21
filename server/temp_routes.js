import express from "express";
import mongoose from "mongoose";
import Teacher from "../src/models/Teacher.js";
import Account from "../src/models/Account.js";
import Class from "../src/models/Class.js";
import Student from "../src/models/Student.js";
import { auth } from "../src/middleware/auth.js";

const router = express.Router();

// Endpoint đơn giản để xóa tài khoản giảng viên
router.delete("/teachers/cancel-registration", auth, async (req, res) => {
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

// Endpoint đơn giản để xóa tài khoản sinh viên
router.delete("/students/cancel-registration", auth, async (req, res) => {
  try {
    const userId = req.account._id;
    console.log(`===== PROCESSING STUDENT ACCOUNT DELETION =====`);
    console.log(`Account ID: ${userId}`);

    // Tìm thông tin tài khoản
    const account = await Account.findById(userId);
    if (!account) {
      console.log(`Account not found: ${userId}`);
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    console.log(
      `Account found: ${account._id}, Email: ${account.email}, Role: ${account.role}`
    );
    console.log(`Student Reference: ${account.studentId || "None"}`);

    // Tìm sinh viên liên kết với tài khoản này (tìm theo ID hoặc tìm theo tài khoản)
    let student = null;

    // Phương thức 1: Tìm theo ID nếu có studentId trong account
    if (account.studentId) {
      console.log(`Looking for student by ID: ${account.studentId}`);
      student = await Student.findById(account.studentId);
      if (student) {
        console.log(
          `Found student by ID: ${student._id}, Name: ${student.name}`
        );
      }
    }

    // Phương thức 2: Tìm theo account reference
    if (!student) {
      console.log(`Looking for student by account reference: ${account._id}`);
      student = await Student.findOne({ account: account._id });
      if (student) {
        console.log(
          `Found student by account reference: ${student._id}, Name: ${student.name}`
        );
      }
    }

    // Phương thức 3: Tìm theo email
    if (!student && account.email) {
      console.log(`Looking for student by email: ${account.email}`);
      student = await Student.findOne({ email: account.email });
      if (student) {
        console.log(
          `Found student by email: ${student._id}, Name: ${student.name}`
        );
      }
    }

    // Nếu tìm thấy sinh viên, tiến hành xóa
    if (student) {
      console.log(`Deleting student: ${student._id}`);

      // Cập nhật AdminClass nếu sinh viên thuộc lớp nào
      if (student.adminClass) {
        console.log(`Student belongs to AdminClass: ${student.adminClass}`);
        try {
          const adminClass = await mongoose
            .model("AdminClass")
            .findById(student.adminClass);
          if (adminClass) {
            console.log(
              `Updating student count in AdminClass: ${adminClass.name}`
            );
            // Cập nhật học sinh count trong AdminClass
            if (adminClass.studentCount && adminClass.studentCount > 0) {
              adminClass.studentCount -= 1;
              await adminClass.save();
              console.log(
                `Updated AdminClass student count to: ${adminClass.studentCount}`
              );
            }
          }
        } catch (adminClassError) {
          console.error(
            `Error updating AdminClass: ${adminClassError.message}`
          );
        }
      }

      // Xóa khỏi các lớp học thông thường
      if (student.classes && student.classes.length > 0) {
        console.log(
          `Student belongs to ${student.classes.length} regular classes`
        );
        try {
          for (const classId of student.classes) {
            await Class.updateOne(
              { _id: classId },
              { $pull: { students: student._id } }
            );
          }
          console.log(`Removed student from all regular classes`);
        } catch (classesError) {
          console.error(`Error removing from classes: ${classesError.message}`);
        }
      }

      // Xóa sinh viên
      await Student.findByIdAndDelete(student._id);
      console.log(`Student deleted successfully: ${student._id}`);
    } else {
      console.log(`No student record found for account: ${account._id}`);
    }

    // Xóa tài khoản
    await Account.findByIdAndDelete(userId);
    console.log(`Account deleted successfully: ${userId}`);
    console.log(`===== STUDENT ACCOUNT DELETION COMPLETED =====`);

    res.status(200).json({ message: "Tài khoản đã được xóa thành công" });
  } catch (error) {
    console.error(`===== STUDENT ACCOUNT DELETION ERROR =====`);
    console.error(`Error details: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({ message: "Lỗi khi xóa tài khoản sinh viên" });
  }
});

export default router;
