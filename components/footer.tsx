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
        <footer className="w-full flex items-center justify-center mx-auto text-center text-xs py-5 z-20">
        <p>
            © {new Date().getFullYear()}{" "}
            <a href="/" className="underline">
            NasQuest Resources Sdn Bhd
            </a>
        </p>
        </footer>
    );
}

export { Footer, DashboardFooter };