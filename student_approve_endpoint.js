// Endpoint phê duyệt tài khoản sinh viên (chỉ admin và giáo viên)
app.put("/api/admin/students/:id/approve", auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Approving student account: ${id}`);

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

    // Cập nhật trạng thái tài khoản
    account.status = "active";
    await account.save();

    console.log(`Student account approved: ${account.email}`);
    res
      .status(200)
      .json({ message: "Đã duyệt tài khoản sinh viên thành công", account });
  } catch (error) {
    console.error("Error approving student account:", error);
    res.status(500).json({ message: "Lỗi khi duyệt tài khoản sinh viên" });
  }
});
