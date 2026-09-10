"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Copy, Check, Loader2, ShieldAlert, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email?: string;
    full_name?: string;
  } | null;
  activeCompanyId?: string | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  activeCompanyId,
}: ResetPasswordDialogProps) {
  const [customPassword, setCustomPassword] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    temporaryPassword: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReset = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customPassword: useCustom ? customPassword : "",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setResult({
          temporaryPassword: json.data.temporaryPassword,
          message: json.data.message,
        });
        toast.success("Password reset successfully! Temporary password generated.");
      } else {
        setErrorMsg(json.error || "Failed to reset password");
        toast.error(json.error || "Failed to reset password");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      setErrorMsg(err.message || "An unexpected error occurred");
      toast.error(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.temporaryPassword) return;
    navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    toast.success("Temporary password copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setResult(null);
    setCustomPassword("");
    setUseCustom(false);
    setErrorMsg(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                Reset User Password
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                {user?.full_name ? `${user.full_name} (${user.email})` : user?.email || "Selected user"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {result ? (
          /* SUCCESS VIEW: Show generated temporary password with copy button */
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <Check className="h-4 w-4" /> Password Reset Successful
              </div>
              <p className="text-[11px] opacity-90">
                A temporary password has been set. Share this password with the user.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                One-Time Temporary Password
              </Label>
              <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <code className="text-base font-mono font-black text-blue-600 dark:text-blue-400 grow tracking-wider select-all">
                  {result.temporaryPassword}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-8 rounded-lg gap-1.5 font-bold text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                <strong>Mandatory Update:</strong> Upon logging in with this temporary password, the user will be automatically redirected to create their new permanent password before gaining access to the platform.
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl h-10 hover:opacity-90"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* FORM VIEW: Choice between auto-generated or custom default password */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="leading-snug">
                This will overwrite the user's password with a temporary one-time password and flag their account to <strong>compulsorily change it upon their next login</strong>.
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password Mode
                </span>
                <button
                  type="button"
                  onClick={() => setUseCustom(!useCustom)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {useCustom ? "Use Auto-Generated Password" : "Set Custom Default Password"}
                </button>
              </div>

              {useCustom ? (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-temp-pass" className="text-xs font-semibold text-slate-500">
                    Custom Temporary Password
                  </Label>
                  <Input
                    id="custom-temp-pass"
                    type="text"
                    placeholder="e.g. TempPass#2026!"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">Must be at least 6 characters</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                    Auto-generate secure 12+ character temporary password
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-500 border-blue-300 dark:border-blue-800">
                    Recommended
                  </Badge>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 gap-2 border-t border-slate-100 dark:border-slate-850 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
                className="rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                disabled={isLoading || (useCustom && customPassword.trim().length < 6)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl h-10 px-5 shadow-lg shadow-amber-600/20 gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Reset & Generate Password
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
