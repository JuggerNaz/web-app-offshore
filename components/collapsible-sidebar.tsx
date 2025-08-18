'use client'

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { DashboardMenu } from "./menu";
import { DashboardFooter } from "./footer";
import { settings } from "@/utils/settings";
import { Button } from "./ui/button";

export function CollapsibleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      isCollapsed ? 'min-w-[60px] w-[60px]' : 'min-w-[250px] w-[250px]'
    } ${settings.bgHeaderNavClassCommon} border-r border-r-foreground/10`}>
      <div className="flex items-center font-semibold p-5">
        {!isCollapsed && (
          <Link href={"/dashboard"} className="truncate">Web App Offshore</Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`cursor-pointer hover:bg-foreground/10 ${isCollapsed ? 'mx-auto' : 'ml-auto'}`}
        >
          {isCollapsed ? <Menu size={24} /> : <X size={24} />}
        </Button>
      </div>
      <div className="grow">
        <DashboardMenu isCollapsed={isCollapsed} />
      </div>
      {!isCollapsed && <DashboardFooter />}
    </div>
  );
}
