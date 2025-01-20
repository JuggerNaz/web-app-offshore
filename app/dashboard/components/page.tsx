"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UnifiedComponentSpec } from "@/utils/types/database-types"

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

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl mb-4">Components</h2>
      </div>

      <div className="container mx-auto py-6">
        <div className="border rounded-md bg-card">
          <div className="flex">
            {/* Left Sidebar */}
            <div className="w-64 bg-secondary text-secondary-foreground">
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search Q ID"
                  className="w-full p-2 rounded bg-muted text-muted-foreground placeholder:text-muted-foreground/60 border-input text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="font-bold mb-2 px-4 text-sm">Components List</div>
              <div className="h-[calc(100vh-350px)] overflow-y-auto">
                {filteredComponents.map((comp) => (
                  <button
                    key={comp}
                    className={`w-full text-left px-4 py-1.5 cursor-pointer transition-colors text-xs
                      ${selectedComponent === comp 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    onClick={() => handleComponentSelect(comp)}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-background">
              <div className="p-6">
                {selectedComponent && !showSpecForm ? (
                  <div className="w-full overflow-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Comp ID</TableHead>
                          <TableHead className="whitespace-nowrap">Q ID</TableHead>
                          <TableHead className="whitespace-nowrap">Description</TableHead>
                          <TableHead className="whitespace-nowrap">Component Type</TableHead>
                          <TableHead className="whitespace-nowrap">S Node</TableHead>
                          <TableHead className="whitespace-nowrap">E Node</TableHead>
                          <TableHead className="whitespace-nowrap">S Leg</TableHead>
                          <TableHead className="whitespace-nowrap">E Leg</TableHead>
                          <TableHead className="whitespace-nowrap">Elevation 1</TableHead>
                          <TableHead className="whitespace-nowrap">Elevation 2</TableHead>
                          <TableHead className="whitespace-nowrap">Distance</TableHead>
                          <TableHead className="whitespace-nowrap">Clock Pos</TableHead>
                          <TableHead className="whitespace-nowrap w-[100px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Input 
                              placeholder="Enter Comp ID"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="Enter Q ID"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="Enter Description"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <select className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm">
                              <option value="">Select Type</option>
                              {componentTypes.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="S Node"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="E Node"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="S Leg"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="E Leg"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number"
                              placeholder="Elevation 1"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number"
                              placeholder="Elevation 2"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number"
                              placeholder="Distance"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="Clock Pos"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button size="sm" className="w-full h-8">
                              Add
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{currentSpec.componentId}</TableCell>
                          <TableCell>{currentSpec.qId}</TableCell>
                          <TableCell>{currentSpec.description}</TableCell>
                          <TableCell>{selectedComponent}</TableCell>
                          <TableCell>{currentSpec.startNode}</TableCell>
                          <TableCell>{currentSpec.endNode}</TableCell>
                          <TableCell>{currentSpec.startLeg}</TableCell>
                          <TableCell>{currentSpec.endLeg}</TableCell>
                          <TableCell>{currentSpec.elevation1}</TableCell>
                          <TableCell>{currentSpec.elevation2}</TableCell>
                          <TableCell>{currentSpec.distance}</TableCell>
                          <TableCell>{currentSpec.clockPosition}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="w-full h-8">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>AN/00102A-00102B/00000/00</TableCell>
                          <TableCell>BAN102</TableCell>
                          <TableCell>BAN102</TableCell>
                          <TableCell>ANODE</TableCell>
                          <TableCell>102A</TableCell>
                          <TableCell>102B</TableCell>
                          <TableCell>B1</TableCell>
                          <TableCell>A1</TableCell>
                          <TableCell>-27.000</TableCell>
                          <TableCell>-27.000</TableCell>
                          <TableCell>0.00</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="w-full h-8">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>AN/00103A-00103B/00000/00</TableCell>
                          <TableCell>BAN103</TableCell>
                          <TableCell>BAN103</TableCell>
                          <TableCell>ANODE</TableCell>
                          <TableCell>103A</TableCell>
                          <TableCell>103B</TableCell>
                          <TableCell>B2</TableCell>
                          <TableCell>A2</TableCell>
                          <TableCell>-28.000</TableCell>
                          <TableCell>-28.000</TableCell>
                          <TableCell>0.00</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="w-full h-8">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>AN/00104A-00104B/00000/00</TableCell>
                          <TableCell>BAN104</TableCell>
                          <TableCell>BAN104</TableCell>
                          <TableCell>ANODE</TableCell>
                          <TableCell>104A</TableCell>
                          <TableCell>104B</TableCell>
                          <TableCell>B3</TableCell>
                          <TableCell>A3</TableCell>
                          <TableCell>-29.000</TableCell>
                          <TableCell>-29.000</TableCell>
                          <TableCell>0.00</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="w-full h-8">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : showSpecForm ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-medium">Component Specifications</h3>
                      <Button variant="outline" onClick={() => setShowSpecForm(false)}>
                        Back to List
                      </Button>
                    </div>

                    <Tabs defaultValue="specifications" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="specifications">Specifications</TabsTrigger>
                        <TabsTrigger value="specifications2">Specifications 2</TabsTrigger>
                        <TabsTrigger value="comments">Comments</TabsTrigger>
                        <TabsTrigger value="attachments">Attachments</TabsTrigger>
                      </TabsList>

                      <TabsContent value="specifications" className="border rounded-lg p-4 mt-4">
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Q Id</Label>
                              <Input 
                                value={currentSpec.qId}
                                onChange={(e) => setCurrentSpec({...currentSpec, qId: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Input 
                                value={currentSpec.description}
                                onChange={(e) => setCurrentSpec({...currentSpec, description: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label>Start Node</Label>
                              <Input 
                                value={currentSpec.startNode}
                                onChange={(e) => setCurrentSpec({...currentSpec, startNode: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Start Leg</Label>
                              <Input 
                                value={currentSpec.startLeg}
                                onChange={(e) => setCurrentSpec({...currentSpec, startLeg: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Elevation 1</Label>
                              <Input 
                                type="number"
                                value={currentSpec.elevation1}
                                onChange={(e) => setCurrentSpec({...currentSpec, elevation1: parseFloat(e.target.value)})}
                              />
                            </div>
                            <div>
                              <Label>Distance</Label>
                              <Input 
                                type="number"
                                value={currentSpec.distance}
                                onChange={(e) => setCurrentSpec({...currentSpec, distance: parseFloat(e.target.value)})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label>End Node</Label>
                              <Input 
                                value={currentSpec.endNode}
                                onChange={(e) => setCurrentSpec({...currentSpec, endNode: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>End Leg</Label>
                              <Input 
                                value={currentSpec.endLeg}
                                onChange={(e) => setCurrentSpec({...currentSpec, endLeg: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Elevation 2</Label>
                              <Input 
                                type="number"
                                value={currentSpec.elevation2}
                                onChange={(e) => setCurrentSpec({...currentSpec, elevation2: parseFloat(e.target.value)})}
                              />
                            </div>
                            <div>
                              <Label>Clock Position</Label>
                              <Input 
                                value={currentSpec.clockPosition}
                                onChange={(e) => setCurrentSpec({...currentSpec, clockPosition: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Level</Label>
                              <Input 
                                value={currentSpec.level}
                                onChange={(e) => setCurrentSpec({...currentSpec, level: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Face</Label>
                              <Input 
                                value={currentSpec.face}
                                onChange={(e) => setCurrentSpec({...currentSpec, face: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Part</Label>
                              <Input 
                                value={currentSpec.part}
                                onChange={(e) => setCurrentSpec({...currentSpec, part: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Structural Group</Label>
                              <Input 
                                value={currentSpec.structuralGroup}
                                onChange={(e) => setCurrentSpec({...currentSpec, structuralGroup: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Component Id</Label>
                              <Input 
                                value={currentSpec.componentId}
                                onChange={(e) => setCurrentSpec({...currentSpec, componentId: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Install Date</Label>
                              <Input 
                                type="date"
                                value={currentSpec.installDate}
                                onChange={(e) => setCurrentSpec({...currentSpec, installDate: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Life (years)</Label>
                              <Input 
                                type="number"
                                value={currentSpec.life}
                                onChange={(e) => setCurrentSpec({...currentSpec, life: parseInt(e.target.value)})}
                              />
                            </div>
                            <div>
                              <Label>Position</Label>
                              <Input 
                                value={currentSpec.position}
                                onChange={(e) => setCurrentSpec({...currentSpec, position: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Material</Label>
                              <Input 
                                value={currentSpec.material}
                                onChange={(e) => setCurrentSpec({...currentSpec, material: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Fitting</Label>
                              <Input 
                                value={currentSpec.fitting}
                                onChange={(e) => setCurrentSpec({...currentSpec, fitting: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Anode Type</Label>
                              <Input 
                                value={currentSpec.anodeType}
                                onChange={(e) => setCurrentSpec({...currentSpec, anodeType: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="specifications2" className="border rounded-lg p-4 mt-4">
                        <div className="space-y-6">
                          <div className="border rounded-lg p-4 bg-[#0a2534] text-white">
                            <h3 className="text-sm mb-6">Associate Component to other Component:</h3>
                            
                            <div className="flex items-center gap-4 mb-4">
                              <Label className="text-white">Associated to:</Label>
                              <div className="flex-1">
                                <Input 
                                  placeholder="Enter associated component"
                                  className="bg-white text-black h-8"
                                  value="R1-SK017-BADP-A"
                                />
                              </div>
                              <Button variant="secondary" size="sm" className="h-8">
                                ...
                              </Button>
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button variant="outline">
                              Cancel
                            </Button>
                            <Button>
                              OK
                            </Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="comments" className="border rounded-lg p-4 mt-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Comments History</h4>
                            <Button>
                              Add Comment
                            </Button>
                          </div>
                          
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead className="w-[50%]">Comment</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>2024-12-09</TableCell>
                                <TableCell>John Doe</TableCell>
                                <TableCell>Initial inspection completed</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2024-12-08</TableCell>
                                <TableCell>Jane Smith</TableCell>
                                <TableCell>Maintenance check performed - all parameters within normal range</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2024-12-07</TableCell>
                                <TableCell>Mike Johnson</TableCell>
                                <TableCell>Surface corrosion detected on north face - scheduled for treatment</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2024-12-06</TableCell>
                                <TableCell>Sarah Wilson</TableCell>
                                <TableCell>Updated technical specifications after replacement</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="attachments" className="border rounded-lg p-4 mt-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Attached Files</h4>
                            <Button>
                              Add Attachment
                            </Button>
                          </div>
                          
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>File Name</TableHead>
                                <TableHead>Upload Date</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>technical-drawing-rev2.pdf</TableCell>
                                <TableCell>2024-12-09</TableCell>
                                <TableCell>2.5 MB</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="ghost" size="sm">
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>inspection-report-2024.docx</TableCell>
                                <TableCell>2024-12-08</TableCell>
                                <TableCell>1.8 MB</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="ghost" size="sm">
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>maintenance-photos-dec.zip</TableCell>
                                <TableCell>2024-12-07</TableCell>
                                <TableCell>15.2 MB</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="ghost" size="sm">
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>component-specs-original.pdf</TableCell>
                                <TableCell>2024-12-06</TableCell>
                                <TableCell>3.7 MB</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="ghost" size="sm">
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>safety-assessment.pdf</TableCell>
                                <TableCell>2024-12-05</TableCell>
                                <TableCell>1.2 MB</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="ghost" size="sm">
                                      View
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      Download
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end space-x-4 mt-6">
                      <Button variant="outline" onClick={() => setShowSpecForm(false)}>
                        Cancel
                      </Button>
                      <Button>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground mt-10">
                    Select a component from the list to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
