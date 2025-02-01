"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Database } from "@/supabase/schema"
import moment from "moment"
import Link from "next/link"

export type Platform = Database["public"]["Tables"]["platform"]["Row"]

export const columns: ColumnDef<Platform>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "pfield",
    header: "Field",
  },
  {
    accessorKey: "ptype",
    header: "Type",
  },
  // {
  //   accessorKey: "created_at",
  //   header: "Created At",
  //   cell: ({ row }) => {
  //     const date: string = row.getValue("created_at")
  //     return <div>{moment(date).format("MMMM Do, YYYY")}</div>
  //   }
  // },
  // {
  //   accessorKey: "modified_by",
  //   header: "Modified By",
  //   cell: ({ row }) => {
  //     const modifiedBy: string = row.getValue("modified_by") || 'N/A'
  //     return <div>{modifiedBy}</div>
  //   }
  // },
  // {
  //   accessorKey: "amount",
  //   header: () => <div className="text-right">Amount</div>,
  //   cell: ({ row }) => {
  //     const amount = parseFloat(row.getValue("amount"))
  //     const formatted = new Intl.NumberFormat("en-US", {
  //       style: "currency",
  //       currency: "USD",
  //     }).format(amount)
 
  //     return <div className="text-right font-medium">{formatted}</div>
  //   },
  // },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original
 
      return (
        <div className="text-center">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {/* <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(payment.id)}
                >
                Copy payment ID
                </DropdownMenuItem> */}
                <DropdownMenuSeparator />
                {/* TODO: search for better way to make dropdown item menu cursor pointer */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    console.log(item)
                  }}
                >
                  <Link href={`/dashboard/structure/platform/${item.plat_id}`}>
                  View Detail
                  </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]

export const pipelines: ColumnDef<Platform>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "pfield",
    header: "Field",
  },
  {
    accessorKey: "ptype",
    header: "Type",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original
 
      return (
        <div className="text-center">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {/* <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(payment.id)}
                >
                Copy payment ID
                </DropdownMenuItem> */}
                <DropdownMenuSeparator />
                {/* TODO: search for better way to make dropdown item menu cursor pointer */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    console.log(item)
                  }}
                >
                  <Link href={`/dashboard/structure/platform/${item.plat_id}`}>
                  View Detail
                  </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
