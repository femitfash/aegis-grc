import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export const metadata = {
  title: "Reset Password - FastGRC",
  description: "Set a new password for your FastGRC account",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
