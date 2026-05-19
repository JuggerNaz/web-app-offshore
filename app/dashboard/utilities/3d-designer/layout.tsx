import { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Designer | Offshore Web App",
  description: "3D structural component designer and editor.",
};

export default function DesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col bg-background">
      {children}
    </div>
  );
}
