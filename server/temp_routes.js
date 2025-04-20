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

    const teacher = await Teacher.findOne({ account: accountId }).populate(
      "department"
    );

    if (!teacher) {
      console.log(`No teacher profile found for account: ${accountId}`);
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin giảng viên" });
    }

    console.log(`Teacher profile found: ${teacher._id}`);
    res.status(200).json(teacher);
  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin giảng viên" });
  }
});
