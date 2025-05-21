// filepath: d:\twan-projects\finext-web-app\finext-nextjs\lib\data.ts
// Đây là một triển khai giả lập. Hãy thay thế bằng logic cơ sở dữ liệu thực tế của bạn.

// Định nghĩa một kiểu User bao gồm cả password hash
export interface User {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string; // Lưu trữ mật khẩu đã được hash
  // Thêm các trường người dùng khác nếu cần
}

// Cơ sở dữ liệu giả lập (thay thế bằng kết nối và truy vấn cơ sở dữ liệu thực tế của bạn)
const users: User[] = [
  {
    id: '1',
    email: 'user@example.com',
    name: 'Test User',
    // Mật khẩu đã hash ví dụ (bạn sẽ tạo ra cái này trong quá trình đăng ký người dùng)
    // Hash này được tạo từ 'password123' bằng bcryptjs
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p9LtjL EFL7YpsmMaa33.i6', // Thay thế bằng hash thực tế
  },
  // Thêm người dùng khác nếu cần
];

export async function getUserFromDb(email: string): Promise<User | null> {
  // Trong một ứng dụng thực tế, bạn sẽ truy vấn cơ sở dữ liệu của mình ở đây
  console.log(`Đang cố gắng tìm người dùng bằng email: ${email}`);
  const user = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (user) {
    console.log(`Người dùng được tìm thấy: ${user.email}`);
    return { ...user }; // Trả về một bản sao của đối tượng người dùng
  }
  console.log(`Không tìm thấy người dùng với email: ${email}`);
  return null;
}

// Bạn cũng sẽ cần một hàm để tạo người dùng, ví dụ, trong quá trình đăng ký
// import { saltAndHashPassword } from '@/utils/password'; // Giả sử đường dẫn này
//
// export async function createUserInDb(email: string, plainPassword: string, name?: string): Promise<User> {
//   const passwordHash = saltAndHashPassword(plainPassword); // Hash mật khẩu trước khi lưu
//   const newUser: User = {
//     id: String(Date.now()), // Tạo ID đơn giản cho ví dụ
//     email,
//     name: name || null,
//     passwordHash,
//   };
//   users.push(newUser); // Thêm vào DB giả lập
//   console.log(`Người dùng đã được tạo: ${newUser.email}`);
//   return newUser;
// }