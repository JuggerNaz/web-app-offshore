import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function Signup({ searchParams }: { searchParams: Promise<Message> }) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black tracking-tight text-white">Create Account</h1>
        <p className="text-sm font-medium text-slate-400">
          Request access to the enterprise offshore management network.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Company Email
          </Label>
          <Input
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            className="h-12 rounded-xl border-slate-800 bg-slate-950/50 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Full Name
          </Label>
          <Input
            name="full_name"
            type="text"
            placeholder="John Doe"
            required
            className="h-12 rounded-xl border-slate-800 bg-slate-950/50 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="designation" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Designation / Role Description
          </Label>
          <Input
            name="designation"
            type="text"
            placeholder="Lead Integrity Engineer"
            required
            className="h-12 rounded-xl border-slate-800 bg-slate-950/50 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Password
          </Label>
          <Input
            type="password"
            name="password"
            placeholder="••••••••"
            minLength={6}
            required
            className="h-12 rounded-xl border-slate-800 bg-slate-950/50 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        <SubmitButton
          pendingText="Creating Account..."
          formAction={signUpAction}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 mt-2"
        >
          Sign Up
        </SubmitButton>

        <FormMessage message={params} />
      </form>

      <div className="pt-4 border-t border-slate-800/80 text-center">
        <p className="text-sm font-medium text-slate-400">
          Already have an account?{" "}
          <Link className="text-blue-400 font-bold hover:text-blue-300 transition-colors" href="/sign-in">
            Log In
          </Link>
        </p>
      </div>

      <SmtpMessage />
    </div>
  );
}
