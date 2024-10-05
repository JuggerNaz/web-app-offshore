import { DashboardNav } from "@/components/navigation";
import { DashboardFooter } from "@/components/footer";
import Link from "next/link";
import { settings } from "@/utils/settings";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden">
        <div className="flex">
        <div className={`w-[250px] h-screen ${settings.bgHeaderNavClassCommon} border-r border-r-foreground/10`}>
            <div className="flex items-center font-semibold p-5">
                <Link href={"/dashboard"}>Web App Offshore</Link>
            </div>
        </div>
        <div className="grow">
            <div className="flex flex-col h-screen">
                <DashboardNav />
                <div className="grow flex-col p-5 z-10">
                    {children}
                </div>
                <DashboardFooter />
            </div>
        </div>
        </div>
    </div>
  );
}