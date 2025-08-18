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
    Layers2,
    Calendar
} from "lucide-react"
import Link from "next/link";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const DashboardMenu = ({ isCollapsed }: { isCollapsed?: boolean }) => {
    return (
        <TooltipProvider>
            <nav className={`flex flex-col items-center gap-3 mt-10 ${isCollapsed ? 'px-2' : 'px-5'}`}>
                <MenuLink 
                    href="/dashboard" 
                    isCollapsed={isCollapsed} 
                    label="Dashboard"
                    icon={<Home size={20} />}
                    text="Dashboard"
                />
                <MenuLink 
                    href="/dashboard/structure" 
                    isCollapsed={isCollapsed} 
                    label="Structure"
                    icon={<BrickWall size={20} />}
                    text="Structure"
                />
                {!isCollapsed && (
                    <div className="flex flex-col gap-1 w-[90%] overflow-hidden">
                        <MenuLink 
                            href="/dashboard/structure/platform" 
                            isCollapsed={isCollapsed} 
                            label="Platform"
                            icon={<Layers2 size={20} />}
                            text="Platform"
                        />
                        <MenuLink 
                            href="/dashboard/structure/pipeline" 
                            isCollapsed={isCollapsed} 
                            label="Pipeline"
                            icon={<Layers2 size={20} />}
                            text="Pipeline"
                        />
                    </div>
                )}
                <MenuLink 
                    href="/dashboard/components" 
                    isCollapsed={isCollapsed} 
                    label="Components"
                    icon={<Package size={20} />}
                    text="Components"
                />
                <MenuLink 
                    href="/dashboard/jobpack" 
                    isCollapsed={isCollapsed} 
                    label="Job Pack"
                    icon={<Package size={20} />}
                    text="Job Pack"
                />
                <MenuLink 
                    href="/dashboard/planning" 
                    isCollapsed={isCollapsed} 
                    label="Inspection Planning"
                    icon={<Calendar size={20} />}
                    text="Inspection Planning"
                />
            </nav>
        </TooltipProvider>
    );
}

type Props = {
    href: string;
    isCollapsed?: boolean;
    label: string;
    icon: React.ReactNode;
    text: string;
}

const MenuLink = (props: Props) => {
    const linkContent = (
        <Link
            href={props.href}
            className={`flex items-center transition-all duration-200 hover:text-foreground text-muted-foreground hover:scale-105 ${
                props.isCollapsed 
                    ? 'justify-center p-3 rounded-lg hover:bg-foreground/10 w-full min-h-[48px] aspect-square' 
                    : 'gap-3 w-full p-3 rounded-lg hover:bg-foreground/10'
            }`}
        >
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                {props.icon}
            </span>
            {!props.isCollapsed && (
                <span className="font-medium transition-opacity duration-200">
                    {props.text}
                </span>
            )}
        </Link>
    );

    if (props.isCollapsed) {
        return (
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className="w-full flex justify-center">
                        {linkContent}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    <p className="font-medium">{props.label}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return linkContent;
}

export { DashboardMenu };