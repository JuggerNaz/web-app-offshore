"use server";

import Link from "next/link";
import HeaderAuth from "./header-auth";
import { User } from "@/app/dashboard/user";
import { DynamicBreadcrumb } from "./breadcrumb";

const HomeNav = () => (
  <nav className="w-full flex bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-10 shadow-md border-b border-b-foreground/10 h-16 z-20">
    <div className="w-full flex justify-between items-center p-3 px-5 text-sm">
      <div className="flex gap-5 items-center font-semibold">
        <Link href={"/"}>Web App Offshore</Link>
      </div>
      <HeaderAuth />
    </div>
  </nav>
);

const DashboardNav = () => (
  <nav className="w-full flex border-b border-b-foreground/10 h-16 z-20">
    <div className="w-full flex justify-between items-center p-3 px-5 text-sm">
      <DynamicBreadcrumb />
      <User />
    </div>
  </nav>
);

export { HomeNav, DashboardNav };
