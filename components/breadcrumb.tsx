// components/breadcrumb.tsx
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function DynamicBreadcrumb() {
  const pathname = usePathname();

  const paths = pathname.split("/").filter((path) => path !== "");

  // Detect structure detail pages like /dashboard/field/platform/123
  const isStructureDetail =
    paths.length >= 4 &&
    paths[0] === "dashboard" &&
    paths[1] === "field" &&
    (paths[2] === "platform" || paths[2] === "pipeline");

  const structureType = isStructureDetail ? (paths[2] as "platform" | "pipeline") : null;
  const structureId = isStructureDetail ? paths[3] : null;

  const { data: structureResponse } = useSWR(
    structureType && structureId && structureId !== "new"
      ? `/api/${structureType}/${structureId}`
      : null,
    fetcher
  );

  const structureTitle: string | undefined = structureResponse?.data?.title;

  // Helper function to generate breadcrumb items
  const generateBreadcrumbs = () => {
    const breadcrumbs = paths.map((path, index) => {
      const href = `/${paths.slice(0, index + 1).join("/")}`;

      let label = path.charAt(0).toUpperCase() + path.slice(1);

      // Replace ID segment with platform/pipeline title when available
      if (isStructureDetail && index === 3) {
        if (structureTitle) {
          label = structureTitle;
        } else if (path === "new") {
          label = "New";
        }
      }

      return {
        href,
        label,
        isCurrent: index === paths.length - 1,
      };
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <Breadcrumb className="animate-in fade-in slide-in-from-left-2 duration-500">
      <BreadcrumbList className="gap-1.5 sm:gap-3">
        {breadcrumbs.map((breadcrumb, index) => (
          <React.Fragment key={breadcrumb.href}>
            {index > 0 && (
              <BreadcrumbSeparator className="[&>svg]:size-3.5 text-slate-300 dark:text-slate-700" />
            )}
            <BreadcrumbItem>
              {breadcrumb.isCurrent ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-blue-600 rounded-full hidden sm:block" />
                  <BreadcrumbPage className="font-black text-xl sm:text-2xl tracking-tighter text-slate-900 dark:text-slate-100 uppercase">
                    {breadcrumb.label}
                  </BreadcrumbPage>
                </div>
              ) : (
                <BreadcrumbLink
                  href={breadcrumb.href}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                >
                  {breadcrumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
