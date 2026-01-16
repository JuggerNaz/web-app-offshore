"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Building2,
    Download,
    Eye,
    Search,
    Filter,
    FileText,
    Image as ImageIcon,
    Layers,
    MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Image from "next/image";

interface Structure {
    id: number;
    str_id: string;
    str_name: string;
    str_type: string;
    field_name: string;
    location: string;
    water_depth: number;
    installation_date: string;
    status: string;
    photo_url?: string;
    specifications?: any;
}

export default function StructureReportsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterField, setFilterField] = useState<string>("all");
    const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);

    // Fetch all structures
    const { data: structuresData, error } = useSWR("/api/structures", fetcher);

    // Filter structures
    const filteredStructures = useMemo(() => {
        if (!structuresData?.data) return [];

        let filtered = structuresData.data;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter((s: Structure) =>
                s.str_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.str_id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by type
        if (filterType !== "all") {
            filtered = filtered.filter((s: Structure) => s.str_type === filterType);
        }

        // Filter by field
        if (filterField !== "all") {
            filtered = filtered.filter((s: Structure) => s.field_name === filterField);
        }

        return filtered;
    }, [structuresData, searchTerm, filterType, filterField]);

    // Get unique types and fields for filters
    const uniqueTypes: string[] = useMemo(() => {
        if (!structuresData?.data) return [];
        return Array.from(new Set(structuresData.data.map((s: Structure) => s.str_type)));
    }, [structuresData]);

    const uniqueFields: string[] = useMemo(() => {
        if (!structuresData?.data) return [];
        return Array.from(new Set(structuresData.data.map((s: Structure) => s.field_name)));
    }, [structuresData]);

    const handleGenerateReport = async (structure: Structure) => {
        console.log("Generating report for:", structure);
        // TODO: Implement PDF generation
        alert(`Generating report for ${structure.str_name}...\n\nThis will include:\n- Company logo and branding\n- Structure specifications\n- Structure photo\n- Technical details`);
    };

    const handlePreviewReport = (structure: Structure) => {
        setSelectedStructure(structure);
        // TODO: Open preview modal
        alert(`Preview for ${structure.str_name}`);
    };

    if (error) {
        return (
            <div className="flex-1 w-full p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-6">
                        <p className="text-red-800">Error loading structures: {error.message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                                    <Building2 className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        All Structures
                                    </h1>
                                    <p className="text-muted-foreground mt-1">
                                        {structuresData?.count || 0} structures registered • Generate comprehensive reports with company branding
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                                {uniqueTypes.filter((t: string) => t.toLowerCase().includes('platform')).length > 0 &&
                                    `${structuresData?.data?.filter((s: Structure) => s.str_type.toLowerCase().includes('platform')).length || 0} Platforms`
                                }
                            </Badge>
                            <Badge variant="outline" className="text-teal-600 border-teal-600">
                                {uniqueTypes.filter((t: string) => t.toLowerCase().includes('pipeline')).length > 0 &&
                                    `${structuresData?.data?.filter((s: Structure) => s.str_type.toLowerCase().includes('pipeline')).length || 0} Pipelines`
                                }
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-2 border-blue-100 dark:border-blue-900/30 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-600" />
                            Filter Structures
                        </CardTitle>
                        <CardDescription>
                            Search and filter structures to generate reports
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="space-y-2">
                                <Label htmlFor="search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Search by name or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Type Filter */}
                            <div className="space-y-2">
                                <Label htmlFor="type-filter">Structure Type</Label>
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger id="type-filter">
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        {uniqueTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Field Filter */}
                            <div className="space-y-2">
                                <Label htmlFor="field-filter">Oil Field</Label>
                                <Select value={filterField} onValueChange={setFilterField}>
                                    <SelectTrigger id="field-filter">
                                        <SelectValue placeholder="All fields" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Fields</SelectItem>
                                        {uniqueFields.map((field) => (
                                            <SelectItem key={field} value={field}>
                                                {field}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Results Count */}
                        <div className="mt-4 flex items-center gap-2">
                            <Badge variant="secondary">
                                {filteredStructures.length} structure{filteredStructures.length !== 1 ? 's' : ''} found
                            </Badge>
                            {(searchTerm || filterType !== "all" || filterField !== "all") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setFilterType("all");
                                        setFilterField("all");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Structure List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStructures.map((structure: Structure) => (
                        <Card
                            key={structure.id}
                            className="group hover:shadow-xl transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer"
                        >
                            <CardHeader className="pb-3">
                                {/* Structure Photo */}
                                {structure.photo_url && (
                                    <div className="relative w-full h-40 mb-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                                        <Image
                                            src={structure.photo_url}
                                            alt={structure.str_name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                {!structure.photo_url && (
                                    <div className="relative w-full h-40 mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-slate-400" />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg line-clamp-1">
                                                {structure.str_name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                ID: {structure.str_id}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0">
                                            {structure.str_type}
                                        </Badge>
                                    </div>

                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3" />
                                            <span>{structure.field_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-3 h-3" />
                                            <span>Water Depth: {structure.water_depth}m</span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-2">
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="flex-1 gap-2"
                                        onClick={() => handleGenerateReport(structure)}
                                    >
                                        <Download className="w-3 h-3" />
                                        Generate Report
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePreviewReport(structure)}
                                    >
                                        <Eye className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Empty State */}
                {filteredStructures.length === 0 && (
                    <Card className="border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No structures found</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm">
                                {searchTerm || filterType !== "all" || filterField !== "all"
                                    ? "Try adjusting your filters or search term"
                                    : "No structures have been registered yet"}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
