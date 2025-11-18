import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { urlId, urlType } from "@/utils/client-state";
import { useAtom } from "jotai";
import { components } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { Plus } from "lucide-react";

// Mock data for components
const mockComponentsData = [
  {
    comp_id: "COMP-001",
    description: "Primary structural beam - North section",
    component_type: "Structural",
  },
  {
    comp_id: "COMP-002",
    description: "Hydraulic valve assembly - Main deck",
    component_type: "Mechanical",
  },
  {
    comp_id: "COMP-003",
    description: "Power distribution panel - Control room",
    component_type: "Electrical",
  },
  {
    comp_id: "COMP-004",
    description: "Safety relief valve - Pipeline section A",
    component_type: "Safety",
  },
  {
    comp_id: "COMP-005",
    description: "Corrosion protection system - Hull",
    component_type: "Protection",
  },
];

export default function Components() {
  const [pageId, setPageId] = useAtom(urlId);
  const [pageType, setPageType] = useAtom(urlType);

  return (
    <TabsContent value="components" className=" p-4 mt-4">
      <DataTable
        columns={components}
        data={mockComponentsData}
        disableRowClick={true}
        toolbarActions={
          <Button size="sm" variant="outline" className="h-8">
            <Plus className="h-4 w-4 mr-2" />
            Component
          </Button>
        }
      />
    </TabsContent>
  );
}
