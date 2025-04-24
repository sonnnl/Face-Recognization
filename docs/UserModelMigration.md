# Hướng dẫn di chuyển mô hình User

Tài liệu này mô tả cách di chuyển từ mô hình hiện tại (Account, Student, Teacher riêng biệt) sang mô hình mới sử dụng Discriminator Pattern.

## Mô hình mới

Mô hình mới sử dụng một collection duy nhất "users" với các schema con cho từng loại người dùng:

```javascript
// Base User Schema
const userSchema = mongoose.Schema(
  {
    // Các trường chung cho tất cả người dùng
  },
  { discriminatorKey: "role" }
);

// Teacher, Student, Admin Schema là các discriminator
const Teacher = User.discriminator("teacher", teacherSchema);
const Student = User.discriminator("student", studentSchema);
const Admin = User.discriminator("admin", adminSchema);
```

## Lợi ích của mô hình mới

1. **Hiệu suất tốt hơn**: Không cần join/lookup với nhiều collection
2. **Mã nguồn đơn giản**: Xử lý xác thực và phân quyền dễ dàng hơn
3. **Schema rõ ràng**: Mỗi loại người dùng có schema riêng với các trường cụ thể
4. **Không trùng lặp dữ liệu**: Không cần lưu các thông tin cơ bản ở nhiều nơi

## Các bước di chuyển dữ liệu

### 1. Chuẩn bị môi trường mới

1. Tạo backup database hiện tại
2. Triển khai mô hình `User` mới trong ứng dụng

### 2. Di chuyển dữ liệu

Sử dụng script sau để di chuyển dữ liệu:

```javascript
// Script di chuyển dữ liệu từ mô hình cũ sang mới
const migrateUsers = async () => {
  // 1. Di chuyển Admin từ model Account hiện tại
  const adminAccounts = await Account.find({ role: "admin" });
  for (const account of adminAccounts) {
    await Admin.create({
      name: account.name,
      email: account.email,
      password: account.password, // Đã được hash
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
  const teacherAccounts = await Account.find({ role: "teacher" });
  for (const account of teacherAccounts) {
    const teacherProfile = await Teacher.findOne({ account: account._id });

    await Teacher.create({
      name: account.name,
      email: account.email,
      password: account.password,
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
  const studentAccounts = await Account.find({ role: "student" });
  for (const account of studentAccounts) {
    const studentProfile = await Student.findOne({ accountId: account._id });

    if (studentProfile) {
      await Student.create({
        name: account.name,
        email: account.email,
        password: account.password,
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

  console.log("Migration completed successfully!");
};
```

### 3. Cập nhật tham chiếu trong các collection khác

```javascript
// Cập nhật tham chiếu trong các models khác
const updateReferences = async () => {
  // Tạo mapping từ IDs cũ sang IDs mới
  const accountToUserMap = new Map();
  const oldAccounts = await Account.find();
  const newUsers = await User.find();

  // Tạo mapping dựa trên email (hoặc một trường duy nhất khác)
  for (const oldAccount of oldAccounts) {
    const newUser = newUsers.find((user) => user.email === oldAccount.email);
    if (newUser) {
      accountToUserMap.set(oldAccount._id.toString(), newUser._id);
    }
  }

  // Cập nhật tham chiếu trong các collection khác
  // Ví dụ: Cập nhật tham chiếu trong AdminClass
  const adminClasses = await AdminClass.find({
    mainTeacher: { $exists: true, $ne: null },
  });
  for (const adminClass of adminClasses) {
    if (adminClass.mainTeacher) {
      const newTeacherId = accountToUserMap.get(
        adminClass.mainTeacher.toString()
      );
      if (newTeacherId) {
        adminClass.mainTeacher = newTeacherId;
        await adminClass.save();
      }
    }
  }

  // Cập nhật các tham chiếu khác tương tự...
};
```

### 4. Kiểm tra và xác nhận

1. Kiểm tra số lượng bản ghi trong collection mới có khớp với số lượng trong các collection cũ không
2. Kiểm tra các tính năng đăng nhập, phân quyền
3. Kiểm tra các tính năng riêng cho từng loại người dùng
4. Xác nhận tất cả tham chiếu giữa các collection đã được cập nhật đúng

### 5. Cập nhật mã nguồn

1. Thay thế tất cả tham chiếu đến `Account`, `Teacher`, `Student` bằng `User`, `Teacher`, `Student` từ mô hình mới
2. Cập nhật các truy vấn để tận dụng schema mới

## Lưu ý quan trọng

1. **Backup dữ liệu** trước khi thực hiện di chuyển
2. **Kiểm tra trong môi trường thử nghiệm** trước khi áp dụng vào môi trường sản xuất
3. **Lên kế hoạch thời gian ngưng hoạt động** nếu cần thiết
4. **Có phương án khôi phục** nếu gặp vấn đề

## Các thay đổi API

Một số thay đổi API cần được thực hiện:

1. Endpoints liên quan đến người dùng nên sử dụng collection "users" thay vì "accounts"
2. Truy vấn người dùng có thể thực hiện trực tiếp: `User.findById()` thay vì cần join nhiều collection
3. Khi tạo người dùng mới, sử dụng model con tương ứng: `Teacher.create()`, `Student.create()` thay vì tạo nhiều documents liên quan
