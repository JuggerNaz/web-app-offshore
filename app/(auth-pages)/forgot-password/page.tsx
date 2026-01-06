import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<Message> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Reset Password</h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Enter your email to receive recovery instructions.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</Label>
          <Input
            name="email"
            placeholder="you@company.com"
            required
            className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <SubmitButton
          pendingText="Sending Link..."
          formAction={forgotPasswordAction}
          className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:opacity-90 transition-all mt-2"
        >
          Send Reset Link
        </SubmitButton>

        <FormMessage message={searchParams} />
      </form>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Remembered your password?{" "}
          <Link className="text-blue-600 font-bold hover:underline" href="/sign-in">
            Go back to Log In
          </Link>
        </p>
      </div>

      <SmtpMessage />
    </div>
  );
}
