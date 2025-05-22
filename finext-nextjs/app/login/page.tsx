// filepath: finext-nextjs/app/login/page.tsx
import { signIn } from "@/lib/auth";

// Định nghĩa các thông báo lỗi thân thiện
const errorMessages: { [key: string]: string } = {
  CredentialsSignin: "Email hoặc mật khẩu không đúng. Vui lòng thử lại.",
  // Bạn có thể thêm các mã lỗi khác từ https://authjs.dev/reference/core/errors
  // Ví dụ, nếu bạn ném new AuthError("Custom message") từ authorize,
  // thì 'error' query param sẽ là "Custom message" (đã được URL encode).
  Default: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { error?: string }; // Làm searchParams optional để tránh lỗi khi không có
}) {
  // searchParams có thể undefined nếu trang được truy cập trực tiếp không qua redirect lỗi
  const errorKey = searchParams?.error;
  const errorMessage = errorKey ? (errorMessages[errorKey] || errorKey) : null;
  // Nếu errorKey không có trong errorMessages, hiển thị chính errorKey đó (đã được decode từ URL)


  return (
    <>
      <form
        action={async (formData) => {
          "use server";
          try {
            await signIn("credentials", formData);
            // Nếu signIn thành công, NextAuth sẽ redirect.
            // Nếu authorize trả về null hoặc ném AuthError, signIn sẽ ném lỗi
            // và NextAuth sẽ xử lý redirect với query param 'error'.
          } catch (error: any) {
            // Thông thường không cần bắt lỗi ở đây nữa vì NextAuth đã xử lý redirect.
            // Nhưng nếu muốn log, có thể làm:
            if (error.type === 'CredentialsSignin') { // Kiểm tra type lỗi của NextAuth
              // Đây là lỗi dự kiến, không cần log quá nhiều nếu đã hiển thị cho user
            } else {
              console.error("[Login Page Action] Lỗi không mong muốn khi signIn:", error);
            }
            // Không return/redirect ở đây để NextAuth làm việc của nó.
          }
        }}
      >
        <h2>Đăng nhập</h2>
        {errorMessage && (
          <p style={{ color: "red", marginBottom: "1rem", border: "1px solid red", padding: "0.5rem" }}>
            {errorMessage}
          </p>
        )}
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div>
          <label htmlFor="password">Mật khẩu</label>
          <input id="password" name="password" type="password" required />
        </div>
        <button type="submit">Đăng nhập</button>
      </form>

      <hr style={{ margin: "2rem 0" }} />

      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit">Đăng nhập với Google</button>
      </form>
    </>
  );
}