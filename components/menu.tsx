import {
    ChevronLeft,
    ChevronRight,
    Copy,
    CreditCard,
    File,
    Home,
    LineChart,
    ListFilter,
    MoreVertical,
    Package,
    Package2,
    PanelLeft,
    Search,
    Settings,
    ShoppingCart,
    Truck,
    Users2,
    BrickWall,
    Menu,
    Layers2
} from "lucide-react"
import Link from "next/link";

const DashboardMenu = () => {
    return (
        <nav className="flex flex-col items-center gap-3 px-5 mt-10">
            <MenuLink href="/dashboard">
                <Home size={20} />
                Dashboard
            </MenuLink>
            <MenuLink href="/dashboard/structure">
                <BrickWall size={20} />
                Structure
            </MenuLink>
            <div className="flex flex-col gap-1 w-[90%] overflow-hidden">
                <MenuLink href="/dashboard/structure/platform">
                    <Layers2 size={20} />
                    Platform
                </MenuLink>
                <MenuLink href="/dashboard/structure/pipeline">
                    <Layers2 size={20} />
                    Pipeline
                </MenuLink>
            </div>
            <MenuLink href="/dashboard/components">
                <Package size={20} />
                Components
            </MenuLink>
            <MenuLink href="/dashboard/job-pack">
                <Package size={20} />
                 Job Pack
            </MenuLink>
        </nav>
    );
}

type Props = {
    href: string;
    children: React.ReactNode;
}

const MenuLink = (props: Props) => {
    return (
        <Link
            href={props.href}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground w-full"
        >
            {props.children}
        </Link>
    );
}

export { DashboardMenu };