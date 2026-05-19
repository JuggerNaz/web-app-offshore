import { LeftSidebar } from "./components/layout/LeftSidebar";
import { RightSidebar } from "./components/layout/RightSidebar";
import { TopToolbar } from "./components/layout/TopToolbar";
import { Viewport3D } from "./components/layout/Viewport3D";

export default function DesignerPage() {
  return (
    <>
      <TopToolbar />
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <Viewport3D />
        <RightSidebar />
      </div>
    </>
  );
}
