// filepath: d:\twan-projects\finext-web-app\finext-nextjs\components\auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from 'next-auth/providers/google';
import { getUserFromDb } from "./data";
import { comparePassword } from "./password";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          console.error("Định dạng email hoặc mật khẩu không hợp lệ.");
          // Trả về null hoặc throw lỗi tùy theo cách NextAuth xử lý
          return null;
        }

        // Lấy người dùng từ DB bằng email
        const userFromDb = await getUserFromDb(credentials.email);

        if (!userFromDb || !userFromDb.passwordHash) {
          console.log("Không tìm thấy người dùng hoặc thiếu password hash cho email:", credentials.email);
          throw new Error("Thông tin đăng nhập không hợp lệ.");
        }

        // Xác minh mật khẩu
        // credentials.password là mật khẩu văn bản thuần túy từ form đăng nhập
        // userFromDb.passwordHash là mật khẩu đã hash được lưu trong DB
        const passwordsMatch = comparePassword(credentials.password, userFromDb.passwordHash);

        if (!passwordsMatch) {
          console.log("Mật khẩu không khớp cho người dùng:", credentials.email);
          throw new Error("Thông tin đăng nhập không hợp lệ.");
        }

        // Trả về đối tượng người dùng không bao gồm passwordHash
        const { passwordHash, ...userToReturn } = userFromDb;
        console.log("Người dùng đã được xác thực:", userToReturn.email);
        return userToReturn;
      },
    }),
  ],
  // ...existing code...
})