const Footer = () => {
    return (
        <footer className="w-full flex items-center justify-center mx-auto text-center text-xs gap-8 py-16 z-20">
        <p>
            © {new Date().getFullYear()}{" "}
            <a href="/" className="underline">
            NasQuest Resources Sdn Bhd
            </a>
        </p>
        </footer>
    );
}

const DashboardFooter = () => {
    return (
        <footer className="w-full px-4 py-4">
            <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground text-center">
                    © {new Date().getFullYear()}{" "}
                    <a 
                        href="/" 
                        className="font-medium hover:text-foreground transition-colors"
                    >
                        NasQuest Resources
                    </a>
                </p>
            </div>
        </footer>
    );
}

export { Footer, DashboardFooter };