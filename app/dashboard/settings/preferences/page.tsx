"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Settings,
    Building2,
    Cloud,
    Save,
    Upload,
    Check,
    AlertCircle,
    Database,
    Loader2,
    HardDrive,
    FolderOpen,
    Info,
    Share2,
    Box,
    Globe,
    ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseUrl } from "@/utils/storage";
import Image from "next/image";
import { fetcher } from "@/utils/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CompanySettingsData {
    id: number;
    company_name: string;
    department_name: string | null;
    serial_no: string | null;
    logo_path: string | null;
    logo_url: string | null;
    storage_provider: string;
    storage_config: any;
    def_unit: string;
    has_structures: boolean;
    created_at: string;
    updated_at: string;
}

export default function SettingsPage() {
    const { data: settingsResponse, error, isLoading } = useSWR<{ data: CompanySettingsData }>(
        "/api/company-settings",
        fetcher
    );

    const [companyName, setCompanyName] = useState("");
    const [departmentName, setDepartmentName] = useState("");
    const [defUnit, setDefUnit] = useState("METRIC");
    const [serialNo, setSerialNo] = useState("");
    const [localStoragePath, setLocalStoragePath] = useState("");
    const [storageProvider, setStorageProvider] = useState("Supabase");
    const [storageConfig, setStorageConfig] = useState<any>({});
    const [serviceAccount, setServiceAccount] = useState("");
    const [googleDriveMode, setGoogleDriveMode] = useState<"local" | "api">("local");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Update local state when data is loaded
    useEffect(() => {
        if (settingsResponse?.data) {
            setCompanyName(settingsResponse.data.company_name);
            setDepartmentName(settingsResponse.data.department_name || "");
            setDefUnit(settingsResponse.data.def_unit || "METRIC");
            setSerialNo(settingsResponse.data.serial_no || "");
            setStorageProvider(settingsResponse.data.storage_provider || "Supabase");
            
            const config = settingsResponse.data.storage_config || {};
            setStorageConfig(config);
            setLocalStoragePath(config.basePath || "");
            
            const sa = config.serviceAccount;
            setServiceAccount(typeof sa === 'object' ? JSON.stringify(sa, null, 2) : sa || "");
            setGoogleDriveMode(config.serviceAccount ? "api" : "local");
        }
    }, [settingsResponse]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setUploadError("Please upload an image file");
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setUploadError("File size must be less than 2MB");
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/company-settings/logo", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to upload logo");
            }

            // Refresh settings data
            await mutate("/api/company-settings");

            // Dispatch event to notify sidebar
            window.dispatchEvent(new Event("companySettingsChanged"));
        } catch (error: any) {
            console.error("Error uploading logo:", error);
            setUploadError(error.message || "Failed to upload logo");
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveLogo = async () => {
        if (!confirm("Are you sure you want to remove the company logo?")) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            const response = await fetch("/api/company-settings/logo", {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to remove logo");
            }

            // Refresh settings data
            await mutate("/api/company-settings");

            // Dispatch event to notify sidebar
            window.dispatchEvent(new Event("companySettingsChanged"));
        } catch (error: any) {
            console.error("Error removing logo:", error);
            setUploadError(error.message || "Failed to remove logo");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const response = await fetch("/api/company-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    company_name: companyName,
                    department_name: departmentName,
                    def_unit: defUnit,
                    storage_provider: storageProvider,
                    storage_config: {
                        ...storageConfig,
                        basePath: localStoragePath,
                        serviceAccount: serviceAccount
                    }
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save settings");
            }

            // Refresh settings data
            await mutate("/api/company-settings");

            // Dispatch event to notify sidebar
            window.dispatchEvent(new Event("companySettingsChanged"));

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 w-full flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-lg">Loading settings...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 w-full p-6">
                <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        Failed to load company settings. Please try refreshing the page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const settings = settingsResponse?.data;

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/dashboard/settings" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div className="p-2 bg-blue-600/10 rounded-lg">
                            <Settings className="w-6 h-6 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                            Preferences
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-14">
                        Manage your application preferences and configurations
                    </p>
                </div>

                {/* Success Alert */}
                {saveSuccess && (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            Settings saved successfully! All users will see the updated information.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Upload Error Alert */}
                {uploadError && (
                    <Alert className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                            {uploadError}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Company Information */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            <CardTitle>Company Information</CardTitle>
                        </div>
                        <CardDescription>
                            Configure your company details and branding. These will appear on generated reports and will be shared across all users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Company Name */}
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                                id="companyName"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Enter company name"
                            />
                        </div>

                        {/* Department Name */}
                        <div className="space-y-2">
                            <Label htmlFor="departmentName">Department Name</Label>
                            <Input
                                id="departmentName"
                                value={departmentName}
                                onChange={(e) => setDepartmentName(e.target.value)}
                                placeholder="e.g., Engineering, Operations, Inspection"
                            />
                            <p className="text-xs text-muted-foreground">
                                This will be displayed on generated reports
                            </p>
                        </div>

                        {/* Default Unit System */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="defUnit" className="text-base">Default Unit System</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Choose the global unit system for structures and inspections
                                    </p>
                                </div>
                                <div className="w-[200px]">
                                    <Select
                                        value={defUnit}
                                        onValueChange={setDefUnit}
                                        disabled={settings?.has_structures}
                                    >
                                        <SelectTrigger id="defUnit">
                                            <SelectValue placeholder="Select unit system" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="METRIC">Metric (mm, m, kg)</SelectItem>
                                            <SelectItem value="IMPERIAL">Imperial (in, ft, lb)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            {settings?.has_structures && (
                                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                                        The unit system is <strong>locked</strong> because structures have already been created. This ensures data consistency across the platform.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Company Logo */}
                        <div className="space-y-2">
                            <Label htmlFor="companyLogo">Company Logo</Label>
                            <div className="flex items-start gap-4">
                                {/* Logo Preview */}
                                <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                                    {settings?.logo_url ? (
                                        <div className="relative w-full h-full">
                                            <Image
                                                src={settings.logo_url}
                                                alt="Company Logo"
                                                fill
                                                className="object-contain p-2"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center p-4">
                                            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                                            <p className="text-xs text-muted-foreground">No logo</p>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById("logoUpload")?.click()}
                                            disabled={isUploading}
                                            className="gap-2"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4" />
                                                    Upload Logo
                                                </>
                                            )}
                                        </Button>
                                        {settings?.logo_url && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={handleRemoveLogo}
                                                disabled={isUploading}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Recommended: PNG or SVG, max 2MB. Logo will be stored in Supabase and shared across all users.
                                    </p>
                                    <input
                                        id="logoUpload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Storage Configuration */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Cloud className="w-5 h-5 text-blue-600" />
                            <CardTitle>Cloud Storage</CardTitle>
                        </div>
                        <CardDescription>
                            Configure where your attachments and files are stored
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Current Storage Provider */}
                        <div className="space-y-2">
                            <Label>Current Active Storage</Label>
                            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                                {storageProvider === "Supabase" && <Database className="w-5 h-5 text-blue-600" />}
                                {storageProvider === "Local" && <HardDrive className="w-5 h-5 text-blue-600" />}
                                {storageProvider === "Google Drive" && <Cloud className="w-5 h-5 text-blue-600" />}
                                {storageProvider === "OneDrive" && <Share2 className="w-5 h-5 text-blue-600" />}
                                {storageProvider === "AWS S3" && <Box className="w-5 h-5 text-blue-600" />}
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                        {storageProvider}
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Active storage backend for all attachments
                                    </p>
                                </div>
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                                    Active
                                </div>
                            </div>
                        </div>

                        {/* Storage Provider Selection */}
                        <div className="space-y-4 pt-4 border-t">
                            <Label className="text-base">Select Storage Provider</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { id: "Supabase", name: "Cloud Storage", desc: "Supabase - Default cloud", icon: Cloud, color: "blue" },
                                    { id: "Local", name: "Local Drive", desc: "Local or Network Drive", icon: HardDrive, color: "slate" },
                                    { id: "Google Drive", name: "Google Drive", desc: "Google Cloud Sync", icon: Globe, color: "green" },
                                    { id: "OneDrive", name: "OneDrive", desc: "Microsoft Cloud Storage", icon: Share2, color: "blue" },
                                    { id: "AWS S3", name: "AWS S3", desc: "Amazon Object Storage", icon: Box, color: "orange" },
                                    { id: "Backblaze", name: "Backblaze B2", desc: "Free 10GB / S3 API", icon: Database, color: "red" },
                                    { id: "Cloudinary", name: "Cloudinary", desc: "Best for Media/Video", icon: ExternalLink, color: "indigo" },
                                ].map((p) => (
                                    <Card 
                                        key={p.id}
                                        className={`cursor-pointer transition-all duration-200 border-2 ${
                                            storageProvider === p.id 
                                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" 
                                            : "hover:border-slate-300 dark:hover:border-slate-700"
                                        } ${(p as any).disabled ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                                        onClick={() => !(p as any).disabled && setStorageProvider(p.id)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg bg-${p.color}-100 dark:bg-${p.color}-900/50`}>
                                                    <p.icon className={`w-5 h-5 text-${p.color}-600`} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-semibold text-sm">{p.name}</h4>
                                                        {storageProvider === p.id && (
                                                            <Check className="w-3 h-3 text-blue-600" />
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {p.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Provider Specific Configuration */}
                        <div className="space-y-4 pt-4 border-t">
                            {storageProvider === "Supabase" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="storageLocation">Supabase Storage Endpoint</Label>
                                        <Input
                                            id="storageLocation"
                                            value={getSupabaseUrl() || "Not configured"}
                                            readOnly
                                            className="bg-muted font-mono text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This is your managed Supabase storage. No additional setup required.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {storageProvider === "Local" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>Local Attachments Folder</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Map a local or network drive folder for storing attachments
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <Input
                                                value={localStoragePath}
                                                onChange={(e) => setLocalStoragePath(e.target.value)}
                                                placeholder="C:\Attachments or \\server\share\attachments"
                                                className="font-mono text-sm"
                                            />
                                            <Button
                                                variant="outline"
                                                className="gap-2 shrink-0"
                                                onClick={() => alert("File browser will open here. For now, please type the path manually.")}
                                            >
                                                <FolderOpen className="w-4 h-4" />
                                                Browse
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="gap-2 shrink-0"
                                                onClick={() => {
                                                    if (!localStoragePath) {
                                                        alert("Please enter a path first");
                                                        return;
                                                    }
                                                    alert(`Testing connection to: ${localStoragePath}\n\nNote: Actual connection test will be implemented in the backend.`);
                                                }}
                                            >
                                                <Check className="w-4 h-4" />
                                                Test
                                            </Button>
                                        </div>

                                        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                            <AlertDescription className="text-amber-800 dark:text-amber-200">
                                                <div className="space-y-2 text-xs">
                                                    <p className="font-semibold">Local Drive Storage Notes:</p>
                                                    <ul className="space-y-1 ml-4 list-disc">
                                                        <li>Ensure the folder has read/write permissions</li>
                                                        <li>Network drives must be accessible to all users</li>
                                                        <li>Use UNC paths for network locations (\\server\share)</li>
                                                    </ul>
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                </div>
                            )}

                            {storageProvider === "Google Drive" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-base">Google Drive Configuration</Label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Choose your connection method for Google Drive
                                            </p>
                                        </div>
                                        <Tabs value={googleDriveMode} onValueChange={(v: any) => setGoogleDriveMode(v)} className="w-[300px]">
                                            <TabsList className="grid w-full grid-cols-2">
                                                <TabsTrigger value="local">Desktop Sync</TabsTrigger>
                                                <TabsTrigger value="api">Direct API</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/20">
                                        {googleDriveMode === "local" ? (
                                            <div className="space-y-4 animate-in fade-in duration-300">
                                                <div className="space-y-2">
                                                    <Label htmlFor="gdriveLocalPath">Google Drive Desktop Path</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            id="gdriveLocalPath"
                                                            value={localStoragePath}
                                                            onChange={(e) => setLocalStoragePath(e.target.value)}
                                                            placeholder="e.g., G:\My Drive\Inspections"
                                                            className="font-mono text-sm bg-white dark:bg-black"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            className="gap-2 shrink-0"
                                                            onClick={() => alert("Please browse to your Google Drive Desktop folder.")}
                                                        >
                                                            <FolderOpen className="w-4 h-4" />
                                                            Browse
                                                        </Button>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Use this if you have <b>Google Drive for Desktop</b> installed. Files will sync automatically.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 animate-in fade-in duration-300">
                                                <div className="space-y-2">
                                                    <Label htmlFor="gdriveId">Folder ID or URL</Label>
                                                    <Input
                                                        id="gdriveId"
                                                        value={storageConfig.googleDriveFolderId || ""}
                                                        onChange={(e) => setStorageConfig({ ...storageConfig, googleDriveFolderId: e.target.value })}
                                                        placeholder="Enter Google Drive Folder ID or URL"
                                                        className="font-mono text-sm bg-white dark:bg-black"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="saJson">Service Account JSON</Label>
                                                    <Textarea
                                                        id="saJson"
                                                        value={serviceAccount}
                                                        onChange={(e) => setServiceAccount(e.target.value)}
                                                        placeholder='{ "type": "service_account", ... }'
                                                        className="font-mono text-[10px] h-32 bg-white dark:bg-black"
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Paste the contents of your Google Cloud Service Account JSON key file.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={async () => {
                                                    try {
                                                        const response = await fetch("/api/storage/test-connection", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                provider: "Google Drive",
                                                                storage_config: {
                                                                    ...storageConfig,
                                                                    basePath: localStoragePath,
                                                                    serviceAccount: serviceAccount
                                                                }
                                                            })
                                                        });
                                                        const data = await response.json();
                                                        if (data.success) {
                                                            alert("✅ " + data.message);
                                                        } else {
                                                            alert("❌ " + data.error);
                                                        }
                                                    } catch (e: any) {
                                                        alert("❌ Test failed: " + e.message);
                                                    }
                                                }}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Test Connectivity
                                            </Button>
                                        </div>

                                        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 mt-2">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                                                {googleDriveMode === "local" ? (
                                                    <p><strong>Desktop Sync:</strong> Best for individual users. Requires the Google Drive app to be running on your machine.</p>
                                                ) : (
                                                    <p><strong>Direct API:</strong> Best for team environments. Uploads happen in the background without needing any app installed on your PC.</p>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                </div>
                            )}

                            {storageProvider === "AWS S3" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>AWS S3 Configuration</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Configure Amazon S3 Bucket for attachment storage
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="s3Bucket">Bucket Name</Label>
                                            <Input
                                                id="s3Bucket"
                                                value={storageConfig.bucket || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, bucket: e.target.value })}
                                                placeholder="my-attachments-bucket"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="s3Region">Region</Label>
                                            <Input
                                                id="s3Region"
                                                value={storageConfig.region || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, region: e.target.value })}
                                                placeholder="us-east-1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="s3AccessKey">Access Key ID</Label>
                                            <Input
                                                id="s3AccessKey"
                                                value={storageConfig.accessKeyId || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, accessKeyId: e.target.value })}
                                                placeholder="AKIA..."
                                                type="password"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="s3SecretKey">Secret Access Key</Label>
                                            <Input
                                                id="s3SecretKey"
                                                value={storageConfig.secretAccessKey || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, secretAccessKey: e.target.value })}
                                                placeholder="Secret Key"
                                                type="password"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch("/api/storage/test-connection", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            provider: "AWS S3",
                                                            storage_config: { ...storageConfig }
                                                        })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) alert("✅ " + data.message);
                                                    else alert("❌ " + data.error);
                                                } catch (e: any) {
                                                    alert("❌ Test failed: " + e.message);
                                                }
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Test Connectivity
                                        </Button>
                                    </div>
                                    <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                                        <Info className="h-4 w-4 text-orange-600" />
                                        <AlertDescription className="text-orange-800 dark:text-orange-200 text-xs">
                                            Ensure the IAM user has `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions for the specified bucket.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}

                             {storageProvider === "OneDrive" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>OneDrive Configuration</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Configure Microsoft OneDrive (Graph API) for attachment storage
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="oneClientId">Client ID (App ID)</Label>
                                            <Input
                                                id="oneClientId"
                                                value={storageConfig.clientId || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, clientId: e.target.value })}
                                                placeholder="Enter Client ID"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="oneTenantId">Tenant ID</Label>
                                            <Input
                                                id="oneTenantId"
                                                value={storageConfig.tenantId || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, tenantId: e.target.value })}
                                                placeholder="Enter Tenant ID"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="oneClientSecret">Client Secret</Label>
                                            <Input
                                                id="oneClientSecret"
                                                value={storageConfig.clientSecret || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, clientSecret: e.target.value })}
                                                placeholder="Enter Client Secret"
                                                type="password"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="oneDriveId">Drive ID</Label>
                                            <Input
                                                id="oneDriveId"
                                                value={storageConfig.driveId || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, driveId: e.target.value })}
                                                placeholder="Enter Drive ID"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch("/api/storage/test-connection", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            provider: "OneDrive",
                                                            storage_config: { ...storageConfig }
                                                        })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) alert("✅ " + data.message);
                                                    else alert("❌ " + data.error);
                                                } catch (e: any) {
                                                    alert("❌ Test failed: " + e.message);
                                                }
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Test Connectivity
                                        </Button>
                                    </div>
                                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                                            Register an application in Azure Portal with `Files.ReadWrite.All` (Application Permissions) to enable background uploads.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}

                            {storageProvider === "Backblaze" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>Backblaze B2 Configuration (S3 Compatible)</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Configure Backblaze B2 Bucket (S3 API). First 10GB is Free.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="b2Bucket">Bucket Name</Label>
                                            <Input
                                                id="b2Bucket"
                                                value={storageConfig.bucket || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, bucket: e.target.value })}
                                                placeholder="my-b2-bucket"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="b2Region">Region / Endpoint</Label>
                                            <Input
                                                id="b2Region"
                                                value={storageConfig.region || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, region: e.target.value })}
                                                placeholder="e.g., us-west-004"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="b2KeyId">Key ID</Label>
                                            <Input
                                                id="b2KeyId"
                                                value={storageConfig.accessKeyId || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, accessKeyId: e.target.value })}
                                                placeholder="Application Key ID"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="b2AppKey">Application Key</Label>
                                            <Input
                                                id="b2AppKey"
                                                value={storageConfig.secretAccessKey || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, secretAccessKey: e.target.value })}
                                                placeholder="Application Key Secret"
                                                type="password"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch("/api/storage/test-connection", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            provider: "Backblaze",
                                                            storage_config: { ...storageConfig }
                                                        })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) alert("✅ " + data.message);
                                                    else alert("❌ " + data.error);
                                                } catch (e: any) {
                                                    alert("❌ Test failed: " + e.message);
                                                }
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Test Connectivity
                                        </Button>
                                    </div>
                                    <Alert className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
                                        <Info className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-800 dark:text-red-200 text-xs">
                                            Enable S3 compatibility in Backblaze B2 and use the "Application Key" (not the master key) with S3 permissions.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}

                            {storageProvider === "Cloudinary" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>Cloudinary Configuration</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Best for Video and Images. Automatic optimization.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cldName">Cloud Name</Label>
                                            <Input
                                                id="cldName"
                                                value={storageConfig.cloudName || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, cloudName: e.target.value })}
                                                placeholder="Enter Cloud Name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cldKey">API Key</Label>
                                            <Input
                                                id="cldKey"
                                                value={storageConfig.apiKey || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, apiKey: e.target.value })}
                                                placeholder="Enter API Key"
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="cldSecret">API Secret</Label>
                                            <Input
                                                id="cldSecret"
                                                value={storageConfig.apiSecret || ""}
                                                onChange={(e) => setStorageConfig({ ...storageConfig, apiSecret: e.target.value })}
                                                placeholder="Enter API Secret"
                                                type="password"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch("/api/storage/test-connection", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            provider: "Cloudinary",
                                                            storage_config: { ...storageConfig }
                                                        })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) alert("✅ " + data.message);
                                                    else alert("❌ " + data.error);
                                                } catch (e: any) {
                                                    alert("❌ Test failed: " + e.message);
                                                }
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Test Connectivity
                                        </Button>
                                    </div>
                                    <Alert className="bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900">
                                        <Info className="h-4 w-4 text-indigo-600" />
                                        <AlertDescription className="text-indigo-800 dark:text-indigo-200 text-xs">
                                            Cloudinary will store your media and provide highly optimized delivery. Great for playback of large video files.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}

                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-4">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
