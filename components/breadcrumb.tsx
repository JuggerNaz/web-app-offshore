// components/breadcrumb.tsx
"use client";

import React from "react";
import { usePathname } from "next/navigation";
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

  // Helper function to generate breadcrumb items
  const generateBreadcrumbs = () => {
    const paths = pathname.split("/").filter((path) => path !== "");
    const breadcrumbs = paths.map((path, index) => {
      const href = `/${paths.slice(0, index + 1).join("/")}`;
      return {
        href,
        label: path.charAt(0).toUpperCase() + path.slice(1),
        isCurrent: index === paths.length - 1,
      };
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => (
          <React.Fragment key={breadcrumb.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {breadcrumb.isCurrent ? (
                <BreadcrumbPage className="font-bold text-lg">{breadcrumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={breadcrumb.href}>{breadcrumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
