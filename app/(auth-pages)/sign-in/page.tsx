import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const MicrosoftIcon = () => (
  <svg className="h-4 w-4 mr-3 shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0H11V11H0V0Z" fill="#F25022"/>
    <path d="M12 0H23V11H12V0Z" fill="#7FBA00"/>
    <path d="M0 12H11V23H0V12Z" fill="#00A1F1"/>
    <path d="M12 12H23V23H12V12Z" fill="#FFB900"/>
  </svg>
);

export default async function Login({ searchParams }: { searchParams: Promise<Message> }) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black tracking-tight text-white">Sign In</h1>
        <p className="text-sm font-medium text-slate-400">
          Enter your credentials to access your field assets.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Email Address
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
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Password
            </Label>
            <Link 
              className="text-[10px] font-bold text-blue-400 uppercase tracking-wider hover:text-blue-300 transition-colors" 
              href="/forgot-password"
            >
              Forgot?
            </Link>
          </div>
          <Input
            type="password"
            name="password"
            placeholder="••••••••"
            required
            className="h-12 rounded-xl border-slate-800 bg-slate-950/50 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
          />
        </div>

        <SubmitButton
          pendingText="Authenticating..."
          formAction={signInAction}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 mt-2"
        >
          Sign In
        </SubmitButton>

        <FormMessage message={params} />
      </form>

      <div className="flex items-center my-1">
        <div className="grow border-t border-slate-800/80" />
        <span className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Or</span>
        <div className="grow border-t border-slate-800/80" />
      </div>

      <button
        type="button"
        disabled
        className="h-12 w-full rounded-xl border border-slate-850 bg-slate-950/20 hover:bg-slate-900/40 text-slate-400 text-sm font-semibold transition-all duration-200 flex items-center justify-center relative cursor-not-allowed group"
      >
        <MicrosoftIcon />
        <span>Sign in with Microsoft</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold bg-slate-800/40 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider scale-90 group-hover:scale-95 transition-transform duration-200">
          Soon
        </span>
      </button>

      <div className="pt-4 border-t border-slate-800/80 text-center">
        <p className="text-sm font-medium text-slate-400">
          New to the platform?{" "}
          <Link className="text-blue-400 font-bold hover:text-blue-300 transition-colors" href="/sign-up">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}
