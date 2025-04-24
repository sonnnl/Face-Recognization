import mongoose from "mongoose";
import Account from "../src/models/Account.js";
import { Teacher as OldTeacher } from "../src/models/Teacher.js";
import { Student as OldStudent } from "../src/models/Student.js";
import User, { Admin, Teacher, Student } from "../src/models/User.js";
import AdminClass from "../src/models/AdminClass.js";
import dotenv from "dotenv";

dotenv.config();

// Kết nối database
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

// Di chuyển dữ liệu người dùng
const migrateUsers = async () => {
  try {
    console.log("Starting user migration...");

    // 1. Di chuyển Admin từ model Account hiện tại
    console.log("Migrating admin accounts...");
    const adminAccounts = await Account.find({ role: "admin" });
    console.log(`Found ${adminAccounts.length} admin accounts`);

    for (const account of adminAccounts) {
      console.log(`Migrating admin: ${account.email}`);
      await Admin.create({
        name: account.name,
        email: account.email,
        password: account.password, // Đã được hash
        googleId: account.googleId,
        role: "admin",
        status: account.status,
        provider: account.provider,
        createdAt: account.createdAt,
        lastLogin: account.lastLogin,
        // Các trường riêng của Admin
        adminType: "system",
        permissions: [],
      });
    }

    // 2. Di chuyển Teacher từ models Account và Teacher
    console.log("Migrating teacher accounts...");
    const teacherAccounts = await Account.find({ role: "teacher" });
    console.log(`Found ${teacherAccounts.length} teacher accounts`);

    for (const account of teacherAccounts) {
      console.log(`Migrating teacher: ${account.email}`);
      const teacherProfile = await OldTeacher.findOne({ account: account._id });

      await Teacher.create({
        name: account.name,
        email: account.email,
        password: account.password,
        googleId: account.googleId,
        role: "teacher",
        status: account.status,
        provider: account.provider,
        createdAt: account.createdAt,
        lastLogin: account.lastLogin,
        // Các trường riêng của Teacher
        department: teacherProfile?.department,
        phone: teacherProfile?.phone || "",
        address: teacherProfile?.address || "",
        academicTitle: teacherProfile?.title || "Giảng viên",
        bio: teacherProfile?.bio || "",
      });
    }

    // 3. Di chuyển Student từ models Account và Student
    console.log("Migrating student accounts...");
    const studentAccounts = await Account.find({ role: "student" });
    console.log(`Found ${studentAccounts.length} student accounts`);

    for (const account of studentAccounts) {
      console.log(`Migrating student: ${account.email}`);
      const studentProfile = await OldStudent.findOne({
        accountId: account._id,
      });

      if (studentProfile) {
        await Student.create({
          name: account.name,
          email: account.email,
          password: account.password,
          googleId: account.googleId,
          role: "student",
          status: account.status,
          provider: account.provider,
          createdAt: account.createdAt,
          lastLogin: account.lastLogin,
          // Các trường riêng của Student
          studentId: studentProfile.studentId,
          phone: studentProfile.phone || "",
          gender: studentProfile.gender || "male",
          address: studentProfile.address || "",
          faceImage: studentProfile.faceImage,
          faceFeatures: studentProfile.faceFeatures,
          classes: studentProfile.classes || [],
          adminClass: studentProfile.adminClass,
          active: studentProfile.active,
        });
      } else {
        // Xử lý account student không có hồ sơ
        console.warn(
          `Không tìm thấy hồ sơ sinh viên cho account: ${account._id}`
        );
      }
    }

    console.log("User migration completed successfully!");
  } catch (error) {
    console.error("Error during migration:", error);
  }
};

// Cập nhật tham chiếu trong các collection khác
const updateReferences = async () => {
  try {
    console.log("Updating references in other collections...");

    // Tạo mapping từ IDs cũ sang IDs mới
    const accountToUserMap = new Map();
    const oldAccounts = await Account.find();
    const newUsers = await User.find();

    console.log(
      `Creating mapping for ${oldAccounts.length} accounts to ${newUsers.length} users`
    );

    // Tạo mapping dựa trên email (hoặc một trường duy nhất khác)
    for (const oldAccount of oldAccounts) {
      const newUser = newUsers.find((user) => user.email === oldAccount.email);
      if (newUser) {
        accountToUserMap.set(oldAccount._id.toString(), newUser._id);
      }
    }

    // Cập nhật tham chiếu trong AdminClass
    console.log("Updating references in AdminClass...");
    const adminClasses = await AdminClass.find({
      mainTeacher: { $exists: true, $ne: null },
    });
    console.log(`Found ${adminClasses.length} admin classes with teachers`);

    for (const adminClass of adminClasses) {
      if (adminClass.mainTeacher) {
        const newTeacherId = accountToUserMap.get(
          adminClass.mainTeacher.toString()
        );
        if (newTeacherId) {
          console.log(
            `Updating teacher reference for class: ${adminClass.name}`
          );
          adminClass.mainTeacher = newTeacherId;
          await adminClass.save();
        }
      }
    }

    // Cập nhật các tham chiếu khác ở đây...

    console.log("Reference updates completed successfully!");
  } catch (error) {
    console.error("Error updating references:", error);
  }
};

// Chạy quá trình di chuyển
const runMigration = async () => {
  try {
    // Kiểm tra xem đã có dữ liệu trong collection mới chưa
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log(
        `Found ${existingUsers} users in the new collection. Migration may have already been done.`
      );
      const proceed = process.argv.includes("--force");
      if (!proceed) {
        console.log("Use --force flag to proceed with migration anyway.");
        process.exit(0);
      }
      console.log("Proceeding with migration (--force flag detected)");
    }

    await migrateUsers();
    await updateReferences();

    console.log("Migration process completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    // Đóng kết nối
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

runMigration();
