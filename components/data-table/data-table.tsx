"use client"

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
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  disableRowClick?: boolean
  pageSize?: number
  enablePagination?: boolean
  enableGlobalFilter?: boolean
  enableColumnFilters?: boolean
  enableSorting?: boolean
  toolbarActions?: React.ReactNode
}

export function DataTable<TData, TValue, disableRowClick>({
  columns,
  data,
  disableRowClick = false,
  pageSize = 10,
  enablePagination = true,
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableSorting = true,
  toolbarActions
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: (enableColumnFilters || enableGlobalFilter) ? getFilteredRowModel() : undefined,
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
  })

  const pathname = usePathname()
  const router = useRouter()
  
  return (
    <div className="space-y-4">
      <DataTableToolbar 
        table={table} 
        enableGlobalFilter={enableGlobalFilter}
        enableColumnFilters={enableColumnFilters}
        toolbarActions={toolbarActions}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
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
                      if(!disableRowClick){
                        const rowItem = row.original as unknown as any
                        if (pathname.includes("pipeline")) {
                          router.push(`/dashboard/structure/pipeline/${rowItem.pipe_id}`)
                        } else if (pathname.includes("platform")) {
                          router.push(`/dashboard/structure/platform/${rowItem.plat_id}`)
                        }
                      }
                    }
                  }
                  className="cursor-pointer hover:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {enablePagination && <DataTablePagination table={table} />}
    </div>
  )
}
