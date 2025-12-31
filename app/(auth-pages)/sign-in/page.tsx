import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login({ searchParams }: { searchParams: Promise<Message> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Sign In</h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Enter your credentials to access your field assets.
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

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</Label>
            <Link className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline" href="/forgot-password">
              Forgot?
            </Link>
          </div>
          <Input
            type="password"
            name="password"
            placeholder="••••••••"
            required
            className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <SubmitButton
          pendingText="Authenticating..."
          formAction={signInAction}
          className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:opacity-90 transition-all mt-2"
        >
          Sign In
        </SubmitButton>

        <FormMessage message={searchParams} />
      </form>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          New to the platform?{" "}
          <Link className="text-blue-600 font-bold hover:underline" href="/sign-up">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}
