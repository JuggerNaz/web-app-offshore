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
} from "lucide-react"
import Link from "next/link";

const DashboardMenu = () => {
    return (
        <nav className="flex flex-col items-center gap-4 px-5 mt-10">
            {MenuLink("Dashboard", "/dashboard", <Home size={20} />)}
            {MenuLink("Components", "/dashboard/components", <Package size={20} />)}
            {/* {MenuLink("Users", "/dashboard/users", <Users2 size={20} />)} */}
            
            {/* <Users2 size={24} />
            <ShoppingCart size={24} />
            <CreditCard size={24} />
            <Truck size={24} />
            <Package size={24} />
            <Package2 size={24} />
            <LineChart size={24} />
            <ListFilter size={24} />
            <Settings size={24} />
            <PanelLeft size={24} />
            <Search size={24} />
            <MoreVertical size={24} />
            <File size={24} />
            <Copy size={24} />
            <ChevronLeft size={24} />
            <ChevronRight size={24} /> */}
        </nav>
    );
}

const MenuLink = (text: string, url: string, children: React.ReactNode) => {
    return (
        <Link
            href={url}
            className="flex items-center gap-2 rounded-lg text-muted-foreground transition-colors hover:text-foreground w-full"
        >
            {children}
            {text}
        </Link>
    );
}

export { DashboardMenu };