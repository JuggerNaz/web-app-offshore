"use client";

import Link from "next/link";
import { Settings, Building2, Video, Activity, AlertTriangle, User, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
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

                {/* Settings Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Preferences */}
                    <Link href="/dashboard/settings/preferences">
                        <Card className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200 h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <Building2 className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Preferences</CardTitle>
                                        <CardDescription>Company & Storage Settings</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                        Company Information
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                        Company Logo
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                        Cloud Storage Configuration
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                        Local Drive Setup
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Video Capture */}
                    <Link href="/dashboard/settings/video-capture">
                        <Card className="cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all duration-200 h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                        <Video className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Video Capture</CardTitle>
                                        <CardDescription>Recording & Playback Settings</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                        Video Recorder Configuration
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                        Camera & Audio Devices
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                        Video Player & Playback
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                        Format Conversion
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Data Acquisition */}
                    <Link href="/dashboard/settings/data-acquisition">
                        <Card className="cursor-pointer hover:border-green-500 hover:shadow-lg transition-all duration-200 h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <Activity className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Data Acquisition</CardTitle>
                                        <CardDescription>External Data Sources</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Serial Port (RS232) Connection
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Network (TCP/UDP) Connection
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Position & ID-Based Parsing
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Field Mapping Configuration
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Defect Criteria */}
                    <Link href="/dashboard/settings/defect-criteria">
                        <Card className="cursor-pointer hover:border-orange-500 hover:shadow-lg transition-all duration-200 h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Defect / Anomaly</CardTitle>
                                        <CardDescription>Inspection Criteria & Rules</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                                        Validation Procedures
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                                        Defect Detection Logic
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                                        Library Configuration
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                                        Auto-flagging Rules
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Link>
                    {/* User Data */}
                    <Link href="/dashboard/user-data">
                        <Card className="cursor-pointer hover:border-cyan-500 hover:shadow-lg transition-all duration-200 h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                                        <User className="w-6 h-6 text-cyan-600" />
                                    </div>
                                    <div>
                                        <CardTitle>User Data</CardTitle>
                                        <CardDescription>User Management & Accounts</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                                        Manage Registered Users
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                                        User Profiles & Access
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Link>

                </div>

                {/* Info Card */}
                <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Settings Organization
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Settings are organized into categories for easier navigation. Click on a category above to access specific settings.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
