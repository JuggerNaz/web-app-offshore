"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Cuboid, Puzzle } from "lucide-react";

interface StepModeProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export function StepMode({ state, updateState, onNext, onBack }: StepModeProps) {

    const handleScopeChange = (key: 'topside' | 'subsea', checked: boolean) => {
        updateState({
            scope: { ...state.scope, [key]: checked }
        });
    };

    const isNextDisabled = (!state.scope.topside && !state.scope.subsea);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">

            {/* Creation Mode */}
            <div className="space-y-4">
                <Label className="text-lg">Creation Mode</Label>
                <RadioGroup
                    defaultValue={state.mode}
                    onValueChange={(val) => updateState({ mode: val })}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <div onClick={() => updateState({ mode: 'STRUCTURE' })}>
                        <Card className={`cursor-pointer p-6 flex flex-col items-center gap-4 hover:border-blue-500 transition-all ${state.mode === 'STRUCTURE' ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <Layers className="h-10 w-10 text-blue-500" />
                            <div className="text-center">
                                <h3 className="font-bold">By Structure</h3>
                                <p className="text-sm text-slate-500 mt-1">Full Structure Inspection</p>
                            </div>
                            <RadioGroupItem value="STRUCTURE" className="sr-only" />
                        </Card>
                    </div>

                    <div onClick={() => updateState({ mode: 'COMPONENT_TYPE' })}>
                        <Card className={`cursor-pointer p-6 flex flex-col items-center gap-4 hover:border-purple-500 transition-all ${state.mode === 'COMPONENT_TYPE' ? 'border-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                            <Cuboid className="h-10 w-10 text-purple-500" />
                            <div className="text-center">
                                <h3 className="font-bold">By Component Type</h3>
                                <p className="text-sm text-slate-500 mt-1">Specific Item Types</p>
                            </div>
                            <RadioGroupItem value="COMPONENT_TYPE" className="sr-only" />
                        </Card>
                    </div>

                    <div onClick={() => updateState({ mode: 'COMPONENT' })}>
                        <Card className={`cursor-pointer p-6 flex flex-col items-center gap-4 hover:border-orange-500 transition-all ${state.mode === 'COMPONENT' ? 'border-2 border-orange-600 bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                            <Puzzle className="h-10 w-10 text-orange-500" />
                            <div className="text-center">
                                <h3 className="font-bold">By Component</h3>
                                <p className="text-sm text-slate-500 mt-1">Selective Components</p>
                            </div>
                            <RadioGroupItem value="COMPONENT" className="sr-only" />
                        </Card>
                    </div>
                </RadioGroup>
            </div>

            {/* Scope */}
            <div className="space-y-4 pt-4 border-t">
                <Label className="text-lg">Inspection Scope</Label>
                <div className="flex gap-8">
                    <div className="flex items-center space-x-2 border p-4 rounded-xl w-full hover:bg-slate-50 cursor-pointer" onClick={() => handleScopeChange('topside', !state.scope.topside)}>
                        <Checkbox id="topside" checked={state.scope.topside} onCheckedChange={(c) => handleScopeChange('topside', c as boolean)} />
                        <div className="grid gap-1.5 leading-none">
                            <label htmlFor="topside" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Topside
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Above water inspection
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 border p-4 rounded-xl w-full hover:bg-slate-50 cursor-pointer" onClick={() => handleScopeChange('subsea', !state.scope.subsea)}>
                        <Checkbox id="subsea" checked={state.scope.subsea} onCheckedChange={(c) => handleScopeChange('subsea', c as boolean)} />
                        <div className="grid gap-1.5 leading-none">
                            <label htmlFor="subsea" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Subsea
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Underwater inspection
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-8">
                <Button variant="outline" onClick={onBack} size="lg">Back</Button>
                <Button onClick={onNext} disabled={isNextDisabled} size="lg">
                    Next Step
                </Button>
            </div>
        </div>
    );
}
