'use client'
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Package, Calendar as CalendarIcon2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Define types for the structure data
interface Structure {
    title: string;
    fieldName: string;
    structureType: string;
}

// Define the planning data type
interface PlanningData {
    action: string;
    type: string;
    scope: {
        topside: boolean;
        subsea: boolean;
    };
    inspectionProgram: string;
    frequency: number;
    inspectionDate: Date;
    selectedStructures: Structure[];
    availableStructures: Structure[];
    inspectionMode: "ROV" | "DIVING";
}

export default function PlanningPage() {
    const [step, setStep] = useState(1)
    const [activeTab, setActiveTab] = useState(`step-${step}`)
    const [planningData, setPlanningData] = useState<PlanningData>({
        action: "",
        type: "",
        scope: {
            topside: false,
            subsea: false
        },
        inspectionProgram: "INSPN2003",
        frequency: 365,
        inspectionDate: new Date(),
        selectedStructures: [],
        availableStructures: [
            { title: "BNDP-A", fieldName: "BARONIA", structureType: "PLATFORM" },
            { title: "TKT-H", fieldName: "TUKAU", structureType: "PLATFORM" },
            { title: "TKK-A", fieldName: "TUKAU", structureType: "PLATFORM" },
            { title: "TKDP-B", fieldName: "TUKAU", structureType: "PLATFORM" },
            { title: "BODP-C", fieldName: "BOKOR", structureType: "PLATFORM" },
            { title: "BNJT-H", fieldName: "BARONIA", structureType: "PLATFORM" },
            { title: "12\" PC4DPA-B11DRA", fieldName: "PC-4", structureType: "PIPELINE" },
            { title: "AJUT-A", fieldName: "ANJUNG", structureType: "PLATFORM" },
            { title: "AJUT-A-1", fieldName: "AJUT-A", structureType: "PLATFORM" },
            { title: "ASSAM PAYA", fieldName: "ASSAM PAYA", structureType: "PLATFORM" },
            { title: "B11DR-A", fieldName: "B11", structureType: "PLATFORM" },
            { title: "B11K-A", fieldName: "B11", structureType: "PLATFORM" },
            { title: "B11P-A", fieldName: "B11", structureType: "PLATFORM" }
        ],
        inspectionMode: "ROV", // ROV or DIVING
    })

    // Update activeTab when step changes
    useEffect(() => {
        setActiveTab(`step-${step}`)
    }, [step])

    const handleNext = () => {
        const nextStep = Math.min(step + 1, 4)
        setStep(nextStep)
    }

    const handlePrevious = () => {
        const prevStep = Math.max(step - 1, 1)
        setStep(prevStep)
    }

    const handleSubmit = () => {
        console.log("Planning data submitted:", planningData)
        // Here you would typically save the data to your database
        alert("Planning created successfully!")
        setStep(1)
    }

    const addStructure = (structure: Structure) => {
        setPlanningData({
            ...planningData,
            selectedStructures: [...planningData.selectedStructures, structure]
        })
    }

    const removeStructure = (index: number) => {
        const updatedStructures = [...planningData.selectedStructures]
        updatedStructures.splice(index, 1)
        setPlanningData({
            ...planningData,
            selectedStructures: updatedStructures
        })
    }

    // Handle tab change
    const handleTabChange = (value: string) => {
        const newStep = parseInt(value.split('-')[1])
        setStep(newStep)
        setActiveTab(value)
    }

    return (
        <div className="flex-1 w-full flex flex-col">
            <div className="flex flex-col items-start">
                <h2 className="font-bold text-2xl">Planning {step > 1 ? `Creation - Step ${step}` : ""}</h2>
                <p className="text-muted-foreground">Create and manage inspection plans</p>
            </div>

            <div className="mt-4">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="step-1">Initial Selection</TabsTrigger>
                        <TabsTrigger value="step-2" disabled={step < 2}>Planning Details</TabsTrigger>
                        <TabsTrigger value="step-3" disabled={step < 3}>Structure Selection</TabsTrigger>
                        <TabsTrigger value="step-4" disabled={step < 4}>Inspection Mode</TabsTrigger>
                    </TabsList>

                    {/* Step 1: Initial Selection */}
                    <TabsContent value="step-1" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Action</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <RadioGroup
                                        value={planningData.action}
                                        onValueChange={(value: string) => setPlanningData({ ...planningData, action: value })}
                                    >
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="createNew" id="createNew" />
                                            <Label htmlFor="createNew">Create New</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="modifyPlan" id="modifyPlan" />
                                            <Label htmlFor="modifyPlan">Modify Plan</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="deletePlan" id="deletePlan" />
                                            <Label htmlFor="deletePlan">Delete Plan</Label>
                                        </div>
                                    </RadioGroup>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Type</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <RadioGroup
                                        value={planningData.type}
                                        onValueChange={(value: string) => setPlanningData({ ...planningData, type: value })}
                                    >
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="structure" id="structure" />
                                            <Label htmlFor="structure">Structure</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="componentType" id="componentType" />
                                            <Label htmlFor="componentType">Component Type</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="component" id="component" />
                                            <Label htmlFor="component">Component</Label>
                                        </div>
                                    </RadioGroup>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Scope</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="topside"
                                            checked={planningData.scope.topside}
                                            onCheckedChange={(checked) =>
                                                setPlanningData({
                                                    ...planningData,
                                                    scope: { ...planningData.scope, topside: checked === true }
                                                })
                                            }
                                        />
                                        <Label htmlFor="topside">Topside</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="subsea"
                                            checked={planningData.scope.subsea}
                                            onCheckedChange={(checked) =>
                                                setPlanningData({
                                                    ...planningData,
                                                    scope: { ...planningData.scope, subsea: checked === true }
                                                })
                                            }
                                        />
                                        <Label htmlFor="subsea">Subsea</Label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {planningData.action === 'modifyPlan' && (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-blue-500">Modify Plan of status PENDING</p>
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={handleNext}>Next</Button>
                        </div>
                    </TabsContent>

                    {/* Step 2: Planning Details */}
                    <TabsContent value="step-2" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Planning Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="inspectionProgram">Inspection Program</Label>
                                        <div className="flex">
                                            <Select
                                                value={planningData.inspectionProgram}
                                                onValueChange={(value: string) => setPlanningData({ ...planningData, inspectionProgram: value })}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select program" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INSPN2003">INSPN2003</SelectItem>
                                                    <SelectItem value="INSPN2004">INSPN2004</SelectItem>
                                                    <SelectItem value="INSPN2005">INSPN2005</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" size="icon" className="ml-2">
                                                <span className="sr-only">Open options</span>
                                                <span>...</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Frequency</Label>
                                        <div className="flex items-center">
                                            <Input
                                                id="frequency"
                                                type="number"
                                                value={planningData.frequency}
                                                onChange={(e) => setPlanningData({ ...planningData, frequency: parseInt(e.target.value) })}
                                            />
                                            <span className="ml-2">Days</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="inspectionDate">Inspection Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {planningData.inspectionDate ? (
                                                        format(planningData.inspectionDate, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={planningData.inspectionDate}
                                                    onSelect={(date: Date | undefined) => date && setPlanningData({ ...planningData, inspectionDate: date })}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handlePrevious}>Previous</Button>
                            <Button onClick={handleNext}>Next</Button>
                        </div>
                    </TabsContent>

                    {/* Step 3: Structure Selection */}
                    <TabsContent value="step-3" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Selected Structure List</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md mb-4">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Structure Title</th>
                                                <th className="text-left p-2">Field Name</th>
                                                <th className="text-left p-2">Structure Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {planningData.selectedStructures.map((structure, index) => (
                                                <tr key={index} className={index === 0 ? "bg-muted" : ""}>
                                                    <td className="p-2">{structure.title}</td>
                                                    <td className="p-2">{structure.fieldName}</td>
                                                    <td className="p-2">{structure.structureType}</td>
                                                </tr>
                                            ))}
                                            {planningData.selectedStructures.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="p-2 text-center text-muted-foreground">No structures selected</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-sm text-muted-foreground mb-2">
                                    Select the Structure and click to add to the list above
                                </p>

                                <div className="border rounded-md">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Structure Title</th>
                                                <th className="text-left p-2">Field Name</th>
                                                <th className="text-left p-2">Structure Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {planningData.availableStructures.map((structure, index) => (
                                                <tr
                                                    key={index}
                                                    className="cursor-pointer hover:bg-muted"
                                                    onClick={() => addStructure(structure)}
                                                >
                                                    <td className="p-2">{structure.title}</td>
                                                    <td className="p-2">{structure.fieldName}</td>
                                                    <td className="p-2">{structure.structureType}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="flex justify-between p-2 border-t">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                if (planningData.selectedStructures.length > 0) {
                                                    removeStructure(planningData.selectedStructures.length - 1)
                                                }
                                            }}
                                            disabled={planningData.selectedStructures.length === 0}
                                        >
                                            Delete
                                        </Button>
                                        <div className="flex gap-2">
                                            <Input placeholder="Search Structure Title" className="w-64" />
                                            <Button variant="outline">Refresh</Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handlePrevious}>Previous</Button>
                            <Button onClick={handleNext}>Next</Button>
                        </div>
                    </TabsContent>

                    {/* Step 4: Inspection Mode Selection */}
                    <TabsContent value="step-4" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Inspection Mode</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup
                                    value={planningData.inspectionMode}
                                    onValueChange={(value: "ROV" | "DIVING") => setPlanningData({ ...planningData, inspectionMode: value })}
                                    className="space-y-4"
                                >
                                    <div className="flex items-start space-x-4 p-4 border rounded-md">
                                        <RadioGroupItem value="ROV" id="rov" className="mt-1" />
                                        <div>
                                            <Label htmlFor="rov" className="text-base font-medium">ROV Mode</Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                For ROV inspection, system will be connected to ROV (Remote Operating Vehicle) system to fetch the current location data and will auto insert into the inspection records.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start space-x-4 p-4 border rounded-md">
                                        <RadioGroupItem value="DIVING" id="diving" className="mt-1" />
                                        <div>
                                            <Label htmlFor="diving" className="text-base font-medium">DIVING Mode</Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                For Diving inspection, diver will go to under water and do the inspection. RC (Report Coordinator) will key in data into the system.
                                            </p>
                                        </div>
                                    </div>
                                </RadioGroup>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Inspection Data Tables</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border rounded-md p-3">
                                        <h4 className="font-medium mb-2">Primary Tables</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            <li>Structure details</li>
                                            <li>Component details</li>
                                            <li>Jobpack details</li>
                                            <li>Assigned Inspection Type details</li>
                                        </ul>
                                    </div>
                                    <div className="border rounded-md p-3">
                                        <h4 className="font-medium mb-2">Inspection Data Tables</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            <li>ROV Inspection Tables (platgi, navig)</li>
                                            <li>DIVING Inspection Tables</li>
                                            <li>Logs (ROV, Diver, Vessel activity)</li>
                                            <li>Defects / Anomalies</li>
                                            <li>Attachments (Photos, Videos, Memos)</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handlePrevious}>Previous</Button>
                            <Button onClick={handleSubmit}>Finish</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
} 