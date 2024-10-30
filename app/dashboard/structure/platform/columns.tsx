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

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Payment = {
  id: string
  amount: number
  status: "pending" | "processing" | "success" | "failed"
  email: string
}

export type Platform = Database["public"]["Tables"]["module"]["Row"]

export const columns: ColumnDef<Platform>[] = [
  // {
  //   accessorKey: "status",
  //   header: "Status",
  // },
  // {
  //   accessorKey: "email",
  //   header: "Email",
  // },
  {
    accessorKey: "category_id",
    header: "Category",
  },
  {
    accessorKey: "type_id",
    header: "Type",
  },
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
      const payment = row.original
 
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
                <DropdownMenuItem>View Detail</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
