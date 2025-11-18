import { HomeNav } from "@/components/navigation";
import { Footer } from "@/components/footer";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 w-full flex flex-col">
      <HomeNav />
      <div className="flex grow flex-col p-5 z-10">{children}</div>
      <Footer />
    </div>
  );
}
