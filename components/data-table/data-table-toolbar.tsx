"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";
import { Search, X } from "lucide-react";

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
  searchPlaceholder = "Search all columns...",
  toolbarActions,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    (enableGlobalFilter && table.getState().globalFilter);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {enableGlobalFilter && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getState().globalFilter as string) ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              className="h-8 w-[150px] lg:w-[250px] pl-8"
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
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {toolbarActions}
        {enableViewOptions && <DataTableViewOptions table={table} />}
      </div>
    </div>
  );
}
