"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  PaginationState,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  disableRowClick?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
  enableGlobalFilter?: boolean;
  enableColumnFilters?: boolean;
  enableSorting?: boolean;
  toolbarActions?: React.ReactNode;
  initialColumnFilters?: ColumnFiltersState;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  disableRowClick = false,
  pageSize = 10,
  enablePagination = true,
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableSorting = true,
  toolbarActions,
  initialColumnFilters = [],
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel:
      enableColumnFilters || enableGlobalFilter ? getFilteredRowModel() : undefined,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      pagination: enablePagination ? pagination : undefined,
      sorting: enableSorting ? sorting : undefined,
      columnFilters: enableColumnFilters ? columnFilters : undefined,
      columnVisibility,
      rowSelection,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
    },
  });

  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <DataTableToolbar
        table={table}
        enableGlobalFilter={enableGlobalFilter}
        enableColumnFilters={enableColumnFilters}
        toolbarActions={toolbarActions}
      />
      <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="h-14 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    if (!disableRowClick) {
                      const rowItem = row.original as unknown as any;
                      if (pathname.includes("pipeline")) {
                        router.push(`/dashboard/field/pipeline/${rowItem.pipe_id}`);
                      } else if (pathname.includes("platform")) {
                        router.push(`/dashboard/field/platform/${rowItem.plat_id}`);
                      }
                    }
                  }}
                  className={cn(
                    "group transition-all duration-200",
                    !disableRowClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="h-16 font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-slate-400 font-medium">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p>No results found matching your criteria</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {enablePagination && (
        <div className="pt-2">
          <DataTablePagination table={table} />
        </div>
      )}
    </div>
  );
}
