"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Play,
  FileText,
  AlertTriangle,
  FolderOpen,
  History,
  ShieldCheck,
  ServerCrash,
  Loader2,
  HardDriveUpload,
} from "lucide-react";

interface BackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export default function BackupDashboard() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Configuration options
  const [format, setFormat] = useState<"sql" | "binary">("sql");
  const [includeSchema, setIncludeSchema] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [includeViews, setIncludeViews] = useState(true);
  const [includeFunctions, setIncludeFunctions] = useState(true);
  const [includeAuth, setIncludeAuth] = useState(false);
  const [includeRoles, setIncludeRoles] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/backup/restore");
      const data = await res.json();
      if (res.ok) {
        setBackups(data.data || []);
      } else {
        toast.error(data.error || "Failed to load backups list");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve local backups.");
    } finally {
      setLoadingBackups(false);
    }
  };

  const executeBackup = async () => {
    setExecuting(true);
    setLogs(["Initializing backup script routine..."]);
    setProgress({ percent: 5, label: "Connecting to database..." });

    try {
      const res = await fetch("/api/admin/backup/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          includeSchema,
          includeData,
          includeViews,
          includeFunctions,
          includeAuth,
          includeRoles,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Execution failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "log") {
                setLogs((prev) => [...prev, `[INFO] ${event.data}`]);
              } else if (event.type === "progress") {
                setProgress(event.data);
              } else if (event.type === "complete") {
                setProgress({ percent: 100, label: "Completed!" });
                setLogs((prev) => [
                  ...prev,
                  `[SUCCESS] Backup saved: ${event.data.fileName} (${(
                    event.data.sizeBytes / 1024
                  ).toFixed(2)} KB)`,
                ]);
                toast.success(event.data.message);
                fetchBackups();
              } else if (event.type === "error") {
                throw new Error(event.data);
              }
            } catch (e: any) {
              console.error("Failed to parse event chunk", e);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[ERROR] ${err.message}`]);
      toast.error(err.message || "Failed to finalize database backup");
      setProgress(null);
    } finally {
      setExecuting(false);
    }
  };

  const triggerRestore = async (fileName: string) => {
    const confirmRestore = window.confirm(
      `Are you absolutely sure you want to restore "${fileName}"? This will overwrite or modify existing schemas/tables matching the snapshot configuration.`
    );
    if (!confirmRestore) return;

    setExecuting(true);
    setLogs([`Initializing database restore pipeline from: ${fileName}...`]);
    setProgress({ percent: 5, label: "Validating package details..." });

    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Restore execution failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "log") {
                setLogs((prev) => [...prev, `[INFO] ${event.data}`]);
              } else if (event.type === "progress") {
                setProgress(event.data);
              } else if (event.type === "complete") {
                setProgress({ percent: 100, label: "Completed!" });
                setLogs((prev) => [
                  ...prev,
                  `[SUCCESS] Restore completed! Rows modified: ${event.data.rowsRestored}`,
                ]);
                toast.success(event.data.message);
              } else if (event.type === "error") {
                throw new Error(event.data);
              }
            } catch (e: any) {
              console.error("Failed to parse event chunk", e);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[ERROR] ${err.message}`]);
      toast.error(err.message || "Failed to finalize database restore");
      setProgress(null);
    } finally {
      setExecuting(false);
    }
  };

  const deleteBackup = async (fileName: string) => {
    const confirmDel = window.confirm(`Remove "${fileName}" permanently from local backups folder?`);
    if (!confirmDel) return;

    try {
      const res = await fetch(`/api/admin/backup/restore?fileName=${fileName}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Backup deleted successfully");
        fetchBackups();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete backup file");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred deleting file");
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Database className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
              <span>Utilities</span>
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
              <span>Routine Control</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
              Database Backup & Restore
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Backup Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDriveUpload className="w-5 h-5 text-emerald-500" /> Configure Backup
              </CardTitle>
              <CardDescription>Select format and target objects to backup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Output format options */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Format Choice</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={format === "sql" ? "default" : "outline"}
                    className="rounded-xl text-xs font-bold"
                    onClick={() => setFormat("sql")}
                  >
                    SQL Plaintext
                  </Button>
                  <Button
                    variant={format === "binary" ? "default" : "outline"}
                    className="rounded-xl text-xs font-bold"
                    onClick={() => setFormat("binary")}
                  >
                    Compressed Binary
                  </Button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="schema" className="text-sm font-medium">Table Structure (Schemas)</Label>
                  <Switch id="schema" checked={includeSchema} onCheckedChange={setIncludeSchema} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="data" className="text-sm font-medium">Table Records (Data)</Label>
                  <Switch id="data" checked={includeData} onCheckedChange={setIncludeData} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="views" className="text-sm font-medium">Database Views</Label>
                  <Switch id="views" checked={includeViews} onCheckedChange={setIncludeViews} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="functions" className="text-sm font-medium">Functions & Routines</Label>
                  <Switch id="functions" checked={includeFunctions} onCheckedChange={setIncludeFunctions} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="roles" className="text-sm font-medium">Users & System Roles</Label>
                  <Switch id="roles" checked={includeRoles} onCheckedChange={setIncludeRoles} />
                </div>
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <Label htmlFor="auth" className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Include Supabase Auth Users
                  </Label>
                  <Switch id="auth" checked={includeAuth} onCheckedChange={setIncludeAuth} />
                </div>
              </div>

              {includeAuth && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-1.5">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Security Warning
                  </span>
                  <span>
                    Auth metadata contains sensitive information. Ensure backup files are stored in restricted locations.
                  </span>
                </div>
              )}

              <Button
                onClick={executeBackup}
                disabled={executing || (!includeSchema && !includeData && !includeViews && !includeFunctions && !includeAuth)}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 border-0"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing Backup...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" /> Run Backup routine
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Logs & File History Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Tracker */}
          {progress && (
            <Card className="border-emerald-200 dark:border-emerald-900/60 shadow-xl bg-emerald-50/30 dark:bg-emerald-950/10">
              <CardContent className="py-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>{progress.label}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terminal Console log viewer */}
          <Card className="border-slate-200/60 dark:border-slate-800 shadow-xl bg-slate-950 dark:bg-black text-slate-100 font-mono">
            <CardHeader className="py-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Live Terminal Console
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-400 hover:text-white"
                onClick={() => setLogs([])}
              >
                Clear Console
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64 p-4 text-xs space-y-1">
                {logs.length === 0 ? (
                  <div className="text-slate-500 italic">Console is idle. Trigger a backup/restore to see trace logs.</div>
                ) : (
                  logs.map((log, index) => {
                    let logColor = "text-slate-300";
                    if (log.startsWith("[SUCCESS]")) logColor = "text-emerald-400 font-bold";
                    if (log.startsWith("[ERROR]")) logColor = "text-rose-400 font-bold";
                    if (log.startsWith("[INFO] Starting")) logColor = "text-teal-400 font-bold";

                    return (
                      <div key={index} className={logColor}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={logEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Local Backups List */}
          <Card className="border-slate-200/60 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" /> Backup Files History
                </CardTitle>
                <CardDescription>Available snapshots saved on local server workspace.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={fetchBackups}
                disabled={loadingBackups}
              >
                <RefreshCw className={`w-4 h-4 ${loadingBackups ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 pr-2">
                {backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                    <FolderOpen className="w-8 h-8 opacity-45 mb-2" />
                    <span className="text-sm font-medium">No backups saved locally yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((b) => (
                      <div
                        key={b.fileName}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/80 gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">
                              {b.fileName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Date: {new Date(b.createdAt).toLocaleString()} | Size:{" "}
                              {(b.sizeBytes / 1024).toFixed(2)} KB
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs font-bold h-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            onClick={() => triggerRestore(b.fileName)}
                            disabled={executing}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" /> Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs font-bold h-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            onClick={() => deleteBackup(b.fileName)}
                            disabled={executing}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
