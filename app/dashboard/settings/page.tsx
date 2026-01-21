"use client";

import Link from "next/link";
import { Settings, Building2, Video } from "lucide-react";
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
