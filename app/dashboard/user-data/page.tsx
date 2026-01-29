import { UserDataTable } from "@/components/user-data-table";

export default function UserDataPage() {
    return (
        <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col gap-6 overflow-y-auto overflow-x-hidden custom-scrollbar p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">User Data</h1>
                <p className="text-muted-foreground">
                    View real-time user activity and registration details.
                </p>
            </div>
            <UserDataTable />
        </div>
    );
}
