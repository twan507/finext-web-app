import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10; // Bạn có thể điều chỉnh số vòng salt theo nhu cầu bảo mật

export function saltAndHashPassword(password: string): string {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }
  const salt = bcrypt.genSaltSync(SALT_ROUNDS);
  const hash = bcrypt.hashSync(password, salt);
  return hash;
}

// Bạn cũng sẽ cần một hàm để so sánh mật khẩu khi người dùng đăng nhập
export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}