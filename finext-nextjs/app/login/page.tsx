
import { signIn } from "@/lib/auth"

export default function SignIn() {
  return (
    <>
      <form
        action={async (formData) => {
          "use server"
          await signIn("credentials", formData)
        }}
      >
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" />
        </label>
        <button>Sign In</button>
      </form>
      <form
        action={async () => {
          "use server"
          await signIn("google")
        }}
      >
        <button type="submit">Signin with Google</button>
      </form>
    </>
  )
} 