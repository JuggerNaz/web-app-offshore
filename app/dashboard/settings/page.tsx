"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseUrl } from "@/utils/storage";
import Image from "next/image";
import { fetcher } from "@/utils/utils";

interface CompanySettingsData {
    id: number;
    company_name: string;
    department_name: string | null;
    serial_no: string | null;
    logo_path: string | null;
    logo_url: string | null;
    storage_provider: string;
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
    const [serialNo, setSerialNo] = useState("");
    const [localStoragePath, setLocalStoragePath] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Update local state when data is loaded
    useEffect(() => {
        if (settingsResponse?.data) {
            setCompanyName(settingsResponse.data.company_name);
            setDepartmentName(settingsResponse.data.department_name || "");
            setSerialNo(settingsResponse.data.serial_no || "");
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
                        <div className="p-2 bg-blue-600/10 rounded-lg">
                            <Settings className="w-6 h-6 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                            Settings
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
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
                            <Label>Current Storage Provider</Label>
                            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                                <Database className="w-5 h-5 text-blue-600" />
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                        {settings?.storage_provider || "Supabase"}
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Active storage backend
                                    </p>
                                </div>
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
                                    Active
                                </div>
                            </div>
                        </div>

                        {/* Storage Location */}
                        <div className="space-y-2">
                            <Label htmlFor="storageLocation">Storage Location (URL)</Label>
                            <Input
                                id="storageLocation"
                                value={getSupabaseUrl() || "Not configured"}
                                readOnly
                                className="bg-muted font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                This is your current Supabase storage endpoint. All attachments and company assets are stored here.
                            </p>
                        </div>

                        {/* Storage Provider Selection */}
                        <div className="space-y-4 pt-4 border-t">
                            <Label>Storage Provider</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Cloud Storage Option */}
                                <Card className="cursor-pointer hover:border-blue-500 transition-colors border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                                <Cloud className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">Cloud Storage</h4>
                                                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                                                        Active
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Supabase - Secure cloud storage
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Local Drive Option */}
                                <Card className="cursor-pointer hover:border-slate-400 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">Local Drive</h4>
                                                    <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded-full font-medium">
                                                        Available
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Store files on local/network drive
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Local Drive Configuration */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Local Attachments Folder</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Map a local or network drive folder for storing attachments
                                    </p>
                                </div>
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
                                        <div className="space-y-2">
                                            <p className="font-semibold">Local Drive Storage Notes:</p>
                                            <ul className="text-xs space-y-1 ml-4 list-disc">
                                                <li>Ensure the folder has read/write permissions</li>
                                                <li>Network drives must be accessible to all users</li>
                                                <li>Use UNC paths for network locations (\\server\share)</li>
                                                <li>Local storage is not synchronized across devices</li>
                                                <li>Configure in .env.local: LOCAL_STORAGE_PATH and STORAGE_MODE</li>
                                            </ul>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                                    <Database className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                                        <p className="font-semibold mb-2">Quick Setup:</p>
                                        <p className="text-xs">
                                            See <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">docs/LOCAL_STORAGE_SETUP.md</code> for complete implementation guide with code examples and configuration instructions.
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </div>

                        {/* Future Cloud Storage Options */}
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Coming Soon:</strong> Support for additional cloud storage providers including AWS S3, Google Cloud Storage, and Azure Blob Storage.
                            </AlertDescription>
                        </Alert>
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
