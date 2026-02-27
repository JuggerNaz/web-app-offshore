"use client";

import { useState } from "react";
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
import { Trash2, Edit2, Plus, Calendar, CheckCircle, FileText } from "lucide-react";
import { number } from "zod";
import { processAttachmentUrl, truncateText } from "@/utils/storage";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export type Platform = Database["public"]["Tables"]["platform"]["Row"];
export type Comment = Database["public"]["Tables"]["comment"]["Row"];
export type Pipeline = Database["public"]["Tables"]["u_pipeline"]["Row"];
export type Levels = Database["public"]["Tables"]["str_level"]["Row"];
export type Faces = Database["public"]["Tables"]["str_faces"]["Row"];
export type Jobpack = Database["public"]["Tables"]["jobpack"]["Row"];
export type Field = Database["public"]["Tables"]["u_lib_list"]["Row"];
export type StructureSelect = {
  str_id: number;
  str_title: string;
  str_field: string;
  str_type: string;
};
export type Attachment = Database["public"]["Tables"]["attachment"]["Row"];
export type ExtendedAttachment = Attachment & { source_name?: string };
export type Component = {
  comp_id: string;
  description: string;
  component_type: string;
};
export type InspectionType = Database["public"]["Tables"]["inspection_type"]["Row"];

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
    cell: ({ row }) => <LevelActions row={row} />,
  },
];

function LevelActions({ row }: { row: any }) {
  const item = row.original;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      await fetcher(`/api/platform/level`, {
        method: "DELETE",
        body: JSON.stringify(item),
      });
      mutate(`/api/platform/level/${item.plat_id}`);
      toast.success("Level deleted successfully");
      setDeleteOpen(false);
    } catch (e) {
      toast.error("Failed to delete level");
    } finally {
      setLoading(false);
    }
  };

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
            className="cursor-pointer text-red-600 focus:text-red-700"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={16} className="mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        loading={loading}
        title="Remove Level"
        description="Are you sure you want to remove this elevation level? This will affect how components are mapped."
      />
    </div>
  );
}


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
    cell: ({ row }) => <FaceActions row={row} />,
  },
];

function FaceActions({ row }: { row: any }) {
  const item = row.original;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      await fetcher(`/api/platform/faces`, {
        method: "DELETE",
        body: JSON.stringify(item),
      });
      mutate(`/api/platform/faces/${item.plat_id}`);
      toast.success("Face deleted successfully");
      setDeleteOpen(false);
    } catch (e) {
      toast.error("Failed to delete face");
    } finally {
      setLoading(false);
    }
  };

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
            className="cursor-pointer text-red-600 focus:text-red-700"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={16} className="mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        loading={loading}
        title="Remove Face"
        description="Are you sure you want to remove this structure face definition?"
      />
    </div>
  );
}


export const jobpacks: ColumnDef<Jobpack>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
    enableSorting: true,
    enableHiding: true,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => row.original.name || "",
    enableSorting: true,
    enableHiding: true,
  },


  {
    id: "plantype",
    accessorFn: (row) => (row.metadata as any)?.plantype || "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plan Type" />,
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }) => {
      const val = (row.original.metadata as any)?.plantype;
      return val ? <span className="text-[10px] uppercase font-bold text-slate-500">{val}</span> : null;
    }
  },
  {
    id: "tasktype",
    accessorFn: (row) => (row.metadata as any)?.tasktype || "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Task Type" />,
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }) => {
      const val = (row.original.metadata as any)?.tasktype;
      return val ? <span className="text-[10px] uppercase font-bold text-slate-500">{val}</span> : null;
    }
  },

  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      let color = "bg-slate-100 text-slate-700";
      if (status === 'OPEN') color = "bg-green-100 text-green-700";
      if (status === 'CLOSED') color = "bg-gray-100 text-gray-500 line-through";
      return <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${color}`}>{status}</span>
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "structures",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Structures" />,
    accessorFn: (row) => {
      const metadata = row.metadata as any;
      const structures = metadata?.structures || [];
      return structures.map((s: any) => s.title || s.code || s.name || "").join(", ");
    },
    cell: ({ row }) => {
      const metadata = row.original.metadata as any;
      const structures = metadata?.structures || [];
      const stStatus = metadata?.structure_status || {};

      if (structures.length === 0) return <span className="text-slate-400 text-xs italic">No structures</span>;

      return (
        <div className="flex flex-wrap gap-1">
          {structures.map((s: any, i: number) => {
            const key = `${s.type}-${s.id}`;
            const isClosed = stStatus[key]?.status === "CLOSED";

            return (
              <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors ${isClosed
                ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                : "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
                }`}>
                {s.title || s.code || s.name}
                {isClosed && <CheckCircle size={8} className="text-green-600 dark:text-green-500" />}
              </span>
            )
          })}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const metadata = row.original.metadata as any;
      const structures = metadata?.structures || [];
      const searchValue = value.toLowerCase();
      return structures.some((s: any) =>
        (s.title?.toLowerCase().includes(searchValue)) ||
        (s.code?.toLowerCase().includes(searchValue)) ||
        (s.name?.toLowerCase().includes(searchValue))
      );
    },
  },
  {
    id: "istart",
    accessorFn: (row) => (row.metadata as any)?.istart,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
    cell: ({ getValue }) => {
      const date = getValue() as string;
      if (!date) return <span className="text-slate-300 text-[10px]">N/A</span>;
      return (
        <div className="text-[10px] font-medium text-slate-500">
          {moment(date).format("DD MMM YYYY")}
        </div>
      );
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <JobpackActions row={row} />,
  },
];

function JobpackActions({ row }: { row: any }) {
  const item = row.original;
  const metadata = item.metadata as any || {};
  const structureStatus = metadata.structure_status || {};
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isJobClosed = item.status === "CLOSED";
  const hasClosedStructures = Object.values(structureStatus).some((v: any) => v?.status === "CLOSED");

  let hasInspections = false;
  if (metadata.inspections) {
    if (Array.isArray(metadata.inspections)) {
      hasInspections = metadata.inspections.length > 0;
    } else if (typeof metadata.inspections === 'object') {
      hasInspections = Object.values(metadata.inspections).some((arr: any) => Array.isArray(arr) && arr.length > 0);
    }
  }

  const canDelete = !isJobClosed && !hasClosedStructures;

  const onDelete = async () => {
    try {
      setLoading(true);
      await fetcher(`/api/jobpack/${item.id}`, { method: 'DELETE' });
      mutate('/api/jobpack');
      toast.success("Work Pack deleted");
      setDeleteOpen(false);
    } catch (e) {
      toast.error("Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center" onClick={(e) => e.stopPropagation()}>
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
          <DropdownMenuItem className="cursor-pointer">
            <Link className="w-full flex items-center" href={`/dashboard/jobpack/${item.id}`}>
              <Edit2 size={16} className="mr-2" /> Modify
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Link className="w-full flex items-center" href={`/dashboard/jobpack/${item.id}/consolidate`}>
              <CheckCircle size={16} className="mr-2 text-green-600" /> Consolidate
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Link className="w-full flex items-center" href={`/dashboard/jobpack/${item.id}?tab=sow`}>
              <FileText size={16} className="mr-2 text-blue-600" /> SOW
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={canDelete ? "cursor-pointer text-red-600 font-bold" : "cursor-not-allowed opacity-50 text-slate-400"}
            onClick={() => canDelete && setDeleteOpen(true)}
            disabled={!canDelete}
          >
            <Trash2 size={16} className="mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        loading={loading}
        title="Delete Job Pack"
        description={`Are you sure you want to delete this Work Pack?${hasInspections ? " WARNING: This Job Pack has assigned inspections which will also be deleted." : ""}`}
      />
    </div>
  );
}


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
      return <AttachmentUrlCell attachment={attachment} />
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <AttachmentActions row={row} />,
  },
];

export const globalAttachments: ColumnDef<ExtendedAttachment>[] = [
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ row }) => {
      const date: string = row.getValue("created_at");
      return <div>{moment(date).format("MMMM Do, YYYY")}</div>;
    },
  },
  {
    accessorKey: "source_name",
    header: "Source (Platform)",
    cell: ({ row }) => {
      const name = row.original.source_name || "Unknown";
      const type = row.original.source_type || "N/A";
      return (
        <div className="flex flex-col">
          <span className="font-bold text-xs">{name}</span>
          <span className="text-[10px] text-slate-500 uppercase">{type}</span>
        </div>
      );
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
      return <AttachmentUrlCell attachment={attachment} />
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <AttachmentActions row={row} />,
  },
];

function AttachmentActions({ row }: { row: any }) {
  const item = row.original;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      await fetcher(`/api/attachment?id=${item.id}`, { method: "DELETE" });
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/attachment/'));
      toast.success("Attachment deleted");
      setDeleteOpen(false);
    } catch (e) {
      toast.error("Failed to delete attachment");
    } finally {
      setLoading(false);
    }
  };

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
            className="cursor-pointer text-red-600 focus:text-red-700"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={16} className="mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        loading={loading}
        title="Delete Attachment"
        description="Are you sure you want to permanently delete this attachment? This action cannot be undone."
      />
    </div>
  );
}

function AttachmentUrlCell({ attachment }: { attachment: Attachment }) {
  const [showPreview, setShowPreview] = useState(false);
  const { fileUrl, fileName } = processAttachmentUrl(attachment);

  if (!fileUrl) {
    return <span className="text-gray-500 text-xs">No file URL</span>;
  }

  const displayText = truncateText(fileName, 30);

  // Check if file is likely an image based on common extensions
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 max-w-[200px] text-xs font-medium transition-colors"
          title={fileUrl}
        >
          <span className="truncate">{displayText}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70" />
        </a>

        {isImage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className={`h-7 px-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 transition-all
              ${showPreview
                ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700 hover:text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
          >
            <ImageIcon className="h-3 w-3" />
            {showPreview ? "Hide" : "Preview"}
          </Button>
        )}
      </div>

      {showPreview && isImage && (
        <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900/50 relative group">
          <div className="p-1 items-center justify-center flex max-h-[250px] overflow-hidden">
            <img
              src={fileUrl}
              alt={fileName}
              className="object-contain max-h-[240px] w-auto h-auto rounded-lg shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}


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
    cell: ({ row }) => <InspectionPlanningActions row={row} />,
  },
];

function InspectionPlanningActions({ row }: { row: any }) {
  const item = row.original;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      await fetcher(`/api/inspection-planning?id=${item.id}`, { method: "DELETE" });
      mutate("/api/inspection-planning");
      toast.success("Inspection plan decommissioned");
      setDeleteOpen(false);
    } catch (err) {
      toast.error("Failed to delete plan");
    } finally {
      setLoading(false);
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
            onClick={() => setDeleteOpen(true)}
            className="cursor-pointer rounded-xl m-1 py-2 font-bold text-xs gap-2 text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Decommission Plan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        loading={loading}
        title="Decommission Plan"
        description="Are you sure you want to decommission this inspection plan? This action will archive the current protocol parameters."
      />
    </div>
  );
}


export const inspectionTypeColumns: ColumnDef<InspectionType>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => (
      <div className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-white">
        {row.getValue("code") || "---"}
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Full Name" />,
    cell: ({ row }) => (
      <div className="font-bold text-xs text-slate-600 dark:text-slate-300">
        {row.getValue("name") || "Unnamed Type"}
      </div>
    ),
  },
  {
    accessorKey: "sname",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Short Name" />,
    cell: ({ row }) => (
      <span className="text-[10px] font-black px-2 py-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800">
        {row.getValue("sname") || "N/A"}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Registration Date" />,
    cell: ({ row }) => (
      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
        <Calendar className="h-3 w-3 opacity-50" />
        {row.getValue("created_at") ? moment(row.getValue("created_at")).format("DD MMM YYYY") : "---"}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

      return (
        <div className="text-right pr-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-2">Operations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer rounded-xl m-1 py-3 font-bold text-xs gap-3 focus:bg-slate-50 dark:focus:bg-slate-900"
                asChild
              >
                <Link href={`/dashboard/utilities/inspection-type/form?id=${item.id}`}>
                  <Edit2 className="h-4 w-4 text-blue-500" />
                  Modify Parameters
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-xl m-1 py-3 font-bold text-xs gap-3 text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                <Trash2 className="h-4 w-4" />
                Remove Type
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

