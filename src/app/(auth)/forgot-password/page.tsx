import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata = {
  title: "Forgot Password - FastGRC",
  description: "Reset your FastGRC account password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
