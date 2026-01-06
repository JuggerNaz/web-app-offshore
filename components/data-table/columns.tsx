"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, MoreVertical, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTableColumnHeader } from "./data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database } from "@/supabase/schema";
import moment from "moment";
import Link from "next/link";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { Trash2, Edit2, Plus } from "lucide-react";
import { number } from "zod";
import { processAttachmentUrl, truncateText } from "@/utils/storage";

export type Platform = Database["public"]["Tables"]["platform"]["Row"];
export type Comment = Database["public"]["Tables"]["comment"]["Row"];
export type Pipeline = Database["public"]["Tables"]["u_pipeline"]["Row"];
export type Levels = Database["public"]["Tables"]["str_level"]["Row"];
export type Faces = Database["public"]["Tables"]["str_faces"]["Row"];
export type Jobpack = Database["public"]["Tables"]["workpl"]["Row"];
export type Field = Database["public"]["Tables"]["u_lib_list"]["Row"];
export type StructureSelect = {
  str_id: number;
  str_title: string;
  str_field: string;
  str_type: string;
};
export type Attachment = Database["public"]["Tables"]["attachment"]["Row"];
export type Component = {
  comp_id: string;
  description: string;
  component_type: string;
};

export const columns: ColumnDef<Platform>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "pfield",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Field" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "ptype",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    enableSorting: true,
    enableHiding: true,
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
      const item = row.original;

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
                  console.log(item);
                }}
              >
                <Link href={`/dashboard/field/platform/${item.plat_id}`}>View Detail</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const pipelines: ColumnDef<Pipeline>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "pfield",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Field" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "ptype",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
                  console.log(item);
                }}
              >
                <Link href={`/dashboard/field/pipeline/${item.pipe_id}`}>View Detail</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const comments: ColumnDef<Comment>[] = [
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ row }) => {
      const date: string = row.getValue("created_at");
      return <div>{moment(date).format("MMMM Do, YYYY")}</div>;
    },
  },
  {
    accessorKey: "text",
    header: "Text",
  },
  {
    accessorKey: "user_name",
    header: "User",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
                  console.log(item);
                }}
              >
                {/* <Link href={`/dashboard/structure/platform/${item.struc}`}>
                  View Detail
                  </Link> */}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const components: ColumnDef<Component>[] = [
  {
    accessorKey: "comp_id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Comp ID" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "description",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "component_type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Component Type" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  console.log(item);
                }}
              >
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const levels: ColumnDef<Levels>[] = [
  {
    accessorKey: "level_name",
    header: "Level Name",
  },
  {
    accessorKey: "elv_from",
    header: "Start Elevation",
  },
  {
    accessorKey: "elv_to",
    header: "End Elevation",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
                onClick={async () => {
                  await fetcher(`/api/platform/level`, {
                    method: "DELETE",
                    body: JSON.stringify(item),
                  }).then((res) => {
                    mutate(`/api/platform/level/${item.plat_id}`);
                    toast("Level deleted successfully");
                  });
                }}
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const faces: ColumnDef<Faces>[] = [
  {
    accessorKey: "face",
    header: "Name",
  },
  {
    accessorKey: "face_from",
    header: "From",
  },
  {
    accessorKey: "face_to",
    header: "To",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
                onClick={async () => {
                  await fetcher(`/api/platform/faces`, {
                    method: "DELETE",
                    body: JSON.stringify(item),
                  }).then((res) => {
                    mutate(`/api/platform/faces/${item.plat_id}`);
                    toast("Faces deleted successfully");
                  });
                }}
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const jobpacks: ColumnDef<Jobpack>[] = [
  {
    accessorKey: "inspno",
    header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "jobname",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "plantype",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plan Type" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "tasktype",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Task Type" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
              <DropdownMenuSeparator />
              {/* TODO: search for better way to make dropdown item menu cursor pointer */}
              <DropdownMenuItem
                className="cursor-pointer w-full"
                onClick={async () => {
                  // await fetcher(`/api/platform/faces`, {
                  //   method: 'DELETE',
                  //   body: JSON.stringify(item)
                  // })
                  // .then((res) => {
                  //   mutate(`/api/platform/faces/${item.inspno}`)
                  //   toast("Faces deleted successfully")
                  // })
                }}
              >
                <Link className="w-full flex" href={`/dashboard/jobpack/${item.inspno}`}>
                  <Edit2 size={18} className="mr-2" /> Modify
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  console.log(item);
                }}
              >
                <Link className="w-full flex" href={`/dashboard/jobpack/${item.inspno}`}>
                  <Trash2 size={18} className="mr-2" /> Delete
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const fields: ColumnDef<Field>[] = [
  {
    accessorKey: "lib_id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "lib_desc",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  console.log(item);
                }}
              >
                <Link href={`/dashboard/field/platform?field=${item.lib_id}`}>
                  View Platform
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  console.log(item);
                }}
              >
                <Link href={`/dashboard/field/pipeline?field=${item.lib_id}`}>
                  View Pipeline
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export const structure: ColumnDef<StructureSelect>[] = [
  {
    accessorKey: "str_title",
    header: "Title",
  },
  {
    accessorKey: "str_field",
    header: "Field",
  },
  {
    accessorKey: "str_type",
    header: "Type",
  },
  {
    header: "Actions",
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="text-center">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={""}
            onClick={() => {
              console.log(item);
            }}
          >
            <Plus size={18} className="" /> Add
          </Link>
        </div>
      );
    },
  },
];

export const extendStructureColumn = ({
  setValue,
  isRemove,
}: {
  setValue: React.Dispatch<React.SetStateAction<number>>;
  isRemove?: boolean;
}): ColumnDef<StructureSelect>[] => {
  return [
    {
      header: "#",
      cell: ({ row }) => {
        return Number(row.id) + 1;
      },
    },
    {
      accessorKey: "str_title",
      header: "Title",
    },
    {
      accessorKey: "str_field",
      header: "Field",
    },
    {
      accessorKey: "str_type",
      header: "Type",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={""}
            onClick={() => {
              setValue(item.str_id);
            }}
          >
            {isRemove ? <Trash2 size={18} className="" /> : <Plus size={18} className="" />}
            {isRemove ? "Remove" : "Add"}
          </Link>
        );
      },
    },
  ];
};

export const attachments: ColumnDef<Attachment>[] = [
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ row }) => {
      const date: string = row.getValue("created_at");
      return <div>{moment(date).format("MMMM Do, YYYY")}</div>;
    },
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "user_name",
    header: "User",
  },
  {
    accessorKey: "path",
    header: "Url",
    cell: ({ row }) => {
      const attachment: Attachment = row.original;
      const { fileUrl, fileName } = processAttachmentUrl(attachment);

      // Ensure we have a valid URL
      if (!fileUrl) {
        return <span className="text-gray-500">No file URL</span>;
      }

      // Truncate filename for display
      const displayText = truncateText(fileName, 30);

      return (
        <div className="flex items-center gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 max-w-[200px]"
            title={fileUrl}
          >
            <span className="truncate">{displayText}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

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
                  console.log(item);
                }}
              >
                {/* <Link href={`/dashboard/structure/platform/${item.struc}`}>
                  View Detail
                  </Link> */}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export type InspectionPlanning = Database["public"]["Tables"]["inspection_planning"]["Row"] & { metadata?: any };

export const inspectionPlanningColumns: ColumnDef<InspectionPlanning>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Protocol Name" />,
    cell: ({ row }) => (
      <div className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-white">
        {row.getValue("name") || "Unnamed Protocol"}
      </div>
    ),
  },
  {
    accessorKey: "metadata",
    header: "Program Code",
    cell: ({ row }) => {
      const metadata = row.original.metadata as any;
      const code = metadata?.inspectionProgram || "N/A";
      return (
        <span className="text-[10px] font-black px-2 py-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-widest">
          {code}
        </span>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Registration Date",
    cell: ({ row }) => (
      <div className="text-[10px] font-bold text-slate-500 uppercase">
        {moment(row.getValue("created_at")).format("DD MMM YYYY")}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

      const onDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this inspection plan?")) {
          try {
            await fetcher(`/api/inspection-planning?id=${item.id}`, { method: "DELETE" });
            mutate("/api/inspection-planning");
            toast.success("Inspection plan decommissioned");
          } catch (err) {
            toast.error("Failed to delete plan");
          }
        }
      };

      return (
        <div className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-2">Operations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer rounded-xl m-1 py-2 font-bold text-xs gap-2 focus:bg-slate-50 dark:focus:bg-slate-900">
                <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                <Link href={`/dashboard/planning/form?id=${item.id}`}>Modify Parameters</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer rounded-xl m-1 py-2 font-bold text-xs gap-2 text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Decommission Plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

