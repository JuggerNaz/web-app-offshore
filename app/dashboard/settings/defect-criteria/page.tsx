'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Plus, Edit, Trash2, Save, X, AlertCircle, CheckCircle, ArrowLeft, Settings2, ShieldAlert, Search } from 'lucide-react';
import type { DefectCriteriaProcedure, DefectCriteriaRule, RuleFormData, LibraryItem, ProcedureStatus } from '@/types/defect-criteria';

export default function DefectCriteriaPage() {
    // State management
    const [procedures, setProcedures] = useState<DefectCriteriaProcedure[]>([]);
    const [activeProcedure, setActiveProcedure] = useState<DefectCriteriaProcedure | null>(null);
    const [rules, setRules] = useState<DefectCriteriaRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Library data
    const [priorities, setPriorities] = useState<LibraryItem[]>([]);
    const [defectCodes, setDefectCodes] = useState<LibraryItem[]>([]);
    const [defectTypes, setDefectTypes] = useState<LibraryItem[]>([]);
    const [structureGroups, setStructureGroups] = useState<LibraryItem[]>([]);
    const [anomalyColors, setAnomalyColors] = useState<any[]>([]);

    // Modal states
    const [showRuleBuilder, setShowRuleBuilder] = useState(false);
    const [showNewProcedure, setShowNewProcedure] = useState(false);
    const [showEditProcedure, setShowEditProcedure] = useState(false);
    const [editingRule, setEditingRule] = useState<DefectCriteriaRule | null>(null);
    const [valueType, setValueType] = useState<'number' | 'text'>('number');
    const [searchTerm, setSearchTerm] = useState('');

    // Form data
    const [ruleForm, setRuleForm] = useState<RuleFormData>({
        structureGroup: '',
        priorityId: '',
        defectCodeId: '',
        defectTypeId: '',
        autoFlag: true,
        alertMessage: '',
        evaluationPriority: 0,
    });

    const [procedureForm, setProcedureForm] = useState({
        procedureNumber: '',
        procedureName: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'draft' as ProcedureStatus,
        notes: '',
    });

    // Fetch initial data
    useEffect(() => {
        loadProcedures();
        loadLibraryData();
    }, []);

    // Load procedures
    const loadProcedures = async () => {
        try {
            const response = await fetch('/api/defect-criteria/procedures', { cache: 'no-store' });
            const data = await response.json();
            setProcedures(data);

            if (data.length > 0) {
                setActiveProcedure(data[0]);
                loadRules(data[0].id);
            }
        } catch (error) {
            console.error('Error loading procedures:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load rules for a procedure
    const loadRules = async (procedureId: string) => {
        try {
            const response = await fetch(`/api/defect-criteria/rules?procedureId=${procedureId}`);
            const data = await response.json();
            setRules(data);
        } catch (error) {
            console.error('Error loading rules:', error);
        }
    };

    // Load library data
    const loadLibraryData = async () => {
        try {
            const [prioritiesRes, codesRes, groupsRes, typesRes, colorsRes] = await Promise.all([
                fetch('/api/defect-criteria/library/priorities', { cache: 'no-store' }),
                fetch('/api/defect-criteria/library/codes?structureType=platform', { cache: 'no-store' }),
                fetch('/api/defect-criteria/library/structure-groups', { cache: 'no-store' }),
                fetch('/api/defect-criteria/library/types', { cache: 'no-store' }),
                fetch('/api/library/combo/ANMLYCLR', { cache: 'no-store' }),
            ]);

            setPriorities(prioritiesRes.ok ? await prioritiesRes.json() : []);
            setDefectCodes(codesRes.ok ? await codesRes.json() : []);
            setStructureGroups(groupsRes.ok ? await groupsRes.json() : []);
            setDefectTypes(typesRes.ok ? await typesRes.json() : []);

            if (colorsRes.ok) {
                const colorsData = await colorsRes.json();
                setAnomalyColors(colorsData.data || []);
            }
        } catch (error) {
            console.error('Error loading library data:', error);
        }
    };

    // Load defect types when defect code changes
    const loadDefectTypes = async (defectCodeId: string) => {
        try {
            const response = await fetch(`/api/defect-criteria/library/types?defectCodeId=${defectCodeId}`, { cache: 'no-store' });
            const data = await response.json();
            setDefectTypes(data);
        } catch (error) {
            console.error('Error loading defect types:', error);
        }
    };

    // Load ALL defect types for display purposes
    useEffect(() => {
        const loadAllTypes = async () => {
            // We'll use a temporary state or just fetch all potentially if api supports it, 
            // but since we don't have a 'get all types' endpoint easily exposed without code, 
            // best workaround is to fetch types for displayed rules
        };
        // actually, a better way is to fetch ALL types once for the lookup map
        // Let's modify loadLibraryData to fetch all types if possible or fetch specifically for known codes
    }, []);

    // Helper to get ALL defect types
    const [allDefectTypes, setAllDefectTypes] = useState<LibraryItem[]>([]);

    useEffect(() => {
        const fetchAllTypes = async () => {
            try {
                // Fetching types without filter to build the full map
                const response = await fetch(`/api/defect-criteria/library/types`, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    setAllDefectTypes(data);
                }
            } catch (err) {
                console.error("Failed to load all defect types", err);
            }
        };
        fetchAllTypes();
    }, []);


    // Handle defect code selection
    const handleDefectCodeChange = (defectCodeId: string) => {
        setRuleForm({ ...ruleForm, defectCodeId, defectTypeId: '' });
        loadDefectTypes(defectCodeId);
    };

    // Create new procedure
    const handleCreateProcedure = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/defect-criteria/procedures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(procedureForm),
            });

            if (response.ok) {
                const newProcedure = await response.json();
                setProcedures([newProcedure, ...procedures]);
                setActiveProcedure(newProcedure);
                setShowNewProcedure(false);
                setProcedureForm({
                    procedureNumber: '',
                    procedureName: '',
                    effectiveDate: new Date().toISOString().split('T')[0],
                    status: 'draft' as ProcedureStatus,
                    notes: '',
                });
            }
        } catch (error) {
            console.error('Error creating procedure:', error);
        } finally {
            setSaving(false);
        }
    };

    // Edit procedure
    const handleEditProcedure = () => {
        if (!activeProcedure) return;

        setProcedureForm({
            procedureNumber: activeProcedure.procedureNumber || '',
            procedureName: activeProcedure.procedureName || '',
            effectiveDate: activeProcedure.effectiveDate ? new Date(activeProcedure.effectiveDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: activeProcedure.status || 'draft',
            notes: activeProcedure.notes || '',
        });
        setShowEditProcedure(true);
    };

    // Update procedure
    const handleUpdateProcedure = async () => {
        console.log('Update requested for:', activeProcedure);

        if (!activeProcedure) return;

        if (!activeProcedure.id || activeProcedure.id === 'undefined') {
            alert('Error: Procedure ID is missing or invalid. Please refresh the page completely (Ctrl+F5).');
            console.error('Invalid ID:', activeProcedure.id);
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/defect-criteria/procedures/${activeProcedure.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(procedureForm),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Update failed:', errorData);
                alert(`Update failed: ${errorData.error || 'Unknown error'}\n${errorData.details ? 'Details: ' + errorData.details : ''}`);
                setSaving(false);
                return;
            }

            if (response.ok) {
                const updatedProcedure = await response.json();
                setProcedures(procedures.map(p => p.id === updatedProcedure.id ? updatedProcedure : p));
                setActiveProcedure(updatedProcedure);
                setShowEditProcedure(false);
                setProcedureForm({
                    procedureNumber: '',
                    procedureName: '',
                    effectiveDate: new Date().toISOString().split('T')[0],
                    status: 'draft' as ProcedureStatus,
                    notes: '',
                });
            }
        } catch (error) {
            console.error('Error updating procedure:', error);
        } finally {
            setSaving(false);
        }
    };

    // Save rule
    const handleSaveRule = async () => {
        if (!activeProcedure) return;

        setSaving(true);
        try {


            const url = editingRule
                ? `/api/defect-criteria/rules/${editingRule.id}`
                : '/api/defect-criteria/rules';

            const method = editingRule ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...ruleForm,
                    procedureId: activeProcedure.id,
                }),
            });

            if (response.ok) {
                loadRules(activeProcedure.id);
                setShowRuleBuilder(false);
                resetRuleForm();
            } else {
                const errorData = await response.json();
                alert(`Failed to save rule: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error saving rule:', error);
            alert('An unexpected error occurred while saving the rule.');
        } finally {
            setSaving(false);
        }
    };

    // Delete rule
    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            const response = await fetch(`/api/defect-criteria/rules/${ruleId}`, {
                method: 'DELETE',
            });

            if (response.ok && activeProcedure) {
                loadRules(activeProcedure.id);
            } else {
                const errorData = await response.json();
                alert(`Failed to delete rule: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            alert('An unexpected error occurred while deleting the rule.');
        }
    };

    // Edit rule
    const handleEditRule = (rule: DefectCriteriaRule) => {
        setEditingRule(rule);
        setRuleForm({
            structureGroup: rule.structureGroup,
            priorityId: rule.priorityId,
            defectCodeId: rule.defectCodeId,
            defectTypeId: rule.defectTypeId,
            jobpackType: rule.jobpackType,
            elevationMin: rule.elevationMin,
            elevationMax: rule.elevationMax,
            nominalThickness: rule.nominalThickness,
            thresholdValue: rule.thresholdValue,
            thresholdText: rule.thresholdText,
            thresholdOperator: rule.thresholdOperator,
            customParameters: rule.customParameters,
            autoFlag: rule.autoFlag,
            alertMessage: rule.alertMessage,
            evaluationPriority: rule.evaluationPriority,
        });
        setValueType(rule.thresholdText ? 'text' : 'number');
        loadDefectTypes(rule.defectCodeId);
        setShowRuleBuilder(true);
    };

    // Reset rule form
    const resetRuleForm = () => {
        setEditingRule(null);
        setRuleForm({
            structureGroup: '',
            priorityId: '',
            defectCodeId: '',
            defectTypeId: '',
            autoFlag: true,
            alertMessage: '',
            evaluationPriority: 0,
        });
        setValueType('number');
        setDefectTypes([]);
    };

    // Get library label by ID
    const getLibraryLabel = (items: LibraryItem[], id: string) => {
        return items.find(item => item.lib_id === id)?.lib_desc || 'Unknown';
    };

    const filteredRules = rules.filter(rule => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();

        const priorityLabel = getLibraryLabel(priorities, rule.priorityId).toLowerCase();
        const defectCode = getLibraryLabel(defectCodes, rule.defectCodeId).toLowerCase();
        // Since we don't have all types map handy unless we use 'allDefectTypes', 
        // we can try looking up in 'allDefectTypes' if populated, or fallback.
        // Assuming 'allDefectTypes' is available from previous steps (I see I added it).
        const defectType = getLibraryLabel(allDefectTypes, rule.defectTypeId).toLowerCase();
        const structureGroup = rule.structureGroup.toLowerCase();
        const alertMsg = rule.alertMessage.toLowerCase();

        return (
            priorityLabel.includes(searchLower) ||
            defectCode.includes(searchLower) ||
            defectType.includes(searchLower) ||
            structureGroup.includes(searchLower) ||
            alertMsg.includes(searchLower)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Loading defect criteria...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Settings
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-600/10 rounded-lg">
                            <ShieldAlert className="w-6 h-6 text-orange-600" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
                            Defect/Anomaly Criteria
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-14">
                        Define inspection criteria for automatic defect flagging
                    </p>
                </div>

                {/* Active Procedure Card */}
                <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <CardTitle className="flex items-center gap-2">
                                    <Settings2 className="w-5 h-5" />
                                    Defect Criteria Procedure
                                </CardTitle>
                                <CardDescription>Select and manage defect criteria configuration</CardDescription>
                            </div>
                            <Button onClick={() => setShowNewProcedure(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Procedure
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {procedures.length > 0 ? (
                            <div className="space-y-4">
                                {/* Procedure Selector */}
                                <div className="space-y-2">
                                    <Label htmlFor="procedureSelect">Select Procedure</Label>
                                    <Select
                                        value={activeProcedure?.id || ''}
                                        onValueChange={(value) => {
                                            const selected = procedures.find(p => p.id === value);
                                            if (selected) {
                                                setActiveProcedure(selected);
                                                loadRules(selected.id);
                                            }
                                        }}
                                    >
                                        <SelectTrigger id="procedureSelect">
                                            <SelectValue placeholder="Select a procedure" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {procedures.map((procedure) => (
                                                <SelectItem key={procedure.id} value={procedure.id}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{procedure.procedureNumber} - {procedure.procedureName}</span>
                                                        <Badge
                                                            variant={procedure.status === 'active' ? 'default' : 'secondary'}
                                                            className="ml-2"
                                                        >
                                                            {procedure.status}
                                                        </Badge>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Selected Procedure Details */}
                                {activeProcedure && (
                                    <div className="border-t pt-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold">{activeProcedure.procedureName}</h3>
                                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                    <span>Number: {activeProcedure.procedureNumber}</span>
                                                    <span>•</span>
                                                    <span>Version: {activeProcedure.version}</span>
                                                    <span>•</span>
                                                    <span>Effective: {new Date(activeProcedure.effectiveDate).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <Badge variant={activeProcedure.status === 'active' ? 'default' : 'secondary'}>
                                                        {activeProcedure.status}
                                                    </Badge>
                                                </div>
                                                {activeProcedure.notes && (
                                                    <p className="text-sm text-muted-foreground mt-2">{activeProcedure.notes}</p>
                                                )}
                                            </div>
                                            <Button variant="outline" size="sm" onClick={handleEditProcedure}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                        </div>
                                        <div className="text-sm mt-4">
                                            <span className="font-medium">{rules.length}</span> Rules Defined
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    No procedures found. Create a new procedure to get started.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Criteria Rules Card */}
                {activeProcedure && (
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Criteria Rules</CardTitle>
                                    <CardDescription>Define validation rules for defect detection</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search rules..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <Button onClick={() => { resetRuleForm(); setShowRuleBuilder(true); }}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add New Rule
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {rules.length === 0 ? (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        No rules defined yet. Add your first rule to start automatic defect detection.
                                    </AlertDescription>
                                </Alert>
                            ) : filteredRules.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No rules found matching "{searchTerm}"</p>
                                    <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2 text-primary">
                                        Clear Search
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredRules.map((rule, index) => (
                                        <Card key={rule.id}>
                                            <CardContent className="pt-6">
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-2 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">Rule {index + 1}</span>
                                                            {(() => {
                                                                const priorityColor = anomalyColors.find(c =>
                                                                    c.code_1 === rule.priorityId &&
                                                                    (c.lib_delete === null || c.lib_delete === 0)
                                                                );
                                                                const rgb = priorityColor?.code_2 ? `rgb(${priorityColor.code_2})` : undefined;

                                                                // Calculate text color for contrast if color exists
                                                                let textColor = undefined;
                                                                if (priorityColor?.code_2) {
                                                                    const parts = priorityColor.code_2.split(',').map((p: string) => parseInt(p.trim()));
                                                                    if (parts.length === 3) {
                                                                        const brightness = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
                                                                        textColor = brightness < 125 ? 'white' : 'black';
                                                                    }
                                                                }

                                                                return (
                                                                    <Badge
                                                                        variant="outline"
                                                                        style={rgb ? { backgroundColor: rgb, color: textColor, borderColor: rgb } : {}}
                                                                    >
                                                                        Priority: {getLibraryLabel(priorities, rule.priorityId)}
                                                                    </Badge>
                                                                );
                                                            })()}
                                                            {rule.autoFlag && (
                                                                <Badge variant="secondary">
                                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                                    Auto-flag
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-sm space-y-1">
                                                            <div>
                                                                <span className="text-muted-foreground">Structure:</span>{' '}
                                                                <span className="font-medium">{rule.structureGroup}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground">Defect:</span>{' '}
                                                                <span className="font-medium">
                                                                    {getLibraryLabel(defectCodes, rule.defectCodeId)} - {getLibraryLabel(allDefectTypes, rule.defectTypeId)}
                                                                </span>
                                                            </div>
                                                            {rule.thresholdOperator && rule.thresholdValue && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Condition:</span>{' '}
                                                                    <span className="font-medium">
                                                                        Value {rule.thresholdOperator} {rule.thresholdValue}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-muted-foreground">Alert:</span>{' '}
                                                                <span className="italic">&quot;{rule.alertMessage}&quot;</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}


                {/* New Procedure Dialog */}
                <Dialog open={showNewProcedure} onOpenChange={setShowNewProcedure}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Procedure</DialogTitle>
                            <DialogDescription>
                                Define a new defect criteria procedure
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="procedureNumber">Procedure Number</Label>
                                    <Input
                                        id="procedureNumber"
                                        placeholder="DC-001"
                                        value={procedureForm.procedureNumber}
                                        onChange={(e) => setProcedureForm({ ...procedureForm, procedureNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="effectiveDate">Effective Date</Label>
                                    <Input
                                        id="effectiveDate"
                                        type="date"
                                        value={procedureForm.effectiveDate}
                                        onChange={(e) => setProcedureForm({ ...procedureForm, effectiveDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="procedureName">Procedure Name</Label>
                                <Input
                                    id="procedureName"
                                    placeholder="Baseline Inspection Criteria 2024"
                                    value={procedureForm.procedureName}
                                    onChange={(e) => setProcedureForm({ ...procedureForm, procedureName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Input
                                    id="notes"
                                    placeholder="Additional notes..."
                                    value={procedureForm.notes}
                                    onChange={(e) => setProcedureForm({ ...procedureForm, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowNewProcedure(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateProcedure} disabled={saving}>
                                {saving ? 'Creating...' : 'Create Procedure'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Procedure Dialog */}
                <Dialog open={showEditProcedure} onOpenChange={setShowEditProcedure}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit Procedure</DialogTitle>
                            <DialogDescription>
                                Update defect criteria procedure details
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="editProcedureNumber">Procedure Number</Label>
                                    <Input
                                        id="editProcedureNumber"
                                        placeholder="DC-001"
                                        value={procedureForm.procedureNumber}
                                        onChange={(e) => setProcedureForm({ ...procedureForm, procedureNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editEffectiveDate">Effective Date</Label>
                                    <Input
                                        id="editEffectiveDate"
                                        type="date"
                                        value={procedureForm.effectiveDate}
                                        onChange={(e) => setProcedureForm({ ...procedureForm, effectiveDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editProcedureName">Procedure Name</Label>
                                <Input
                                    id="editProcedureName"
                                    placeholder="Baseline Inspection Criteria 2024"
                                    value={procedureForm.procedureName}
                                    onChange={(e) => setProcedureForm({ ...procedureForm, procedureName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editStatus">Status</Label>
                                <Select
                                    value={procedureForm.status}
                                    onValueChange={(value) => setProcedureForm({ ...procedureForm, status: value as ProcedureStatus })}
                                >
                                    <SelectTrigger id="editStatus">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editNotes">Notes (Optional)</Label>
                                <Input
                                    id="editNotes"
                                    placeholder="Additional notes..."
                                    value={procedureForm.notes}
                                    onChange={(e) => setProcedureForm({ ...procedureForm, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowEditProcedure(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdateProcedure} disabled={saving}>
                                {saving ? 'Updating...' : 'Update Procedure'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>


                {/* Rule Builder Dialog */}
                <Dialog open={showRuleBuilder} onOpenChange={setShowRuleBuilder}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingRule ? 'Edit' : 'Add'} Criteria Rule</DialogTitle>
                            <DialogDescription>
                                Define conditions for automatic defect detection
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Basic Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="structureGroup">Structure Group</Label>
                                        <Select value={ruleForm.structureGroup} onValueChange={(value) => setRuleForm({ ...ruleForm, structureGroup: value })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select structure group" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All Structure Groups" className="font-semibold text-primary">
                                                    All Structure Groups
                                                </SelectItem>
                                                {structureGroups.map((group) => (
                                                    <SelectItem key={group.lib_id} value={group.lib_desc}>
                                                        {group.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority Type</Label>
                                        <Select value={ruleForm.priorityId} onValueChange={(value) => setRuleForm({ ...ruleForm, priorityId: value })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select priority" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {priorities.map((priority) => (
                                                    <SelectItem key={priority.lib_id} value={priority.lib_id}>
                                                        {priority.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="defectCode">Defect Code</Label>
                                        <Select value={ruleForm.defectCodeId} onValueChange={handleDefectCodeChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select defect code" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {defectCodes.map((code) => (
                                                    <SelectItem key={code.lib_id} value={code.lib_id}>
                                                        {code.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="defectType">Defect Type</Label>
                                        <Select
                                            value={ruleForm.defectTypeId}
                                            onValueChange={(value) => setRuleForm({ ...ruleForm, defectTypeId: value })}
                                            disabled={!ruleForm.defectCodeId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select defect type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {defectTypes.map((type) => (
                                                    <SelectItem key={type.lib_id} value={type.lib_id}>
                                                        {type.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Conditions */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Conditions (Optional)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="elevationMin">Elevation Min (m)</Label>
                                        <Input
                                            id="elevationMin"
                                            type="number"
                                            step="0.01"
                                            placeholder="Optional"
                                            value={ruleForm.elevationMin || ''}
                                            onChange={(e) => setRuleForm({ ...ruleForm, elevationMin: e.target.value ? Number(e.target.value) : undefined })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="elevationMax">Elevation Max (m)</Label>
                                        <Input
                                            id="elevationMax"
                                            type="number"
                                            step="0.01"
                                            placeholder="Optional"
                                            value={ruleForm.elevationMax || ''}
                                            onChange={(e) => setRuleForm({ ...ruleForm, elevationMax: e.target.value ? Number(e.target.value) : undefined })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Trigger Condition */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Trigger Condition</h3>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3 space-y-2">
                                        <Label>Value Type</Label>
                                        <Select
                                            value={valueType}
                                            onValueChange={(value: 'number' | 'text') => {
                                                setValueType(value);
                                                // Clear the other value when switching
                                                if (value === 'number') {
                                                    setRuleForm({ ...ruleForm, thresholdText: undefined });
                                                } else {
                                                    setRuleForm({ ...ruleForm, thresholdValue: undefined });
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="number">Number</SelectItem>
                                                <SelectItem value="text">Text / String</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-4 space-y-2">
                                        <Label htmlFor="thresholdOperator">Operator</Label>
                                        <Select
                                            value={ruleForm.thresholdOperator || ''}
                                            onValueChange={(value) => setRuleForm({ ...ruleForm, thresholdOperator: value as any })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select operator" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value=">">Greater than (&gt;)</SelectItem>
                                                <SelectItem value="<">Less than (&lt;)</SelectItem>
                                                <SelectItem value=">=">Greater or equal (&gt;=)</SelectItem>
                                                <SelectItem value="<=">Less or equal (&lt;=)</SelectItem>
                                                <SelectItem value="==">Equal (==)</SelectItem>
                                                <SelectItem value="!=">Not equal (!=)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-5 space-y-2">
                                        <Label htmlFor="thresholdValue">Threshold Value</Label>
                                        {valueType === 'number' ? (
                                            <Input
                                                id="thresholdValue"
                                                type="number"
                                                step="0.01"
                                                placeholder="Numeric Value"
                                                value={ruleForm.thresholdValue !== undefined ? ruleForm.thresholdValue : ''}
                                                onChange={(e) => setRuleForm({
                                                    ...ruleForm,
                                                    thresholdValue: e.target.value ? Number(e.target.value) : undefined,
                                                    thresholdText: undefined
                                                })}
                                            />
                                        ) : (
                                            <Input
                                                id="thresholdValue"
                                                type="text"
                                                placeholder="Text Value"
                                                value={ruleForm.thresholdText || ''}
                                                onChange={(e) => setRuleForm({
                                                    ...ruleForm,
                                                    thresholdText: e.target.value,
                                                    thresholdValue: undefined
                                                })}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div >

                        <div className="space-y-2">
                            <Label htmlFor="evaluationPriority">Evaluation Priority</Label>
                            <Input
                                id="evaluationPriority"
                                type="number"
                                placeholder="0"
                                value={ruleForm.evaluationPriority}
                                onChange={(e) => setRuleForm({ ...ruleForm, evaluationPriority: Number(e.target.value) })}
                            />
                            <p className="text-sm text-muted-foreground">
                                Higher priority rules are evaluated first.
                            </p>
                        </div>

                        {/* Alert Settings */}
                        <div className="space-y-4">
                            <h3 className="font-semibold">Alert Settings</h3>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="autoFlag"
                                    checked={ruleForm.autoFlag}
                                    onCheckedChange={(checked) => setRuleForm({ ...ruleForm, autoFlag: checked as boolean })}
                                />
                                <Label htmlFor="autoFlag" className="cursor-pointer">
                                    Auto-flag as defect when conditions are met
                                </Label>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alertMessage">Alert Message</Label>
                                <Input
                                    id="alertMessage"
                                    placeholder="e.g., Critical thickness loss detected"
                                    value={ruleForm.alertMessage}
                                    onChange={(e) => setRuleForm({ ...ruleForm, alertMessage: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setShowRuleBuilder(false); resetRuleForm(); }}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleSaveRule} disabled={saving || !ruleForm.structureGroup || !ruleForm.priorityId || !ruleForm.defectCodeId || !ruleForm.defectTypeId || !ruleForm.alertMessage}>
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? 'Saving...' : 'Save Rule'}
                            </Button>
                        </DialogFooter>
                    </DialogContent >
                </Dialog >
            </div >
        </div >
    );
}
