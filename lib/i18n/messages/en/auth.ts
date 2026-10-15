// 인증 화면(로그인·가입·비밀번호 찾기·재설정·메일 확인) 영어 문구
import type { Messages } from "../types";

export default {
  field: {
    email: "Email",
    emailPlaceholder: "name@example.com",
    password: "Password",
    name: "Name",
    namePlaceholder: "Jane Doe",
    passwordMin: "At least {min} characters",
    passwordHint: "Use at least {min} characters with letters and numbers.",
  },
  backToLogin: "Back to log in",
  sending: "Sending…",
  linkError: "This link has expired or was already used. Please request a new one.",
  login: {
    title: "Log in",
    description: "Welcome back to your workspace.",
    noAccount: "Don't have an account?",
    createAccount: "Sign up",
    forgot: "Forgot password?",
    submit: "Log in",
    submitting: "Logging in…",
    demo: "Try the demo",
    demoPending: "Preparing demo…",
    demoNote: "Opens your own demo without signing up. It's deleted after 24 hours. File uploads are disabled.",
  },
  signup: {
    metaTitle: "Sign up",
    title: "Create your account",
    description: "Sign up with email and manage your team's work in one place.",
    haveAccount: "Already have an account?",
    login: "Log in",
    submit: "Sign up",
    submitting: "Signing up…",
  },
  forgot: {
    title: "Forgot password",
    description: "Enter the email you signed up with and we'll send you a link to reset your password.",
    submit: "Send reset link",
  },
  forgotSent: {
    metaTitle: "Email sent",
    title: "Check your inbox",
    description:
      "If an account exists for that email, we've sent a password reset link. Open it in the browser you requested it from.",
    again: "Send again",
  },
  reset: {
    metaTitle: "Reset password",
    expiredTitle: "This link has expired",
    expiredDescription:
      "You can change your password only within 10 minutes of opening the link in the reset email. If the link has expired or was already used, request a new one.",
    forgot: "Forgot password",
    title: "Set a new password",
    description: "Enter the new password you'll use to log in.",
    newPassword: "New password",
    confirm: "Confirm new password",
    confirmPlaceholder: "Enter it again",
    submit: "Change password",
    submitting: "Saving…",
  },
  resetDone: {
    metaTitle: "Password changed",
    title: "Your password has been changed",
    description: "You can keep using the app with your new password.",
    go: "Go to workspace",
  },
  verify: {
    metaTitle: "Confirm email",
    title: "Check your inbox",
    sentTo: "We sent a confirmation link to {email}. Click it to finish signing up.",
    sentGeneric: "We sent a confirmation link to the email you signed up with. Click it to finish signing up.",
    spamHint: "Don't see it? Check your spam folder or send it again.",
    resent: "Confirmation email sent again.",
    resend: "Resend confirmation email",
  },
} satisfies Messages["auth"];
