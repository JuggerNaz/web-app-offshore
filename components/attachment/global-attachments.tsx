"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DataTable } from "../data-table/data-table";
import { globalAttachments } from "../data-table/columns";
import { Input } from "@/components/ui/input";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ScrollSentinel } from "@/components/data-table/scroll-sentinel";

export default function GlobalAttachments() {
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebouncedValue(searchQuery, 300);

    // Scroll-to-load attachments list; search runs server-side (?q= over the
    // attachment name and the meta title/description/original file name). The
    // DataTable below keeps its own client-side controls over the loaded rows.
    const {
        items,
        totalItems,
        error,
        isLoading,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteList<any>({
        queryKey: ["attachment", "global", debouncedSearch],
        getPageUrl: (page) =>
            `/api/attachment?page=${page}&pageSize=50${
                debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""
            }`,
    });

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
        <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
            <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    type="text"
                    placeholder="Search attachments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-medium rounded-lg"
                />
            </div>

            <DataTable
                columns={globalAttachments}
                data={items}
                disableRowClick={true}
            />

            <ScrollSentinel
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
                loadedCount={items.length}
                totalItems={totalItems}
                hideWhenDone={false}
            />
        </div>
    );
}
