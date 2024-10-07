import { DashboardNav } from "@/components/navigation";
import { DashboardFooter } from "@/components/footer";
import Link from "next/link";
import { settings } from "@/utils/settings";
import { Menu } from "lucide-react";
import { DashboardMenu } from "@/components/menu";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }
  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden">
        <div className="flex">
        <div className={`flex flex-col w-[250px] h-screen ${settings.bgHeaderNavClassCommon} border-r border-r-foreground/10`}>
            <div className="flex items-center font-semibold p-5">
                <Link href={"/dashboard"}>Web App Offshore</Link>
                <Menu size={24} className="ml-auto cursor-pointer" />
            </div>
            <div className="grow">
              <DashboardMenu />
            </div>
            <DashboardFooter />
        </div>
        <div className="grow">
            <div className="flex flex-col h-screen">
                <DashboardNav />
                <div className="grow flex-col p-5 z-10">
                    {children}
                </div>
            </div>
        </div>
        </div>
    </div>
  );
}