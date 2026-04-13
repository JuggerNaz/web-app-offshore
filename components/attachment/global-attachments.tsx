"use client";

import { DataTable } from "../data-table/data-table";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { globalAttachments } from "../data-table/columns";

export default function GlobalAttachments() {
    const { data, error, isLoading } = useSWR(`/api/attachment`, fetcher);

    if (error) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <p className="font-bold text-xs uppercase tracking-widest">Connection Error</p>
        </div>
    );

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fetching Files...</p>
        </div>
    );

    return (
        <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <DataTable
                columns={globalAttachments}
                data={data?.data}
                disableRowClick={true}
            />
        </div>
    );
}
