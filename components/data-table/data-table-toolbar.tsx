"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";
import { Search, X, SlidersHorizontal, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  enableGlobalFilter?: boolean;
  enableColumnFilters?: boolean;
  enableViewOptions?: boolean;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableViewOptions = true,
  searchPlaceholder = "Search for assets...",
  toolbarActions,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    (enableGlobalFilter && table.getState().globalFilter);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
        {enableGlobalFilter && (
          <div className="relative flex-1 sm:flex-initial group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getState().globalFilter as string) ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              className={cn(
                "h-11 w-full sm:w-[300px] lg:w-[380px] pl-10 rounded-xl border-slate-200 dark:border-slate-800",
                "bg-white dark:bg-slate-900/50 shadow-sm transition-all focus:ring-2 focus:ring-blue-500/20"
              )}
            />
          </div>
        )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              if (enableGlobalFilter) {
                table.setGlobalFilter("");
              }
            }}
            className="h-11 px-3 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 text-slate-500 font-bold transition-all"
          >
            Clear Filters
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
        {toolbarActions}
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />
        {enableViewOptions && <DataTableViewOptions table={table} />}
      </div>
    </div>
  );
}
