"use client";

import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Compass, Layers, FileText, CheckCircle2 } from "lucide-react";
import { generate2DFaceSketchSVG, generate2DFaceSketchHTML } from "@/utils/report-generators/print-2d-face-sketch";

interface PrintFaceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    platformTitle: string;
    faces: any[];
    componentLayouts: any[];
    foundationMembers: any[];
    elevations: any[];
}

export function PrintFaceDialog({
    isOpen,
    onClose,
    platformTitle = "PLATFORM",
    faces = [],
    componentLayouts = [],
    foundationMembers = [],
    elevations = [],
}: PrintFaceDialogProps) {
    // 1. Available Face Options
    const availableFaces = useMemo(() => {
        const set = new Set<string>();
        if (Array.isArray(faces)) {
            faces.forEach((f) => {
                const name = typeof f === "string" ? f : f.face;
                if (name) set.add(name.toString().trim());
            });
        }
        if (set.size === 0 && Array.isArray(componentLayouts)) {
            componentLayouts.forEach((l) => {
                const face = l.compFace || l.face || l.metadata?.face;
                if (face) set.add(face.toString().trim());
            });
        }
        // Fallback default face options if platform faces data empty
        if (set.size === 0) {
            return ["FACE A", "FACE B", "ROW 1", "ROW 2"];
        }
        return Array.from(set).sort();
    }, [faces, componentLayouts]);

    const [selectedFace, setSelectedFace] = useState<string>(availableFaces[0] || "FACE A");

    // Keep selected face valid when availableFaces updates
    React.useEffect(() => {
        if (availableFaces.length > 0 && !availableFaces.includes(selectedFace)) {
            setSelectedFace(availableFaces[0]);
        }
    }, [availableFaces, selectedFace]);

    // 2. Generate Live SVG Preview
    const svgPreview = useMemo(() => {
        if (!selectedFace) return "";
        return generate2DFaceSketchSVG({
            platformTitle,
            faceName: selectedFace,
            layouts: componentLayouts,
            foundationMembers,
            elevations,
            faces,
        });
    }, [platformTitle, selectedFace, componentLayouts, foundationMembers, elevations, faces]);

    // 3. Print Handler (Triggers browser print window with clean 2D sketch)
    const handlePrint = () => {
        const html = generate2DFaceSketchHTML({
            platformTitle,
            faceName: selectedFace,
            layouts: componentLayouts,
            foundationMembers,
            elevations,
            faces,
        });

        // Use invisible iframe for seamless print triggering
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 300);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl overflow-hidden">
                <DialogHeader className="space-y-2 pb-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                <Printer className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                                    Print 2D Face Sketch - {platformTitle}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium text-slate-400">
                                    Select a structural face elevation to generate and print a 2D CAD engineering sketch.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    {/* Left Column: Face Selection */}
                    <div className="space-y-4 md:col-span-1 border-r border-slate-800 pr-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Compass className="h-3.5 w-3.5 text-blue-400" />
                                Select Face
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                {availableFaces.length} Faces
                            </span>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                            {availableFaces.map((face) => {
                                const isSelected = selectedFace === face;
                                return (
                                    <button
                                        key={face}
                                        onClick={() => setSelectedFace(face)}
                                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all text-left ${
                                            isSelected
                                                ? "bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                                                : "bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={`w-2 h-2 rounded-full ${
                                                    isSelected ? "bg-blue-400 animate-pulse" : "bg-slate-600"
                                                }`}
                                            />
                                            <span className="uppercase">{face}</span>
                                        </div>
                                        {isSelected && <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Live 2D CAD Sketch Preview */}
                    <div className="md:col-span-2 flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                2D CAD Sketch Preview ({selectedFace})
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                                Vector 2D SVG
                            </span>
                        </div>

                        <div className="w-full h-[300px] bg-white rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center p-2 shadow-inner">
                            {svgPreview ? (
                                <div
                                    className="w-full h-full flex items-center justify-center"
                                    dangerouslySetInnerHTML={{ __html: svgPreview }}
                                />
                            ) : (
                                <div className="text-slate-400 text-xs font-bold">Select a face to preview sketch</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Action Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="h-10 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={handlePrint}
                        className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-2 transition-all"
                    >
                        <Printer className="h-4 w-4" />
                        <span>Print 2D Face Sketch</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
