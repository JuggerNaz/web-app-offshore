"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole } from "@/utils/role-auth-base";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserInvited: (newUser: any) => void;
  activeCompanyId?: string | null;
}

export function InviteDialog({ open, onOpenChange, onUserInvited, activeCompanyId }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          full_name: fullName,
          designation,
          role,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to invite user");
      }

      onUserInvited(json.data);
      // Reset form
      setEmail("");
      setFullName("");
      setDesignation("");
      setRole("viewer");
      onOpenChange(false);
    } catch (err: any) {
      console.error("[InviteDialog] Error:", err);
      setErrorMessage(err.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 text-white border-slate-800 rounded-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">Invite Team Member</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Send an email invitation to grant access to this company dashboard.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="designation" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Designation
              </Label>
              <Input
                id="designation"
                type="text"
                placeholder="Pipeline Integrity Lead"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
                className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                System Role
              </Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20 text-left">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-850 text-white">
                  <SelectItem value="viewer">Viewer (Read-only access)</SelectItem>
                  <SelectItem value="inspector">Inspector (Perform inspections & attach files)</SelectItem>
                  <SelectItem value="manager">Manager (Approve reports & manage assets)</SelectItem>
                  <SelectItem value="company_admin">Company Admin (Full company configurations)</SelectItem>
                  <SelectItem value="super_admin">Super Admin (Cross-company settings & migrations)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl border-slate-800 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
            >
              {isSubmitting ? "Inviting..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
