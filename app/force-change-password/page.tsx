import { forceChangePasswordAction, signOutAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, KeyRound, Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ForceChangePasswordPage(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background aesthetic gradients */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6 relative z-10">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <KeyRound className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Password Update Required
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs font-medium">
              You have signed in using a temporary or administrator-reset password. Please create your permanent password to continue.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed font-medium">
            For security reasons, access to platform modules is restricted until a permanent password is set.
          </div>
        </div>

        <form className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              New Permanent Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="Enter new password (min. 8 characters)"
                minLength={8}
                required
                className="pl-10 h-11 bg-slate-950 border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Re-enter new password"
                minLength={8}
                required
                className="pl-10 h-11 bg-slate-950 border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <SubmitButton
            formAction={forceChangePasswordAction}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all mt-2"
          >
            Update Password & Enter Platform
          </SubmitButton>

          <FormMessage message={searchParams} />
        </form>

        <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">Wrong account?</span>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg h-8 gap-1.5 font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
