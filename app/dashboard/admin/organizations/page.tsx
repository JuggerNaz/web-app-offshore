"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Calendar,
  Hash,
  Mail,
  Phone,
  MapPin,
  FileText,
  CheckCircle2,
  Settings,
  Cloud,
  HardDrive,
  Upload,
  Check,
  AlertCircle,
  Eye,
  Lock,
  Layers,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Image from "next/image";

interface Organization {
  id: string;
  name: string;
  slug: string;
  serial_no?: string | null;
  registration_no?: string | null;
  tax_id?: string | null;
  company_email?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
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

interface OrgPropertySettings {
  company_name: string;
  client_short: string;
  department_name: string;
  def_unit: string;
  serial_no: string;
  storage_provider: string;
  storage_config: any;
  logo_url: string | null;
  logo_path: string | null;
}

type View = "list" | "detail";

export default function OrganizationsPage() {
  const { role, companies, isAdmin, hasMinRole } = useUserRole();

  // Role verification: Visible only for Admin users
  const isSuperAdmin = role === "super_admin" || hasMinRole("super_admin");
  const isAnyAdmin = isSuperAdmin || role === "company_admin" || isAdmin || hasMinRole("company_admin");

  const [view, setView] = useState<View>("list");
  const [detailTab, setDetailTab] = useState<string>("overview");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dialog controls
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);

  // Property settings state
  const [propTargetOrg, setPropTargetOrg] = useState<Organization | null>(null);
  const [propSettings, setPropSettings] = useState<OrgPropertySettings | null>(null);
  const [loadingProps, setLoadingProps] = useState(false);
  const [savingProps, setSavingProps] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const initialFormState = {
    name: "",
    slug: "",
    serial_no: "",
    registration_no: "",
    tax_id: "",
    company_email: "",
    contact_person: "",
    contact_phone: "",
    address: "",
    country: "Malaysia",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    description: "",
    max_users: 50,
    subscription_plan: "standard",
    slugTouched: false,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [addMemberData, setAddMemberData] = useState({
    user_id: "",
    role: "viewer",
  });
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Determine if the current authenticated user has full admin/maintenance rights
   * over a specific organization.
   * - Super Admin has rights over ALL organizations.
   * - Company Admin has rights ONLY over organizations where they exist as an active company_admin.
   */
  const isOrgAdmin = useCallback(
    (orgId?: string | null): boolean => {
      if (!orgId) return false;
      if (isSuperAdmin) return true;
      return (companies || []).some(
        (c: any) =>
          c.company_id === orgId &&
          c.is_active !== false &&
          (c.role === "company_admin" || c.role === "super_admin" || c.role === "admin")
      );
    },
    [isSuperAdmin, companies]
  );

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
      const res = await fetch(`/api/admin/organizations/${orgId}/members?available=true`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.members)) {
          setMembers(json.data.members);
          setAvailableProfiles(json.data.available_profiles || []);
        } else if (Array.isArray(json.data)) {
          setMembers(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }, []);

  const fetchPropertySettings = useCallback(async (org: Organization) => {
    setPropTargetOrg(org);
    setLoadingProps(true);
    try {
      const res = await fetch(`/api/company-settings?company_id=${org.id}`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        setPropSettings({
          company_name: d?.company_name || org.name || "Company",
          client_short: d?.client_short || d?.storage_config?.client_short || "",
          department_name: d?.department_name || "Inspection Department",
          def_unit: d?.def_unit || "METRIC",
          serial_no: d?.serial_no || org.serial_no || "",
          storage_provider: d?.storage_provider || "Supabase",
          storage_config: d?.storage_config || {},
          logo_url: d?.logo_url || org.logo_url || null,
          logo_path: d?.logo_path || null,
        });
      } else {
        setPropSettings({
          company_name: org.name,
          client_short: "",
          department_name: "Inspection Department",
          def_unit: "METRIC",
          serial_no: org.serial_no || "",
          storage_provider: "Supabase",
          storage_config: {},
          logo_url: org.logo_url || null,
          logo_path: null,
        });
      }
    } catch (err) {
      console.error("Failed to load property settings:", err);
    } finally {
      setLoadingProps(false);
    }
  }, []);

  useEffect(() => {
    if (isAnyAdmin) {
      fetchOrganizations();
    }
  }, [isAnyAdmin, fetchOrganizations]);

  // Non-admin roles: Completely restricted
  if (!isAnyAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <div className="flex flex-col items-center text-center space-y-3">
          <ShieldAlert className="h-12 w-12 text-slate-400" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Access Restricted</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Only administrator users have permission to access the Organization module.
          </p>
        </div>
      </div>
    );
  }

  type OrgSortColumn = "name" | "serial" | "contact" | "validity" | "plan" | "status";
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<OrgSortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (column: OrgSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: OrgSortColumn) => {
    if (sortColumn !== column) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-30 hover:opacity-100 transition-opacity ml-1.5 shrink-0" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-violet-500 font-bold ml-1.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-violet-500 font-bold ml-1.5 shrink-0" />
    );
  };

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase()) ||
      (org.serial_no || "").toLowerCase().includes(search.toLowerCase()) ||
      (org.company_email || "").toLowerCase().includes(search.toLowerCase()) ||
      (org.contact_person || "").toLowerCase().includes(search.toLowerCase()) ||
      (org.country || "").toLowerCase().includes(search.toLowerCase())
  );

  const sortedOrgs = useMemo(() => {
    const list = [...filteredOrgs];
    return list.sort((a, b) => {
      let result = 0;
      if (sortColumn === "name") {
        result = (a.name || "").localeCompare(b.name || "", undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortColumn === "serial") {
        const serA = a.serial_no || a.registration_no || "";
        const serB = b.serial_no || b.registration_no || "";
        result = serA.localeCompare(serB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortColumn === "contact") {
        const conA = a.contact_person || a.company_email || a.country || "";
        const conB = b.contact_person || b.company_email || b.country || "";
        result = conA.localeCompare(conB, undefined, { sensitivity: "base" });
      } else if (sortColumn === "validity") {
        const dateA = a.start_date
          ? new Date(a.start_date).getTime()
          : a.end_date
          ? new Date(a.end_date).getTime()
          : 0;
        const dateB = b.start_date
          ? new Date(b.start_date).getTime()
          : b.end_date
          ? new Date(b.end_date).getTime()
          : 0;
        result = dateA - dateB;
      } else if (sortColumn === "plan") {
        const planOrder: Record<string, number> = {
          enterprise: 3,
          professional: 2,
          standard: 1,
        };
        const rankA = planOrder[a.subscription_plan?.toLowerCase()] || 0;
        const rankB = planOrder[b.subscription_plan?.toLowerCase()] || 0;
        if (rankA !== rankB) {
          result = rankA - rankB;
        } else {
          result = (a.member_count || 0) - (b.member_count || 0);
        }
      } else if (sortColumn === "status") {
        const statusA = a.is_active ? 1 : 0;
        const statusB = b.is_active ? 1 : 0;
        result = statusA - statusB;
      }
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredOrgs, sortColumn, sortDirection]);

  type MemberSortColumn = "name" | "role" | "status";
  const [memberSortColumn, setMemberSortColumn] = useState<MemberSortColumn>("name");
  const [memberSortDirection, setMemberSortDirection] = useState<SortDirection>("asc");

  const handleMemberSort = (column: MemberSortColumn) => {
    if (memberSortColumn === column) {
      setMemberSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setMemberSortColumn(column);
      setMemberSortDirection("asc");
    }
  };

  const renderMemberSortIcon = (column: MemberSortColumn) => {
    if (memberSortColumn !== column) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-30 hover:opacity-100 transition-opacity ml-1.5 shrink-0" />
      );
    }
    return memberSortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-violet-500 font-bold ml-1.5 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-violet-500 font-bold ml-1.5 shrink-0" />
    );
  };

  const sortedMembers = useMemo(() => {
    const list = [...members];
    return list.sort((a, b) => {
      let result = 0;
      if (memberSortColumn === "name") {
        const nameA = a.user?.full_name || a.user?.email || "";
        const nameB = b.user?.full_name || b.user?.email || "";
        result = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      } else if (memberSortColumn === "role") {
        const roleOrder: Record<string, number> = {
          super_admin: 5,
          company_admin: 4,
          manager: 3,
          inspector: 2,
          viewer: 1,
        };
        const rankA = roleOrder[a.role] || 0;
        const rankB = roleOrder[b.role] || 0;
        result = rankA - rankB;
      } else if (memberSortColumn === "status") {
        const statusA = a.is_active ? 1 : 0;
        const statusB = b.is_active ? 1 : 0;
        result = statusA - statusB;
      }
      return memberSortDirection === "asc" ? result : -result;
    });
  }, [members, memberSortColumn, memberSortDirection]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        start_date: formData.start_date?.trim() ? formData.start_date.trim() : null,
        end_date: formData.end_date?.trim() ? formData.end_date.trim() : null,
      };
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Organization "${json.data?.name || formData.name}" created successfully!`);
        setShowCreateDialog(false);
        setFormData(initialFormState);
        fetchOrganizations();
      } else {
        toast.error(json.error || "Failed to create organization");
        alert(json.error || "Failed to create organization");
      }
    } catch (err: any) {
      console.error("Create error:", err);
      toast.error(err.message || "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedOrg) return;
    if (!isOrgAdmin(selectedOrg.id)) {
      toast.error("You can only modify organizations where you are an active administrator.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        start_date: formData.start_date?.trim() ? formData.start_date.trim() : null,
        end_date: formData.end_date?.trim() ? formData.end_date.trim() : null,
      };
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Organization updated successfully!`);
        setShowEditDialog(false);
        setSelectedOrg((prev) => (prev ? { ...prev, ...payload } : null));
        fetchOrganizations();
      } else {
        toast.error(json.error || "Failed to update organization");
        alert(json.error || "Failed to update organization");
      }
    } catch (err: any) {
      console.error("Edit error:", err);
      toast.error(err.message || "Failed to update organization");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrg) return;
    if (!isOrgAdmin(selectedOrg.id)) {
      toast.error("You can only deactivate organizations where you are an active administrator.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Organization "${selectedOrg.name}" deactivated.`);
        setShowDeleteDialog(false);
        setSelectedOrg(null);
        fetchOrganizations();
      } else {
        toast.error(json.error || "Failed to deactivate organization");
        alert(json.error || "Failed to deactivate organization");
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to deactivate organization");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    if (!isOrgAdmin(org.id)) {
      toast.error("Permission denied: You can only change status for organizations you administer.");
      return;
    }

    try {
      const newStatus = !org.is_active;
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        toast.success(`Organization "${org.name}" is now ${newStatus ? "Active" : "Inactive"}`);
        fetchOrganizations();
        if (selectedOrg?.id === org.id) {
          setSelectedOrg({ ...selectedOrg, is_active: newStatus });
        }
      } else {
        toast.error(json.error || "Failed to update organization status");
      }
    } catch (err: any) {
      console.error("Toggle error:", err);
      toast.error(err.message || "Failed to update organization status");
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrg) return;
    if (!isOrgAdmin(selectedOrg.id)) {
      toast.error("You can only add members in organizations where you are an active administrator.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberData),
      });
      if (res.ok) {
        toast.success("Member added to organization!");
        setShowAddMemberDialog(false);
        setAddMemberData({ user_id: "", role: "viewer" });
        fetchMembers(selectedOrg.id);
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to add member");
        alert(json.error || "Failed to add member");
      }
    } catch (err) {
      console.error("Add member error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncAllUsers = async () => {
    if (!selectedOrg) return;
    if (!isOrgAdmin(selectedOrg.id)) {
      toast.error("Permission denied: Super Admin or Organization Admin rights required.");
      return;
    }

    if (!confirm(`Are you sure you want to assign all existing database users to "${selectedOrg.name}"?`)) {
      return;
    }
    setSyncingUsers(true);
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_all: true }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.data?.message || "All users assigned successfully!");
        fetchMembers(selectedOrg.id);
        fetchOrganizations();
      } else {
        toast.error(json.error || "Failed to sync users");
        alert(json.error || "Failed to sync users");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Failed to sync users");
    } finally {
      setSyncingUsers(false);
    }
  };

  const handleSavePropertySettings = async () => {
    if (!propTargetOrg || !propSettings) return;
    if (!isOrgAdmin(propTargetOrg.id)) {
      toast.error("Read-Only: You can only modify property settings for organizations you administer.");
      return;
    }

    setSavingProps(true);
    try {
      const res = await fetch(`/api/company-settings?company_id=${propTargetOrg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: propSettings.company_name,
          client_short: propSettings.client_short,
          department_name: propSettings.department_name,
          def_unit: propSettings.def_unit,
          storage_provider: propSettings.storage_provider,
          storage_config: propSettings.storage_config,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Property settings for "${propTargetOrg.name}" saved successfully!`);
        window.dispatchEvent(new Event("companySettingsChanged"));
        fetchOrganizations();
        if (selectedOrg?.id === propTargetOrg.id) {
          setSelectedOrg((prev) => (prev ? { ...prev, name: propSettings.company_name } : null));
        }
      } else {
        toast.error(json.error || "Failed to save property settings");
        alert(json.error || "Failed to save property settings");
      }
    } catch (err: any) {
      console.error("Save property settings error:", err);
      toast.error(err.message || "Failed to save property settings");
    } finally {
      setSavingProps(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!propTargetOrg || !e.target.files?.[0]) return;
    if (!isOrgAdmin(propTargetOrg.id)) {
      toast.error("Permission denied: You cannot modify the logo of this organization.");
      return;
    }

    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP, SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/company-settings/logo?company_id=${propTargetOrg.id}`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (res.ok && json.data) {
        toast.success("Organization logo updated successfully!");
        setPropSettings((prev) =>
          prev
            ? {
                ...prev,
                logo_url: json.data.logo_url,
                logo_path: json.data.logo_path,
              }
            : null
        );
        window.dispatchEvent(new Event("companySettingsChanged"));
        fetchOrganizations();
      } else {
        toast.error(json.error || "Failed to upload logo");
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!propTargetOrg) return;
    if (!isOrgAdmin(propTargetOrg.id)) {
      toast.error("Permission denied: You cannot remove the logo of this organization.");
      return;
    }

    if (!confirm("Are you sure you want to remove the logo for this organization?")) return;
    setUploadingLogo(true);
    try {
      const res = await fetch(`/api/company-settings/logo?company_id=${propTargetOrg.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Organization logo removed.");
        setPropSettings((prev) =>
          prev ? { ...prev, logo_url: null, logo_path: null } : null
        );
        window.dispatchEvent(new Event("companySettingsChanged"));
        fetchOrganizations();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to remove logo");
      }
    } catch (err: any) {
      toast.error(err.message || "Remove logo failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const openDetail = (org: Organization) => {
    setSelectedOrg(org);
    setView("detail");
    setDetailTab("overview");
    fetchMembers(org.id);
    fetchPropertySettings(org);
  };

  const openEdit = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      name: org.name || "",
      slug: org.slug || "",
      serial_no: org.serial_no || "",
      registration_no: org.registration_no || "",
      tax_id: org.tax_id || "",
      company_email: org.company_email || "",
      contact_person: org.contact_person || "",
      contact_phone: org.contact_phone || "",
      address: org.address || "",
      country: org.country || "Malaysia",
      start_date: org.start_date ? org.start_date.split("T")[0] : "",
      end_date: org.end_date ? org.end_date.split("T")[0] : "",
      description: org.description || "",
      max_users: org.max_users || 50,
      subscription_plan: org.subscription_plan || "standard",
      slugTouched: true,
    });
    setShowEditDialog(true);
  };

  const openCreate = () => {
    const defaultSerial = `ORG-${new Date().getFullYear()}-${String(
      organizations.length + 1
    ).padStart(3, "0")}`;
    setFormData({
      ...initialFormState,
      serial_no: defaultSerial,
    });
    setShowCreateDialog(true);
  };

  const openDirectPropertyDialog = (org: Organization) => {
    fetchPropertySettings(org);
    setShowPropertyDialog(true);
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
    <Tabs defaultValue="identity" className="w-full">
      <TabsList className="grid grid-cols-3 w-full bg-slate-100 dark:bg-slate-900 rounded-xl p-1 mb-4">
        <TabsTrigger
          value="identity"
          className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
        >
          <Hash className="h-3.5 w-3.5" /> Identity & Serial
        </TabsTrigger>
        <TabsTrigger
          value="contact"
          className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
        >
          <Building2 className="h-3.5 w-3.5" /> Company Details
        </TabsTrigger>
        <TabsTrigger
          value="contract"
          className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"
        >
          <Calendar className="h-3.5 w-3.5" /> Plan & Validity
        </TabsTrigger>
      </TabsList>

      {/* TAB 1: IDENTITY */}
      <TabsContent value="identity" className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Organization Name *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => {
              const val = e.target.value;
              setFormData((f) => ({
                ...f,
                name: val,
                slug:
                  showCreateDialog && !f.slugTouched
                    ? val
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    : f.slug,
              }));
            }}
            placeholder="e.g. Petronas Carigali Sdn Bhd"
            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Slug (URL Key) *
            </label>
            <Input
              value={formData.slug}
              onChange={(e) =>
                setFormData((f) => ({ ...f, slug: e.target.value, slugTouched: true }))
              }
              placeholder="e.g. petronas-carigali"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Serial / License No.
            </label>
            <Input
              value={formData.serial_no}
              onChange={(e) => setFormData((f) => ({ ...f, serial_no: e.target.value }))}
              placeholder="e.g. ORG-2026-001"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono text-xs font-bold text-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registration / SSM No.
            </label>
            <Input
              value={formData.registration_no}
              onChange={(e) =>
                setFormData((f) => ({ ...f, registration_no: e.target.value }))
              }
              placeholder="e.g. 199201012345 (246800-X)"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax ID / SST
            </label>
            <Input
              value={formData.tax_id}
              onChange={(e) => setFormData((f) => ({ ...f, tax_id: e.target.value }))}
              placeholder="e.g. W10-1808-32000000"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Description / Scope
          </label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief operator summary or field operational zone"
            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
          />
        </div>
      </TabsContent>

      {/* TAB 2: CONTACT & LOCATION */}
      <TabsContent value="contact" className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Contact Person
            </label>
            <Input
              value={formData.contact_person}
              onChange={(e) =>
                setFormData((f) => ({ ...f, contact_person: e.target.value }))
              }
              placeholder="e.g. Mohd Nor / Lead Engineer"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Official Email
            </label>
            <Input
              type="email"
              value={formData.company_email}
              onChange={(e) =>
                setFormData((f) => ({ ...f, company_email: e.target.value }))
              }
              placeholder="e.g. contact@carigali.com"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phone Number
            </label>
            <Input
              value={formData.contact_phone}
              onChange={(e) =>
                setFormData((f) => ({ ...f, contact_phone: e.target.value }))
              }
              placeholder="e.g. +60 3-2331 5000"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Country
            </label>
            <Input
              value={formData.country}
              onChange={(e) => setFormData((f) => ({ ...f, country: e.target.value }))}
              placeholder="e.g. Malaysia"
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Registered Office Address
          </label>
          <Input
            value={formData.address}
            onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
            placeholder="e.g. Level 18, Tower 1, PETRONAS Twin Towers, KLCC"
            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
          />
        </div>
      </TabsContent>

      {/* TAB 3: CONTRACT & PLAN */}
      <TabsContent value="contract" className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Start Date
            </label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData((f) => ({ ...f, start_date: e.target.value }))}
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              End / Renewal Date
            </label>
            <Input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Max User Seats
            </label>
            <Input
              type="number"
              value={formData.max_users}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  max_users: parseInt(e.target.value) || 50,
                }))
              }
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Subscription Plan
            </label>
            <Select
              value={formData.subscription_plan}
              onValueChange={(v) =>
                setFormData((f) => ({ ...f, subscription_plan: v }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-850 text-white">
                <SelectItem value="standard">Standard Plan</SelectItem>
                <SelectItem value="professional">Professional Plan</SelectItem>
                <SelectItem value="enterprise">Enterprise Tier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  /**
   * Property Settings Content Builder
   * Allows editing for Super Admins and the organization's active admin,
   * while rendering in clean read-only mode for other admins.
   */
  const renderPropertySettingsContent = (org: Organization | null) => {
    if (!org) return null;
    const canManageThisOrg = isOrgAdmin(org.id);

    if (loadingProps) {
      return (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading organization properties...
          </p>
        </div>
      );
    }

    if (!propSettings) return null;

    return (
      <div className="space-y-6">
        {!canManageThisOrg && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs font-medium text-amber-800 dark:text-amber-300">
              <strong>View-Only Mode:</strong> You are viewing details of another organization. Only its designated organization administrators or Super Admins can alter property and storage configurations.
            </AlertDescription>
          </Alert>
        )}

        {/* Section 1: Branding & Report Parameters */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-violet-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Company Branding & Report Settings
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {org.slug}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                Company Name (Client Full Name)
              </Label>
              <Input
                value={propSettings.company_name}
                disabled={!canManageThisOrg}
                onChange={(e) =>
                  setPropSettings((p) => p && { ...p, company_name: e.target.value })
                }
                placeholder="e.g. Petronas Carigali Sdn Bhd"
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Used in official report headers, work packs, and exported documents.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                Client Short Code (Template Abbreviation)
              </Label>
              <Input
                value={propSettings.client_short}
                disabled={!canManageThisOrg}
                onChange={(e) =>
                  setPropSettings((p) => p && { ...p, client_short: e.target.value.toUpperCase() })
                }
                placeholder="e.g. PCSB, CPOC, CARIGALI"
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-xs font-bold"
              />
              <p className="text-[10px] text-slate-400">
                Maps to {"{T_CLIENT}"} and {"{CLIENT_SHORT}"} doc tags.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                Department Name
              </Label>
              <Input
                value={propSettings.department_name}
                disabled={!canManageThisOrg}
                onChange={(e) =>
                  setPropSettings((p) => p && { ...p, department_name: e.target.value })
                }
                placeholder="e.g. Inspection Department"
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">
                Default Measurement Unit
              </Label>
              <Select
                value={propSettings.def_unit}
                disabled={!canManageThisOrg}
                onValueChange={(v) =>
                  setPropSettings((p) => p && { ...p, def_unit: v })
                }
              >
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-850 text-white">
                  <SelectItem value="METRIC">Metric (m, mm, kg, °C)</SelectItem>
                  <SelectItem value="IMPERIAL">Imperial (ft, in, lb, °F)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logo Management */}
          <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase">
              Organization Logo
            </Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-16 w-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden p-1">
                {propSettings.logo_url ? (
                  <Image
                    src={propSettings.logo_url}
                    alt="Logo"
                    width={64}
                    height={64}
                    className="object-contain w-full h-full"
                    unoptimized
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-slate-400" />
                )}
              </div>
              {canManageThisOrg ? (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`logo-upload-${org.id}`}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload Logo
                  </Label>
                  <input
                    id={`logo-upload-${org.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                  {propSettings.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleLogoRemove}
                      disabled={uploadingLogo}
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  {propSettings.logo_url ? "Logo is configured" : "No logo uploaded"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Storage Infrastructure Configuration */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Storage Provider & Credentials
              </h3>
            </div>
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold text-[10px]">
              {propSettings.storage_provider}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase">
              Storage Provider Infrastructure
            </Label>
            <Select
              value={propSettings.storage_provider}
              disabled={!canManageThisOrg}
              onValueChange={(v) =>
                setPropSettings((p) => p && { ...p, storage_provider: v })
              }
            >
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-850 text-white">
                <SelectItem value="Supabase">Managed Supabase Storage (Default)</SelectItem>
                <SelectItem value="AWS S3">Amazon Web Services (AWS S3)</SelectItem>
                <SelectItem value="Backblaze">Backblaze B2 Cloud Storage</SelectItem>
                <SelectItem value="Google Drive">Google Drive (Local / API)</SelectItem>
                <SelectItem value="Local Drive">Local Network Drive (Shared SAN / NAS)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-400">
              Attachments, inspection media, and reports will be uploaded and accessed via this provider.
            </p>
          </div>

          {/* S3 or Backblaze B2 Settings */}
          {(propSettings.storage_provider === "AWS S3" || propSettings.storage_provider === "Backblaze") && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    Bucket Name
                  </Label>
                  <Input
                    value={propSettings.storage_config?.bucket || ""}
                    disabled={!canManageThisOrg}
                    onChange={(e) =>
                      setPropSettings((p) =>
                        p
                          ? {
                              ...p,
                              storage_config: { ...p.storage_config, bucket: e.target.value },
                            }
                          : null
                      )
                    }
                    placeholder="e.g. web-app-offshore-prod"
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    Region
                  </Label>
                  <Input
                    value={propSettings.storage_config?.region || ""}
                    disabled={!canManageThisOrg}
                    onChange={(e) =>
                      setPropSettings((p) =>
                        p
                          ? {
                              ...p,
                              storage_config: { ...p.storage_config, region: e.target.value },
                            }
                          : null
                      )
                    }
                    placeholder="e.g. ap-southeast-1 or us-east-005"
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    {propSettings.storage_provider === "Backblaze" ? "Key ID" : "Access Key ID"}
                  </Label>
                  <Input
                    value={propSettings.storage_config?.accessKeyId || propSettings.storage_config?.keyId || ""}
                    disabled={!canManageThisOrg}
                    onChange={(e) =>
                      setPropSettings((p) =>
                        p
                          ? {
                              ...p,
                              storage_config: {
                                ...p.storage_config,
                                accessKeyId: e.target.value,
                                keyId: e.target.value,
                              },
                            }
                          : null
                      )
                    }
                    placeholder="Enter access key ID..."
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">
                    {propSettings.storage_provider === "Backblaze" ? "Application Key" : "Secret Access Key"}
                  </Label>
                  <Input
                    type="password"
                    value={propSettings.storage_config?.secretAccessKey || propSettings.storage_config?.applicationKey || ""}
                    disabled={!canManageThisOrg}
                    onChange={(e) =>
                      setPropSettings((p) =>
                        p
                          ? {
                              ...p,
                              storage_config: {
                                ...p.storage_config,
                                secretAccessKey: e.target.value,
                                applicationKey: e.target.value,
                              },
                            }
                          : null
                      )
                    }
                    placeholder="Enter secret key (leave as ******** to preserve)"
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  Custom Endpoint URL (Optional)
                </Label>
                <Input
                  value={propSettings.storage_config?.endpoint || ""}
                  disabled={!canManageThisOrg}
                  onChange={(e) =>
                    setPropSettings((p) =>
                      p
                        ? {
                            ...p,
                            storage_config: { ...p.storage_config, endpoint: e.target.value },
                          }
                        : null
                    )
                  }
                  placeholder="e.g. https://s3.us-east-005.backblazeb2.com"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Google Drive Settings */}
          {propSettings.storage_provider === "Google Drive" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  Google Drive Folder ID
                </Label>
                <Input
                  value={propSettings.storage_config?.googleDriveFolderId || ""}
                  disabled={!canManageThisOrg}
                  onChange={(e) =>
                    setPropSettings((p) =>
                      p
                        ? {
                            ...p,
                            storage_config: {
                              ...p.storage_config,
                              googleDriveFolderId: e.target.value,
                            },
                          }
                        : null
                    )
                  }
                  placeholder="e.g. 1a2B3c4D5e6F7g8H9i0J"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  Service Account JSON / Credentials
                </Label>
                <Textarea
                  value={
                    typeof propSettings.storage_config?.serviceAccount === "object"
                      ? JSON.stringify(propSettings.storage_config.serviceAccount, null, 2)
                      : propSettings.storage_config?.serviceAccount || ""
                  }
                  disabled={!canManageThisOrg}
                  onChange={(e) =>
                    setPropSettings((p) =>
                      p
                        ? {
                            ...p,
                            storage_config: {
                              ...p.storage_config,
                              serviceAccount: e.target.value,
                            },
                          }
                        : null
                    )
                  }
                  placeholder="Paste Google Service Account JSON..."
                  className="min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Local Drive Settings */}
          {propSettings.storage_provider === "Local Drive" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  Local Network / Base Storage Directory
                </Label>
                <Input
                  value={propSettings.storage_config?.basePath || ""}
                  disabled={!canManageThisOrg}
                  onChange={(e) =>
                    setPropSettings((p) =>
                      p
                        ? {
                            ...p,
                            storage_config: {
                              ...p.storage_config,
                              basePath: e.target.value,
                            },
                          }
                        : null
                    )
                  }
                  placeholder="e.g. C:\OffshoreAttachments or Y:\ATTACH"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Local filesystem path on the host server where files are stored and indexed.
                </p>
              </div>
            </div>
          )}

          {/* Managed Supabase Info */}
          {propSettings.storage_provider === "Supabase" && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                Using built-in secure Supabase multi-tenant storage buckets (&quot;attachments&quot; &amp; &quot;inspection-media&quot;) with automated backups.
              </span>
            </div>
          )}
        </div>

        {/* Action Button: Only visible/enabled when authorized */}
        {canManageThisOrg && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSavePropertySettings}
              disabled={savingProps}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 font-semibold shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all gap-2"
            >
              {savingProps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Property Settings
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      {view === "list" ? (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <Building2 className="h-8 w-8 text-violet-500" />
                Organization &amp; Tenant Module
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Maintain tenant organizations, license serials, contract validities, and dedicated property configurations.
              </p>
            </div>
            {isAnyAdmin && (
              <Button
                onClick={openCreate}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg hover:shadow-purple-500/10 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Organization
              </Button>
            )}
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm">
            <div className="relative grow max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, serial no, country, email..."
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
                  <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                    Failed to load organizations
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{errorMsg}</p>
                  <Button
                    onClick={fetchOrganizations}
                    variant="outline"
                    className="mt-4 border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Retry Request
                  </Button>
                </div>
              </div>
            ) : loading && organizations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  Loading organizations...
                </p>
              </div>
            ) : sortedOrgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
                <Building2 className="h-10 w-10 text-slate-400" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    No organizations found
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Try resetting your search or create a new organization.
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/60 select-none">
                  <TableRow className="border-b border-slate-100 dark:border-slate-850">
                    <TableHead
                      onClick={() => handleSort("name")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Organization Name"
                    >
                      <div className="flex items-center">
                        <span>Organization</span>
                        {renderSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("serial")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Serial / Registration No."
                    >
                      <div className="flex items-center">
                        <span>Serial / Reg No.</span>
                        {renderSortIcon("serial")}
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("contact")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Contact / Location"
                    >
                      <div className="flex items-center">
                        <span>Contact / Location</span>
                        {renderSortIcon("contact")}
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("validity")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Contract Validity Date"
                    >
                      <div className="flex items-center">
                        <span>Validity / Dates</span>
                        {renderSortIcon("validity")}
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("plan")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Subscription Plan & Seats"
                    >
                      <div className="flex items-center">
                        <span>Plan &amp; Seats</span>
                        {renderSortIcon("plan")}
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("status")}
                      className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                      title="Sort by Active / Inactive Status"
                    >
                      <div className="flex items-center">
                        <span>Status</span>
                        {renderSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrgs.map((org) => {
                    const canManage = isOrgAdmin(org.id);
                    return (
                      <TableRow
                        key={org.id}
                        className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                        onClick={() => openDetail(org)}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                              {org.logo_url && (
                                <AvatarImage src={org.logo_url} alt={org.name} className="object-contain" />
                              )}
                              <AvatarFallback className="bg-gradient-to-tr from-violet-600 to-purple-500 text-white font-bold text-xs">
                                {org.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {org.name}
                                </span>
                                {canManage ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-bold py-0 px-1.5 rounded-full text-[9px] uppercase tracking-wider">
                                    Admin Access
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-slate-800 font-normal py-0 px-1.5 rounded-full text-[9px] uppercase tracking-wider">
                                    View Only
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 mt-0.5 font-mono">{org.slug}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-black text-amber-500 dark:text-amber-400">
                              {org.serial_no || "—"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {org.registration_no || "No Reg No"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {org.contact_person || org.company_email || "—"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {org.country || "Malaysia"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {org.start_date ? new Date(org.start_date).toLocaleDateString() : "—"}
                            </span>
                            {org.end_date && (
                              <span className="text-[10px] text-slate-400">
                                Exp: {new Date(org.end_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              className={`${planBadgeStyle(
                                org.subscription_plan
                              )} font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider w-max`}
                            >
                              {org.subscription_plan}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {org.member_count || 0} / {org.max_users} seats
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManage) handleToggleActive(org);
                            }}
                            disabled={!canManage}
                            className={canManage ? "hover:scale-105 transition-transform" : "cursor-default opacity-80"}
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
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDirectPropertyDialog(org)}
                              className="h-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                              title="Organization Property Settings"
                            >
                              <Settings className="h-3.5 w-3.5 mr-1" />
                              Properties
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEdit(org)}
                                  className="h-8 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-500/10"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedOrg(org);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="h-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Deactivate
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Detail View */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView("list");
                  setSelectedOrg(null);
                  setMembers([]);
                }}
                className="rounded-xl -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-800">
                    {selectedOrg?.logo_url && (
                      <AvatarImage src={selectedOrg.logo_url} alt={selectedOrg.name} className="object-contain" />
                    )}
                    <AvatarFallback className="bg-gradient-to-tr from-violet-600 to-purple-500 text-white font-bold text-xs">
                      {selectedOrg?.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {selectedOrg?.name}
                </h1>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{selectedOrg?.slug}</span>
                  <span>·</span>
                  <span className="font-mono font-bold text-amber-500 text-xs">
                    {selectedOrg?.serial_no || "No Serial"}
                  </span>
                  <span>·</span>
                  <Badge
                    className={`${planBadgeStyle(
                      selectedOrg?.subscription_plan || "standard"
                    )} font-bold py-0 px-1.5 rounded-full text-[10px] uppercase tracking-wider`}
                  >
                    {selectedOrg?.subscription_plan}
                  </Badge>
                  <span>·</span>
                  <span>{members.length} members</span>
                  <span>·</span>
                  {isOrgAdmin(selectedOrg?.id) ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-bold py-0 px-2 rounded-full text-[10px] uppercase">
                      Admin Access
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 font-normal py-0 px-2 rounded-full text-[10px] uppercase">
                      View Only
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons in Detail */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => selectedOrg && openDirectPropertyDialog(selectedOrg)}
                className="rounded-xl border-slate-200 dark:border-slate-800 gap-2 text-blue-600 hover:text-blue-700"
              >
                <Settings className="h-4 w-4" />
                Property Settings
              </Button>
              {isOrgAdmin(selectedOrg?.id) && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => selectedOrg && openEdit(selectedOrg)}
                    className="rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSyncAllUsers}
                    disabled={syncingUsers}
                    className="rounded-xl border-slate-200 dark:border-slate-800 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-semibold"
                    title="Assign all existing database users to this tenant"
                  >
                    {syncingUsers ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-2" />
                    )}
                    Sync All Users
                  </Button>
                  <Button
                    onClick={() => {
                      setAddMemberData({ user_id: "", role: "viewer" });
                      setShowAddMemberDialog(true);
                    }}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg active:scale-95 transition-all"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Detail Tabs */}
          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <TabsList className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-1 mb-6">
              <TabsTrigger
                value="overview"
                className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 px-4"
              >
                <Building2 className="h-4 w-4" /> Overview &amp; Identity
              </TabsTrigger>
              <TabsTrigger
                value="properties"
                className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 px-4"
              >
                <Settings className="h-4 w-4" /> Property &amp; Storage Settings
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 px-4"
              >
                <Users className="h-4 w-4" /> Members &amp; Access ({members.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6">
              {/* Org Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    License Serial
                  </span>
                  <p className="text-base font-black text-amber-500 font-mono">
                    {selectedOrg?.serial_no || "N/A"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Reg: {selectedOrg?.registration_no || "—"}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Contract Validity
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {selectedOrg?.start_date
                      ? new Date(selectedOrg.start_date).toLocaleDateString()
                      : "Active"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedOrg?.end_date
                      ? `Expires: ${new Date(selectedOrg.end_date).toLocaleDateString()}`
                      : "Continuous"}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Contact Person
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {selectedOrg?.contact_person || "—"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {selectedOrg?.company_email || "No email"}
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Headquarters
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {selectedOrg?.country || "Malaysia"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {selectedOrg?.address || "—"}
                  </p>
                </div>
              </div>

              {/* Scope & Detailed Attributes */}
              <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-850 pb-3">
                  Scope &amp; Identity Attributes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-400 uppercase">Description:</span>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">
                      {selectedOrg?.description || "No description provided."}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase">Tax / SST ID:</span>
                    <p className="mt-1 font-mono text-slate-700 dark:text-slate-300">
                      {selectedOrg?.tax_id || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase">Contact Phone:</span>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">
                      {selectedOrg?.contact_phone || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase">Max User Allocation:</span>
                    <p className="mt-1 font-bold text-slate-700 dark:text-slate-300">
                      {selectedOrg?.max_users} seats
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: PROPERTY SETTINGS */}
            <TabsContent value="properties" className="space-y-6">
              {renderPropertySettingsContent(selectedOrg)}
            </TabsContent>

            {/* TAB 3: MEMBERS */}
            <TabsContent value="members" className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md overflow-hidden">
                {members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
                    <div className="h-16 w-16 rounded-3xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        No members assigned to {selectedOrg?.name}
                      </h3>
                      <p className="text-sm text-slate-400 max-w-md">
                        Connect existing system users to this tenant organization or add them individually.
                      </p>
                    </div>
                    {isOrgAdmin(selectedOrg?.id) && (
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSyncAllUsers}
                          disabled={syncingUsers}
                          className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-md gap-2"
                        >
                          {syncingUsers ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                          Assign All Existing Users
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAddMemberData({ user_id: "", role: "viewer" });
                            setShowAddMemberDialog(true);
                          }}
                          className="rounded-xl border-slate-200 dark:border-slate-800 gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          Add Single Member
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950/60 select-none">
                      <TableRow className="border-b border-slate-100 dark:border-slate-850">
                        <TableHead
                          onClick={() => handleMemberSort("name")}
                          className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                          title="Sort by Member Name"
                        >
                          <div className="flex items-center">
                            <span>Member</span>
                            {renderMemberSortIcon("name")}
                          </div>
                        </TableHead>
                        <TableHead
                          onClick={() => handleMemberSort("role")}
                          className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                          title="Sort by Assigned Role"
                        >
                          <div className="flex items-center">
                            <span>Role</span>
                            {renderMemberSortIcon("role")}
                          </div>
                        </TableHead>
                        <TableHead
                          onClick={() => handleMemberSort("status")}
                          className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
                          title="Sort by Member Status"
                        >
                          <div className="flex items-center">
                            <span>Status</span>
                            {renderMemberSortIcon("status")}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedMembers.map((m) => {
                        const initials = (m.user?.full_name || m.user?.email || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <TableRow
                            key={m.id}
                            className="border-b border-slate-100 dark:border-slate-850"
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                                  <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 dark:text-slate-100">
                                    {m.user?.full_name || "Unknown"}
                                  </span>
                                  <span className="text-xs text-slate-400 mt-0.5">
                                    {m.user?.email}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  m.role === "super_admin"
                                    ? "bg-amber-500/15 text-amber-500"
                                    : m.role === "company_admin"
                                    ? "bg-violet-500/15 text-violet-500"
                                    : "bg-slate-500/15 text-slate-500"
                                } border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider`}
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
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Building2 className="h-5 w-5 text-violet-500" />
              Create Tenant Organization
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Register a new tenant company with license serial, contact, and contract details.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !formData.name || !formData.slug}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Edit className="h-5 w-5 text-violet-500" />
              Edit Organization Details
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Update organization profile, serial, contact, and subscription configuration.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowEditDialog(false)}
              className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Settings Modal Dialog (From table direct button) */}
      <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Settings className="h-5 w-5 text-blue-500" />
              Property &amp; Storage Settings: {propTargetOrg?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Configure branding, default units, and storage infrastructure for this tenant.
            </DialogDescription>
          </DialogHeader>

          {renderPropertySettingsContent(propTargetOrg)}

          <DialogFooter className="border-t border-slate-100 dark:border-slate-850 pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowPropertyDialog(false)}
              className="rounded-xl"
            >
              Close
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
              This will deactivate &quot;{selectedOrg?.name}&quot;. All its users will lose access to their tenant data until reactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              className="gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all"
            >
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
              Assign an existing system user to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Select User
              </label>
              {availableProfiles && availableProfiles.length > 0 ? (
                <Select
                  value={addMemberData.user_id}
                  onValueChange={(v) => setAddMemberData((d) => ({ ...d, user_id: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Select user from system profiles..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-850 text-white max-h-60">
                    {availableProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={addMemberData.user_id}
                  onChange={(e) => setAddMemberData((d) => ({ ...d, user_id: e.target.value }))}
                  placeholder="Paste user UUID"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-sm"
                />
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                Choose a registered user to grant membership and access to this organization.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Role
              </label>
              <Select
                value={addMemberData.role}
                onValueChange={(v) => setAddMemberData((d) => ({ ...d, role: v }))}
              >
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
            <Button
              variant="ghost"
              onClick={() => setShowAddMemberDialog(false)}
              className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={submitting || !addMemberData.user_id}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg active:scale-95 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
