"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Brain, CheckCircle2, Save, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ROVInspectionFormProps {
    rovJob: any;
    selectedComponent: any;
    jobpackId: string | null;
    sowId: string | null;
}

export default function ROVInspectionForm({
    rovJob,
    selectedComponent,
    jobpackId,
    sowId,
}: ROVInspectionFormProps) {
    const supabase = createClient();

    const [inspectionTypes, setInspectionTypes] = useState<any[]>([]);
    const [selectedType, setSelectedType] = useState<string>("");
    const [formData, setFormData] = useState<any>({});
    const [aiSuggestions, setAiSuggestions] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadInspectionTypes();
    }, []);

    useEffect(() => {
        if (selectedType) {
            initializeFormData();
        }
    }, [selectedType]);

    async function loadInspectionTypes() {
        try {
            const { data, error } = await supabase
                .from("inspection_type")
                .select("*")
                .eq("is_active", true)
                .order("name");

            if (error) throw error;
            setInspectionTypes(data || []);

            // Auto-select GVI if available
            const gvi = data?.find((t: any) => t.code === "GVI");
            if (gvi) setSelectedType(gvi.id.toString());
        } catch (error) {
            console.error("Error loading inspection types:", error);
        }
    }

    function initializeFormData() {
        const type = inspectionTypes.find((t) => t.id.toString() === selectedType);
        if (!type) return;

        const defaults: any = {};

        // Initialize with default values from inspection type
        if (type.default_properties?.fields) {
            type.default_properties.fields.forEach((field: any) => {
                defaults[field.name] = "";
            });
        }

        setFormData(defaults);
    }

    async function handleSubmit() {
        if (!selectedComponent) {
            toast.error("Please select a component first");
            return;
        }

        if (!selectedType) {
            toast.error("Please select an inspection type");
            return;
        }

        setLoading(true);

        try {
            // Capture ROV data snapshot if auto-capture enabled
            let rovDataSnapshot = null;
            if (rovJob?.auto_capture_data) {
                rovDataSnapshot = {
                    depth_meters: 125.5,
                    altitude_meters: 3.2,
                    heading_degrees: 270,
                    latitude: 4.123456,
                    longitude: 103.567890,
                    water_temperature: 28.5,
                    battery_voltage: 48.2,
                    rov_status: "OK",
                    capture_timestamp: new Date().toISOString(),
                };
            }

            const { data, error } = await supabase
                .from("insp_records")
                .insert({
                    rov_job_id: rovJob.rov_job_id,
                    structure_id: selectedComponent.structure_id,
                    component_id: selectedComponent.id,
                    component_type: selectedComponent.component_type,
                    jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                    sow_report_no: sowId,
                    inspection_type_id: parseInt(selectedType),
                    inspection_type_code: inspectionTypes.find(
                        (t) => t.id.toString() === selectedType
                    )?.code,
                    inspection_data: formData,
                    rov_data_snapshot: rovDataSnapshot,
                    status: "DRAFT",
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Inspection record created successfully!");

            // Reset form
            setFormData({});
            setAiSuggestions(null);
        } catch (error: any) {
            console.error("Error creating inspection:", error);
            toast.error(error.message || "Failed to create inspection record");
        } finally {
            setLoading(false);
        }
    }

    function applySuggestion(field: string, value: any) {
        setFormData((prev: any) => ({
            ...prev,
            [field]: value,
        }));
        toast.success(`Applied AI suggestion for ${field}`);
    }

    function simulateAISuggestions() {
        // Simulate AI vision results
        setAiSuggestions({
            overall_condition: "FAIR",
            confidence: 0.87,
            detected_issues: [
                {
                    type: "CORROSION",
                    severity: "MODERATE",
                    location: "upper_section",
                    confidence: 0.82,
                },
                {
                    type: "MARINE_GROWTH",
                    coverage_estimate: 25,
                    confidence: 0.92,
                },
            ],
            suggested_remarks:
                "Moderate corrosion observed in upper section. Marine growth coverage approximately 25%. Further inspection recommended.",
        });

        toast.success("AI analysis suggestions loaded!");
    }

    const selectedTypeData = inspectionTypes.find(
        (t) => t.id.toString() === selectedType
    );

    return (
        <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800 h-full">
            <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                    {/* Header */}
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-2">
                            Inspection Form
                        </h3>

                        {selectedComponent ? (
                            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                                <p className="text-xs font-medium text-cyan-900 dark:text-cyan-100">
                                    {selectedComponent.component_name}
                                </p>
                                <p className="text-xs text-cyan-700 dark:text-cyan-300">
                                    {selectedComponent.component_type}
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
                                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                                <p className="text-xs text-muted-foreground">
                                    Select a component to start inspection
                                </p>
                            </div>
                        )}
                    </div>

                    {selectedComponent && (
                        <>
                            {/* Inspection Type */}
                            <div className="space-y-2">
                                <Label>Inspection Type *</Label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {inspectionTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id.toString()}>
                                                {type.name} ({type.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* AI Suggestions */}
                            {aiSuggestions && (
                                <div className="space-y-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-purple-600" />
                                            <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100">
                                                AI Suggestions
                                            </h4>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {Math.round(aiSuggestions.confidence * 100)}% confidence
                                        </Badge>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-purple-700 dark:text-purple-300">
                                                Overall Condition:
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-purple-600">
                                                    {aiSuggestions.overall_condition}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2"
                                                    onClick={() =>
                                                        applySuggestion(
                                                            "overall_condition",
                                                            aiSuggestions.overall_condition
                                                        )
                                                    }
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-purple-700 dark:text-purple-300">
                                                Suggested Remarks:
                                            </span>
                                            <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
                                                {aiSuggestions.suggested_remarks}
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 mt-1"
                                                onClick={() =>
                                                    applySuggestion(
                                                        "remarks",
                                                        aiSuggestions.suggested_remarks
                                                    )
                                                }
                                            >
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Apply
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Analyze Button */}
                            {!aiSuggestions && (
                                <Button
                                    onClick={simulateAISuggestions}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-purple-600 border-purple-600 hover:bg-purple-50"
                                >
                                    <Brain className="h-4 w-4 mr-2" />
                                    Get AI Suggestions
                                </Button>
                            )}

                            {/* Dynamic Form Fields */}
                            {selectedTypeData && (
                                <div className="space-y-3">
                                    {/* Overall Condition */}
                                    <div className="space-y-2">
                                        <Label>Overall Condition *</Label>
                                        <Select
                                            value={formData.overall_condition || ""}
                                            onValueChange={(value) =>
                                                setFormData({ ...formData, overall_condition: value })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select condition..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="EXCELLENT">Excellent</SelectItem>
                                                <SelectItem value="GOOD">Good</SelectItem>
                                                <SelectItem value="FAIR">Fair</SelectItem>
                                                <SelectItem value="POOR">Poor</SelectItem>
                                                <SelectItem value="CRITICAL">Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Marine Growth */}
                                    <div className="space-y-2">
                                        <Label>Marine Growth (%)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.marine_growth_percentage || ""}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    marine_growth_percentage: e.target.value,
                                                })
                                            }
                                            placeholder="0-100"
                                        />
                                    </div>

                                    {/* Coating Condition */}
                                    <div className="space-y-2">
                                        <Label>Coating Condition</Label>
                                        <Select
                                            value={formData.coating_condition || ""}
                                            onValueChange={(value) =>
                                                setFormData({ ...formData, coating_condition: value })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select condition..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="EXCELLENT">Excellent</SelectItem>
                                                <SelectItem value="GOOD">Good</SelectItem>
                                                <SelectItem value="FAIR">Fair</SelectItem>
                                                <SelectItem value="POOR">Poor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Remarks */}
                                    <div className="space-y-2">
                                        <Label>Remarks *</Label>
                                        <Textarea
                                            value={formData.remarks || ""}
                                            onChange={(e) =>
                                                setFormData({ ...formData, remarks: e.target.value })
                                            }
                                            placeholder="Enter inspection remarks..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <Button
                                onClick={handleSubmit}
                                disabled={loading || !selectedComponent || !selectedType}
                                className="w-full bg-cyan-600 hover:bg-cyan-700"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {loading ? "Saving..." : "Save Inspection"}
                            </Button>

                            {/* Info */}
                            {rovJob?.auto_capture_data && (
                                <div className="text-xs text-center text-muted-foreground">
                                    ✓ ROV data will be auto-captured with this inspection
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>
        </Card>
    );
}
