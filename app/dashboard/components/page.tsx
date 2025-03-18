"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UnifiedComponentSpec } from "@/utils/types/database-types"
import Comments from '@/components/comment/comments'
import Attachments from '@/components/attachment/attachments'
import { cn } from "@/lib/utils"

type ComponentSpec = UnifiedComponentSpec;

const defaultSpec: ComponentSpec = {
  // Base registration fields
  componentId: '',
  registrationDate: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  status: 'active',
  componentType: 'PLATFORM',

  // Common fields
  qId: '',
  description: '',
  installDate: new Date().toISOString(),
  life: 0,
  installedType: '',
  material: '',
  fitting: '',
  part: '',

  // Location fields (both platform and pipeline)
  level: '',
  face: '',
  structuralGroup: '',
  position: '',
  startNode: '',
  startLeg: '',
  endNode: '',
  endLeg: '',
  elevation1: 0,
  elevation2: 0,
  distance: 0,
  clockPosition: '',

  // Component-specific fields
  anodeType: '',
  weight: 0,
  currentOutput: 0
}

const componentTypes = [
  "ALL COMPONENTS",
  "ANODE",
  "BOAT BUMPER",
  "BOAT FENDER",
  "BOLLARD FAIRLEAD",
  "BRACKET SUPPORT",
  "BUTT WELD",
  "CABLE TRAY",
  "CAISSON",
  "CAISSON GUARD",
  "CASTELLATED WELD",
  "CLAMP",
  "CONDUCTOR",
  "CONDUCTOR / CAISSON",
  "CONDUCTOR GUARD",
  "CONDUCTOR GUIDE FR",
  "CONICAL STUB",
  "CRANE",
  "CRANE PEDESTAL",
  "DECK PLATE",
  "DRILLING DERRICK",
  "ELECTRICAL CABLE",
  "FACE",
  "FLARE BOOM",
  "GRATING",
  "HATCH OR DOORWAY",
  "HELIPAD",
  "HORIZONTAL DIAGONAL",
  "HORIZONTAL MEMBER",
  "HOSE / FLEXIBLE RISER",
  "IMP. CURRENT ANODE"
];

export default function ComponentPage() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState(`step-${step}`);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSpecForm, setShowSpecForm] = useState(false);
  const [currentSpec, setCurrentSpec] = useState<ComponentSpec>(defaultSpec);

  const filteredComponents = componentTypes.filter(comp =>
    comp.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleComponentSelect = (comp: string) => {
    setSelectedComponent(comp);
    setShowSpecForm(true);
    // Here you would typically fetch the component's specifications
    // For now, we'll use dummy data
    setCurrentSpec({
      ...defaultSpec,
      qId: 'BAN101',
      description: 'BAN101',
      startNode: '101A',
      startLeg: 'B1',
      endNode: '101B',
      endLeg: 'A1',
      elevation1: -27.000,
      elevation2: -27.000,
      distance: 0.00,
      clockPosition: 'N/A',
      level: 'Level 4',
      face: 'Row 1',
      part: 'SUBSEA',
      componentId: 'AN/00101A-00101B/00000/00',
      installedType: 'TYPE A',
      material: 'ALUMIN',
      anodeType: 'ANODE TYPE A',
      fitting: 'BRACELET'
    });
  };

  // Update activeTab when step changes
  const handleNext = () => {
    const nextStep = Math.min(step + 1, 4);
    setStep(nextStep);
    setActiveTab(`step-${nextStep}`);
  };

  const handlePrevious = () => {
    const prevStep = Math.max(step - 1, 1);
    setStep(prevStep);
    setActiveTab(`step-${prevStep}`);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newStep = parseInt(value.split('-')[1]);
    setStep(newStep);
    setActiveTab(value);
  };

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl">Components {step > 1 ? `Management - Step ${step}` : ""}</h2>
        <p className="text-muted-foreground">Create and manage inspection components</p>
      </div>

      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="step-1">Component Selection</TabsTrigger>
            <TabsTrigger value="step-2" disabled={step < 2}>Component Details</TabsTrigger>
            <TabsTrigger value="step-3" disabled={step < 3}>Inspection History</TabsTrigger>
            <TabsTrigger value="step-4" disabled={step < 4}>Attachments</TabsTrigger>
          </TabsList>

          {/* Step 1: Component Selection */}
          <TabsContent value="step-1" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Component Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="componentType">Select Component Type</Label>
                    <Select defaultValue="ALL COMPONENTS">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select component type" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="searchComponent">Search Component</Label>
                    <Input
                      id="searchComponent"
                      placeholder="Search by Q ID or description"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Comp ID</TableHead>
                        <TableHead>Q ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Component Type</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComponents.slice(0, 5).map((comp, index) => (
                        <TableRow key={index} className="cursor-pointer hover:bg-muted" onClick={() => handleComponentSelect(comp)}>
                          <TableCell className="font-medium">COMP-{index + 1}</TableCell>
                          <TableCell>{`Q${index + 100}`}</TableCell>
                          <TableCell>{comp}</TableCell>
                          <TableCell>{comp}</TableCell>
                          <TableCell>{index % 2 === 0 ? 'TOPSIDE' : 'SUBSEA'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => handleComponentSelect(comp)}>
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleNext} disabled={!selectedComponent}>Next</Button>
            </div>
          </TabsContent>

          {/* Step 2: Component Details */}
          <TabsContent value="step-2" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Component Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="componentId">Component ID</Label>
                    <Input
                      id="componentId"
                      value={currentSpec.componentId}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, componentId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qId">Q ID</Label>
                    <Input
                      id="qId"
                      value={currentSpec.qId}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, qId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={currentSpec.description}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="componentType">Component Type</Label>
                    <Select
                      value={currentSpec.componentType}
                      onValueChange={(value) => setCurrentSpec({ ...currentSpec, componentType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select component type" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="material">Material</Label>
                    <Input
                      id="material"
                      value={currentSpec.material}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, material: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installedType">Installed Type</Label>
                    <Input
                      id="installedType"
                      value={currentSpec.installedType}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, installedType: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startNode">Start Node</Label>
                    <Input
                      id="startNode"
                      value={currentSpec.startNode}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, startNode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endNode">End Node</Label>
                    <Input
                      id="endNode"
                      value={currentSpec.endNode}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, endNode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="elevation1">Elevation 1</Label>
                    <Input
                      id="elevation1"
                      type="number"
                      value={currentSpec.elevation1}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, elevation1: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="elevation2">Elevation 2</Label>
                    <Input
                      id="elevation2"
                      type="number"
                      value={currentSpec.elevation2}
                      onChange={(e) => setCurrentSpec({ ...currentSpec, elevation2: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>Previous</Button>
              <Button onClick={handleNext}>Next</Button>
            </div>
          </TabsContent>

          {/* Step 3: Inspection History */}
          <TabsContent value="step-3" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Inspection History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inspection Date</TableHead>
                        <TableHead>Inspection Type</TableHead>
                        <TableHead>Inspection Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Findings</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>2023-05-15</TableCell>
                        <TableCell>General Visual</TableCell>
                        <TableCell>ROV</TableCell>
                        <TableCell>Completed</TableCell>
                        <TableCell>No anomalies</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2022-11-20</TableCell>
                        <TableCell>Close Visual</TableCell>
                        <TableCell>DIVING</TableCell>
                        <TableCell>Completed</TableCell>
                        <TableCell>Minor corrosion</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>2021-08-03</TableCell>
                        <TableCell>General Visual</TableCell>
                        <TableCell>ROV</TableCell>
                        <TableCell>Completed</TableCell>
                        <TableCell>No anomalies</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>Previous</Button>
              <Button onClick={handleNext}>Next</Button>
            </div>
          </TabsContent>

          {/* Step 4: Attachments */}
          <TabsContent value="step-4" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Attachments & Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="attachments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                  </TabsList>
                  <TabsContent value="attachments" className="mt-4">
                    <Attachments entityId={currentSpec.componentId || "temp-id"} entityType="component" />
                  </TabsContent>
                  <TabsContent value="comments" className="mt-4">
                    <Comments entityId={currentSpec.componentId || "temp-id"} entityType="component" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>Previous</Button>
              <Button onClick={() => alert("Component data saved!")}>Save</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
