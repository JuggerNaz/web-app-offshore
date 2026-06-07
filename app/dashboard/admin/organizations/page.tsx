"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useUserRole } from "@/utils/hooks/use-user-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Search,
  Users,
  Edit,
  Trash2,
  ArrowLeft,
  UserPlus,
  Shield,
  ShieldAlert,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  max_users: number;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

interface OrgMember {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  is_active: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    designation: string;
  };
}

type View = "list" | "detail";

export default function OrganizationsPage() {
  const { hasMinRole } = useUserRole();
  const isSuperAdmin = hasMinRole("super_admin");

  const [view, setView] = useState<View>("list");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    max_users: 50,
    subscription_plan: "standard",
    slugTouched: false,
  });
  const [addMemberData, setAddMemberData] = useState({
    user_id: "",
    role: "viewer",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/admin/organizations");
      if (res.ok) {
        const json = await res.json();
        setOrganizations(json.data || []);
      } else {
        let errText = `Error ${res.status}: ${res.statusText}`;
        try {
          const json = await res.json();
          if (json.error) errText = json.error;
        } catch (_) {}
        setErrorMsg(errText);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
      setErrorMsg("Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members`);
      if (res.ok) {
        const json = await res.json();
        setMembers(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOrganizations();
    }
  }, [isSuperAdmin, fetchOrganizations]);

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <div className="flex flex-col items-center text-center space-y-3">
          <ShieldAlert className="h-12 w-12 text-slate-400" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Access Restricted</h3>
          <p className="text-sm text-slate-400 max-w-xs">Only super admins can manage organizations.</p>
        </div>
      </div>
    );
  }

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowCreateDialog(false);
        setFormData({ name: "", slug: "", description: "", max_users: 50, subscription_plan: "standard", slugTouched: false });
        fetchOrganizations();
      } else {
        const json = await res.json();
        alert(json.error || "Failed to create organization");
      }
    } catch (err) {
      console.error("Create error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedOrg) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowEditDialog(false);
        fetchOrganizations();
        setSelectedOrg(null);
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update organization");
      }
    } catch (err) {
      console.error("Edit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrg) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteDialog(false);
        setSelectedOrg(null);
        fetchOrganizations();
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !org.is_active }),
      });
      if (res.ok) fetchOrganizations();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrg) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberData),
      });
      if (res.ok) {
        setShowAddMemberDialog(false);
        setAddMemberData({ user_id: "", role: "viewer" });
        fetchMembers(selectedOrg.id);
      } else {
        const json = await res.json();
        alert(json.error || "Failed to add member");
      }
    } catch (err) {
      console.error("Add member error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (org: Organization) => {
    setSelectedOrg(org);
    setView("detail");
    fetchMembers(org.id);
  };

  const openEdit = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || "",
      max_users: org.max_users,
      subscription_plan: org.subscription_plan,
      slugTouched: true,
    });
    setShowEditDialog(true);
  };

  const openCreate = () => {
    setFormData({ name: "", slug: "", description: "", max_users: 50, subscription_plan: "standard", slugTouched: false });
    setShowCreateDialog(true);
  };

  const planBadgeStyle = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-purple-500/15 text-purple-500 border-none";
      case "professional":
        return "bg-blue-500/15 text-blue-500 border-none";
      default:
        return "bg-slate-500/15 text-slate-500 border-none";
    }
  };

  const formFields = (
    <div className="space-y-5 py-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Organization Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => {
            const val = e.target.value;
            setFormData((f) => ({
              ...f,
              name: val,
              slug: showCreateDialog && !f.slugTouched
                ? val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                : f.slug,
            }));
          }}
          placeholder="Acme Corporation"
          className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Slug *</label>
        <Input
          value={formData.slug}
          onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value, slugTouched: true }))}
          placeholder="acme-corporation"
          className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Description</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional description"
          className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Max Users</label>
          <Input
            type="number"
            value={formData.max_users}
            onChange={(e) => setFormData((f) => ({ ...f, max_users: parseInt(e.target.value) || 50 }))}
            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Plan</label>
          <Select value={formData.subscription_plan} onValueChange={(v) => setFormData((f) => ({ ...f, subscription_plan: v }))}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-slate-850 text-white">
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      {view === "list" ? (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <Building2 className="h-8 w-8 text-violet-500" />
                Organization Management
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Create, configure, and manage tenant organizations across the platform.
              </p>
            </div>
            <Button
              onClick={openCreate}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg hover:shadow-purple-500/10 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Organization
            </Button>
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm">
            <div className="relative grow max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-violet-500 ml-2" />}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md overflow-hidden">
            {errorMsg ? (
              <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
                <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-red-600 dark:text-red-400">Failed to load organizations</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{errorMsg}</p>
                  <Button onClick={fetchOrganizations} variant="outline" className="mt-4 border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    Retry Request
                  </Button>
                </div>
              </div>
            ) : loading && organizations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading organizations...</p>
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
                <Building2 className="h-10 w-10 text-slate-400" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No organizations found</h3>
                  <p className="text-sm text-slate-400 max-w-xs">Try resetting your search or create a new organization.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/60">
                  <TableRow className="border-b border-slate-100 dark:border-slate-850">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Organization</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Plan</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Members</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow
                      key={org.id}
                      className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                      onClick={() => openDetail(org)}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                            <AvatarFallback className="bg-gradient-to-tr from-violet-600 to-purple-500 text-white font-bold text-xs">
                              {org.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{org.name}</span>
                            <span className="text-xs text-slate-400 mt-0.5 font-mono">{org.slug}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${planBadgeStyle(org.subscription_plan)} font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider`}>
                          {org.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {org.member_count || 0} / {org.max_users}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(org); }}
                          className="hover:scale-105 transition-transform"
                        >
                          {org.is_active ? (
                            <Badge className="bg-green-500/15 hover:bg-green-500/20 text-green-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500/15 hover:bg-slate-500/20 text-slate-400 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Inactive
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(org)} className="h-8 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-500/10">
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedOrg(org); setShowDeleteDialog(true); }} className="h-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10">
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Deactivate
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Detail view */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setView("list"); setSelectedOrg(null); setMembers([]); }} className="rounded-xl -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                  <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-800">
                    <AvatarFallback className="bg-gradient-to-tr from-violet-600 to-purple-500 text-white font-bold text-[10px]">
                      {selectedOrg?.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {selectedOrg?.name}
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono">{selectedOrg?.slug}</span>
                  <span className="mx-2">·</span>
                  <Badge className={`${planBadgeStyle(selectedOrg?.subscription_plan || "standard")} font-bold py-0 px-1.5 rounded-full text-[10px] uppercase tracking-wider`}>
                    {selectedOrg?.subscription_plan}
                  </Badge>
                  <span className="mx-2">·</span>
                  {members.length} members
                </p>
              </div>
            </div>
            <Button
              onClick={() => { setAddMemberData({ user_id: "", role: "viewer" }); setShowAddMemberDialog(true); }}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg active:scale-95 transition-all"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md overflow-hidden">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
                <Users className="h-10 w-10 text-slate-400" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No members yet</h3>
                  <p className="text-sm text-slate-400 max-w-xs">Add members to this organization to get started.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/60">
                  <TableRow className="border-b border-slate-100 dark:border-slate-850">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Member</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Role</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const initials = (m.user?.full_name || m.user?.email || "?")
                      .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <TableRow key={m.id} className="border-b border-slate-100 dark:border-slate-850">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                              <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{m.user?.full_name || "Unknown"}</span>
                              <span className="text-xs text-slate-400 mt-0.5">{m.user?.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${m.role === "super_admin" ? "bg-amber-500/15 text-amber-500" : m.role === "company_admin" ? "bg-violet-500/15 text-violet-500" : "bg-slate-500/15 text-slate-500"} border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {m.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.is_active ? (
                            <Badge className="bg-green-500/15 text-green-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500/15 text-slate-400 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Building2 className="h-5 w-5 text-violet-500" />
              Create Organization
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Add a new tenant organization to the platform.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !formData.name || !formData.slug} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Edit className="h-5 w-5 text-violet-500" />
              Edit Organization
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Update organization details and configuration.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button variant="ghost" onClick={() => setShowEditDialog(false)} className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Deactivate Organization
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              This will deactivate &quot;{selectedOrg?.name}&quot;. All its users will lose access to their data. This can be undone by reactivating.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)} className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting} className="gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <UserPlus className="h-5 w-5 text-violet-500" />
              Add Member
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Add an existing user to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">User ID</label>
              <Input
                value={addMemberData.user_id}
                onChange={(e) => setAddMemberData((d) => ({ ...d, user_id: e.target.value }))}
                placeholder="Paste user UUID"
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                The user must already have an account in the system.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Role</label>
              <Select value={addMemberData.role} onValueChange={(v) => setAddMemberData((d) => ({ ...d, role: v }))}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-850 text-white">
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="inspector">Inspector</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="company_admin">Company Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button variant="ghost" onClick={() => setShowAddMemberDialog(false)} className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={submitting || !addMemberData.user_id} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
