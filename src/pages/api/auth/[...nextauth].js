import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/dbConnect";
import Account from "@/models/Account";
import bcrypt from "bcryptjs";

export default NextAuth({
  providers: [
    // ... existing code ...
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Kết nối database
      await dbConnect();

      // Chỉ xử lý đăng nhập bằng Google
      if (account.provider === "google") {
        // Kiểm tra tài khoản đã tồn tại chưa
        const existingUser = await Account.findOne({ email: profile.email });

        if (existingUser) {
          // Nếu tài khoản tồn tại nhưng đang ở trạng thái pending
          if (
            existingUser.status === "pending" &&
            existingUser.role === "teacher"
          ) {
            throw new Error("Tài khoản của bạn đang chờ được phê duyệt!");
          }

          // Nếu tài khoản tồn tại nhưng bị chặn
          if (existingUser.status === "blocked") {
            throw new Error("Tài khoản của bạn đã bị chặn!");
          }

          // Cập nhật thông tin khi đăng nhập lại
          existingUser.lastLogin = new Date();
          await existingUser.save();

          return true;
        } else {
          // Tạo tài khoản mới với role=teacher và status=pending
          const newAccount = new Account({
            email: profile.email,
            name: profile.name,
            role: "teacher",
            status: "pending", // Tài khoản mới sẽ ở trạng thái chờ duyệt
            provider: "google",
            lastLogin: new Date(),
          });

          await newAccount.save();

          // Hiển thị thông báo cho người dùng
          throw new Error(
            "Tài khoản của bạn đã được tạo và đang chờ được phê duyệt!"
          );
        }
      }

      return true;
    },
    // ... existing code ...
  },
  // ... existing code ...
});
