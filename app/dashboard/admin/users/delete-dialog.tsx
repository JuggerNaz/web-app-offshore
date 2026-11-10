"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Trash2,
  UserX,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMember: any | null;
  members?: any[];
  activeCompanyId?: string | null;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  onUserDeleted: (membershipId: string, userId: string, action?: string, message?: string) => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  targetMember,
  members = [],
  activeCompanyId,
  currentUserId,
  isSuperAdmin = false,
  onUserDeleted,
}: DeleteDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [hardDelete, setHardDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (targetMember) {
        setSelectedMemberId(targetMember.id);
      } else if (members.length > 0) {
        // Find first eligible member (not self)
        const firstOther = members.find(
          (m) => (m.user?.id || m.user_id) !== currentUserId
        );
        setSelectedMemberId(firstOther ? firstOther.id : members[0].id);
      }
      setHardDelete(false);
      setErrorMessage(null);
    }
  }, [open, targetMember, members, currentUserId]);

  const activeMember = targetMember
    ? targetMember
    : members.find((m) => m.id === selectedMemberId);

  const rawUser = activeMember?.user;
  const user = (Array.isArray(rawUser) ? rawUser[0] : rawUser) || {};
  const isSelf = (user.id || activeMember?.user_id) === currentUserId;

  const initials =
    (user.full_name || "")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user.email?.slice(0, 2).toUpperCase() ||
    "??";

  const handleDelete = async () => {
    if (!activeMember) return;
    if (isSelf) {
      setErrorMessage("You cannot delete your own account.");
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(
        `/api/admin/users/${activeMember.id}${hardDelete ? "?hard=true" : ""}`,
        {
          method: "DELETE",
          headers,
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Failed to delete user");
      }

      const targetUserId = user.id || activeMember.user_id;
      const action = json.data?.action;
      const message = json.data?.message;
      onUserDeleted(activeMember.id, targetUserId, action, message);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[DeleteDialog] Error:", err);
      setErrorMessage(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Delete / Remove User
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Remove access, revoke roles, or permanently delete the user ID.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Member Selector if opened from header with no pre-selected member */}
        {!targetMember && members.length > 0 && (
          <div className="space-y-2 pt-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Select User to Remove
            </label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectValue placeholder="Choose a user to delete" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-850 text-white max-h-60">
                {members.map((m) => {
                  const u = (Array.isArray(m.user) ? m.user[0] : m.user) || {};
                  return (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {u.full_name || u.email} ({u.email})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Target User Details Card */}
        {activeMember && (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-slate-200 dark:border-slate-700">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {user.full_name || "Invited User"}
                  </span>
                  {isSelf && (
                    <Badge className="bg-blue-500/10 text-blue-500 border-none font-bold text-[9px] uppercase">
                      You
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-400 truncate">{user.email}</div>
              </div>
              <Badge
                variant="outline"
                className="font-semibold text-[10px] uppercase border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              >
                {activeMember.role?.replace("_", " ") || "Viewer"}
              </Badge>
            </div>

            {user.designation && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 pt-2 flex justify-between">
                <span>Designation:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {user.designation}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Deletion & Audit Policy */}
        <div className="space-y-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-850 dark:text-amber-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Intelligent Data & Audit Protection</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              • If this user has recorded <strong>inspection data, anomalies, or SOW tasks</strong>, their account is safely <strong>archived (soft-deleted)</strong> so all reports and audit trails keep their full name and qualifications intact without broken references.
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              • If <strong>no inspection data exists</strong> for this user (e.g. duplicate or newly created), their account and credentials will be <strong>permanently deleted</strong>.
            </p>
          </div>

          {isSuperAdmin && (
            <div className="flex items-start space-x-2.5 pt-1">
              <Checkbox
                id="hard-delete-chk"
                checked={hardDelete}
                onCheckedChange={(checked) => setHardDelete(Boolean(checked))}
                className="mt-0.5 rounded-md"
              />
              <label
                htmlFor="hard-delete-chk"
                className="text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer select-none leading-relaxed"
              >
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  Force permanent delete regardless of data (Super Admin Override)
                </span>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
                  Overrides automatic archiving and forces permanent removal of this user ID.
                </p>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto h-11 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSelf || !activeMember}
            className="w-full sm:w-auto h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2 shadow-lg shadow-rose-600/20"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{hardDelete ? "Permanently Delete User" : "Remove User"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

