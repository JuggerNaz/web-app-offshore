import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Showing <span className="text-slate-900 dark:text-white font-black">{table.getRowModel().rows.length}</span> of{" "}
        <span className="text-slate-900 dark:text-white font-black">{table.getFilteredRowModel().rows.length}</span> items
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        <div className="flex items-center space-x-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-9 w-[75px] rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top" className="rounded-xl border-slate-200 dark:border-slate-800">
              {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`} className="rounded-lg">
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex w-[120px] items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-full">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-9 w-9 p-0 lg:flex rounded-xl border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-9 w-9 p-0 lg:flex rounded-xl border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
