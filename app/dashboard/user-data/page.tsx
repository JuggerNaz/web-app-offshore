import { UserDataTable } from "@/components/user-data-table";
import { Users } from "lucide-react";

export default function UserDataPage() {
    return (
        <div className="min-h-screen max-h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="container max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20">
                            <Users className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                User Data
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                View real-time user activity, online presence, and registration details
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <UserDataTable />
            </div>
        </div>
    );
}
