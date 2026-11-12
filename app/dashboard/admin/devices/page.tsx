"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useUserRole } from "@/utils/hooks/use-user-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Laptop, 
  Plus, 
  Trash2, 
  Loader2, 
  ShieldAlert, 
  ToggleLeft, 
  ToggleRight,
  Clipboard,
  Check,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DeviceRegistryPage() {
  const { profile: currentProfile, activeCompanyId, role } = useUserRole();
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Show new token dialog state
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Search and Sort State
  type SortKey = "device_name" | "registrar" | "created_at" | "status";
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);

  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400/50 group-hover:text-amber-500 transition-colors shrink-0 ml-1" />
      );
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 font-bold shrink-0 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 font-bold shrink-0 ml-1" />
    );
  };

  const filteredAndSortedDevices = useMemo(() => {
    let result = [...devices];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((device) => {
        const name = (device.device_name || "").toLowerCase();
        const registrarName = (device.registrar?.full_name || "").toLowerCase();
        const registrarEmail = (device.registrar?.email || "").toLowerCase();
        const statusText = device.is_active ? "authorized active" : "revoked inactive";
        const dateStr = device.created_at
          ? new Date(device.created_at)
              .toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              .toLowerCase()
          : "";

        return (
          name.includes(q) ||
          registrarName.includes(q) ||
          registrarEmail.includes(q) ||
          statusText.includes(q) ||
          dateStr.includes(q)
        );
      });
    }

    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let comp = 0;
        if (key === "device_name") {
          const aName = (a.device_name || "").toLowerCase();
          const bName = (b.device_name || "").toLowerCase();
          comp = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: "base" });
        } else if (key === "registrar") {
          const aReg = (a.registrar?.full_name || a.registrar?.email || "Unknown").toLowerCase();
          const bReg = (b.registrar?.full_name || b.registrar?.email || "Unknown").toLowerCase();
          comp = aReg.localeCompare(bReg, undefined, { numeric: true, sensitivity: "base" });
        } else if (key === "created_at") {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          comp = timeA - timeB;
        } else if (key === "status") {
          const statusA = a.is_active ? 1 : 0;
          const statusB = b.is_active ? 1 : 0;
          comp = statusA - statusB;
        }
        return direction === "asc" ? comp : -comp;
      });
    }

    return result;
  }, [devices, searchQuery, sortConfig]);

  const isAdmin = role === "super_admin" || role === "company_admin";

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch("/api/admin/devices", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setDevices(json.data || []);
        } else {
          setErrorMsg(json.error || "Failed to load registered devices.");
        }
      } else {
        const json = await res.json();
        setErrorMsg(json.error || "Error loading device registry.");
      }
    } catch (err: any) {
      console.error("[DeviceRegistry] Error loading devices:", err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCompanyId) {
      fetchDevices();
    }
  }, [activeCompanyId]);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    try {
      setRegistering(true);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers,
        body: JSON.stringify({ device_name: deviceName }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const registeredDevice = json.data;
          
          // Set the device_token cookie locally on this browser
          const maxAge = 60 * 60 * 24 * 365; // 1 year
          document.cookie = `device_token=${registeredDevice.device_token}; path=/; max-age=${maxAge}; Secure; SameSite=Strict`;

          // Add to device list with registrar context
          const deviceWithRegistrar = {
            ...registeredDevice,
            registrar: {
              full_name: currentProfile?.full_name || "You",
              email: currentProfile?.email || ""
            }
          };
          setDevices((prev) => [deviceWithRegistrar, ...prev]);
          setNewToken(registeredDevice.device_token);
          setDeviceName("");
          setRegisterDialogOpen(false);
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to register device.");
      }
    } catch (err) {
      console.error("[DeviceRegistry] Registration failed:", err);
    } finally {
      setRegistering(false);
    }
  };

  const handleToggleStatus = async (deviceId: string, currentStatus: boolean) => {
    try {
      setActionInProgress(deviceId);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setDevices((prev) =>
            prev.map((d) => (d.id === deviceId ? { ...d, is_active: !currentStatus } : d))
          );
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update device status.");
      }
    } catch (err) {
      console.error("[DeviceRegistry] Error toggling status:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke and delete this device? This action cannot be undone.")) return;

    try {
      setActionInProgress(deviceId);
      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } else {
        const json = await res.json();
        alert(json.error || "Failed to revoke device.");
      }
    } catch (err) {
      console.error("[DeviceRegistry] Revocation failed:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const copyToClipboard = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          You must be an administrator to manage registered hardware devices for this organization.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Laptop className="h-8 w-8 text-amber-500" />
            Device Registry
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Authorize new hardware devices and review existing registrations for this organization.
          </p>
        </div>
        <Button
          onClick={() => setRegisterDialogOpen(true)}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg hover:shadow-amber-500/10 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          Register This Device
        </Button>
      </div>

      {/* Search & Sort Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by device name, registrar, status..."
            className="pl-9 pr-8 h-10 w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-amber-500 rounded-xl font-medium text-sm text-slate-900 dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={sortConfig?.key || "default"}
            onValueChange={(val) => {
              if (val === "default") {
                setSortConfig(null);
              } else {
                setSortConfig((prev) => ({
                  key: val as SortKey,
                  direction: prev?.key === val ? prev.direction : "asc",
                }));
              }
            }}
          >
            <SelectTrigger className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl shadow-sm gap-2 min-w-[170px] text-slate-700 dark:text-slate-300">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <SelectValue placeholder="Sort by column..." />
            </SelectTrigger>
            <SelectContent align="end" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectItem value="default" className="text-xs font-medium">Default Order</SelectItem>
              <SelectItem value="device_name" className="text-xs font-medium">Device Name</SelectItem>
              <SelectItem value="registrar" className="text-xs font-medium">Registrar</SelectItem>
              <SelectItem value="created_at" className="text-xs font-medium">Enrolled Date</SelectItem>
              <SelectItem value="status" className="text-xs font-medium">Status</SelectItem>
            </SelectContent>
          </Select>

          {sortConfig && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setSortConfig((prev) =>
                  prev
                    ? { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
                    : null
                )
              }
              className="h-10 w-10 shrink-0 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl shadow-sm"
              title={`Sorting ${sortConfig.direction === "asc" ? "Ascending" : "Descending"}. Click to toggle.`}
            >
              {sortConfig.direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          )}

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-2 hidden sm:block whitespace-nowrap">
            {searchQuery ? `${filteredAndSortedDevices.length} of ${devices.length} devices` : `${devices.length} ${devices.length === 1 ? "device" : "devices"}`}
          </div>
        </div>
      </div>

      {/* Main Registry Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md overflow-hidden">
        {errorMsg ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
            <h3 className="text-base font-bold text-red-600 dark:text-red-400">Failed to load device list</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{errorMsg}</p>
            <Button onClick={fetchDevices} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading device list...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
            <Laptop className="h-10 w-10 text-slate-400" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No devices registered</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              No devices are registered for this organization yet. Click "Register This Device" to add one.
            </p>
          </div>
        ) : filteredAndSortedDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
            <Search className="h-10 w-10 text-slate-400" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No matching devices found</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              No registered devices match "{searchQuery}". Try a different keyword or clear your search.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-2 rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/60">
              <TableRow className="border-b border-slate-100 dark:border-slate-850">
                <TableHead
                  className={cn(
                    "font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer hover:text-amber-600 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors select-none py-3.5 group",
                    sortConfig?.key === "device_name" && "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  )}
                  onClick={() => requestSort("device_name")}
                  title={`Sort by Device Name (${sortConfig?.key === "device_name" && sortConfig.direction === "asc" ? "Descending" : "Ascending"})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Device Name</span>
                    {renderSortIcon("device_name")}
                  </div>
                </TableHead>

                <TableHead
                  className={cn(
                    "font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer hover:text-amber-600 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors select-none py-3.5 group",
                    sortConfig?.key === "registrar" && "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  )}
                  onClick={() => requestSort("registrar")}
                  title={`Sort by Registrar (${sortConfig?.key === "registrar" && sortConfig.direction === "asc" ? "Descending" : "Ascending"})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Registrar</span>
                    {renderSortIcon("registrar")}
                  </div>
                </TableHead>

                <TableHead
                  className={cn(
                    "font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer hover:text-amber-600 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors select-none py-3.5 group",
                    sortConfig?.key === "created_at" && "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  )}
                  onClick={() => requestSort("created_at")}
                  title={`Sort by Enrolled Date (${sortConfig?.key === "created_at" && sortConfig.direction === "asc" ? "Descending" : "Ascending"})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Enrolled On</span>
                    {renderSortIcon("created_at")}
                  </div>
                </TableHead>

                <TableHead
                  className={cn(
                    "font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer hover:text-amber-600 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors select-none py-3.5 group",
                    sortConfig?.key === "status" && "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  )}
                  onClick={() => requestSort("status")}
                  title={`Sort by Status (${sortConfig?.key === "status" && sortConfig.direction === "asc" ? "Descending" : "Ascending"})`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {renderSortIcon("status")}
                  </div>
                </TableHead>

                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedDevices.map((device) => {
                const isPending = actionInProgress === device.id;
                const dateStr = new Date(device.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });

                return (
                  <TableRow
                    key={device.id}
                    className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <TableCell className="py-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Laptop className="h-4 w-4 text-slate-400" />
                      {device.device_name}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-350">
                          {device.registrar?.full_name || "Unknown"}
                        </span>
                        <span className="text-xs text-slate-400">{device.registrar?.email || ""}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                      {dateStr}
                    </TableCell>

                    <TableCell>
                      <button
                        disabled={isPending}
                        onClick={() => handleToggleStatus(device.id, device.is_active)}
                        className="hover:scale-105 transition-transform"
                      >
                        {device.is_active ? (
                          <Badge className="bg-green-500/15 text-green-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <ToggleRight className="h-3.5 w-3.5" />
                            Authorized
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <ToggleLeft className="h-3.5 w-3.5" />
                            Revoked
                          </Badge>
                        )}
                      </button>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleRevokeDevice(device.id)}
                        className="h-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Registration Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Laptop className="h-5 w-5 text-amber-500" />
              Register This Device
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Registering this device will authorize it to run the application. A secure cryptographic token will be stored in this browser.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterDevice} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Device Name/Label</label>
              <Input
                placeholder="e.g. Field Tablet #1, Admin Laptop"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRegisterDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={registering}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-all"
              >
                {registering ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Authorize Device
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Display Token Dialog */}
      <Dialog open={!!newToken} onOpenChange={() => setNewToken(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Check className="h-5 w-5 text-green-500" />
              Device Authorized!
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              This device has been registered successfully. The token has been configured locally in your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Cryptographic Device Token</label>
              <div className="flex gap-2">
                <Input
                  value={newToken || ""}
                  readOnly
                  className="h-10 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white grow"
                />
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="h-10 rounded-xl px-3 flex items-center justify-center"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You do not need to copy this token. It has already been saved securely in this browser profile.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewToken(null)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
