const fs = require('fs');

const jsonPath = 'c:\\Users\\nq262\\Downloads\\web-app-offshore\\utils\\spec-additional-details.json';
const specDialogPath = 'c:\\Users\\nq262\\Downloads\\web-app-offshore\\components\\dialogs\\component-spec-dialog.tsx';
const editDialogPath = 'c:\\Users\\nq262\\Downloads\\web-app-offshore\\components\\dialogs\\component-edit-dialog.tsx';

// 1. Update JSON
try {
    let json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let pl = json.data.find(d => d.code === 'pl');
    if (pl) {
        pl.additionalDataTemplate.pile_typ = "";
        pl.additionalDataTemplate.pile_mat = "";
        delete pl.additionalDataTemplate.thetype;
        delete pl.additionalDataTemplate.material;
        fs.writeFileSync(jsonPath, JSON.stringify(json, null, 4), 'utf8');
        console.log('JSON updated');
    }
} catch (e) { console.error('JSON error:', e.message); }

// 2. Update Spec Dialog
try {
    let specContent = fs.readFileSync(specDialogPath, 'utf8');

    // Labels
    specContent = specContent.replace(
        "if (key === 'electrically_cont') label = 'Electrically Continuous';",
        "if (key === 'electrically_cont') label = 'Electrically Continuous';\n                        if (key === 'pile_typ') label = 'Pile Types';\n                        if (key === 'pile_mat') label = 'Pile Materials';"
    );

    // Dropdowns
    const pileDropdowns = `
                        // Render pile dropdowns
                        if (key === 'pile_typ' && effectiveCode?.toLowerCase() === 'pl') {
                          return (
                            <div key={key} className="space-y-2">
                              <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                              <Select
                                value={value || ""}
                                onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                                disabled={!(isCreateMode || isEditMode) || !pileTypeData}
                              >
                                <SelectTrigger id={key} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                  <SelectValue placeholder="Select pile type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {pileTypeData?.data?.map((x: any) => (
                                    <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                      {x.lib_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        if (key === 'pile_mat' && effectiveCode?.toLowerCase() === 'pl') {
                          return (
                            <div key={key} className="space-y-2">
                              <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                              <Select
                                value={value || ""}
                                onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                                disabled={!(isCreateMode || isEditMode) || !pileMatData}
                              >
                                <SelectTrigger id={key} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                  <SelectValue placeholder="Select pile material" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {pileMatData?.data?.map((x: any) => (
                                    <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                      {x.lib_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }
`;
    specContent = specContent.replace("// Render clamp dropdowns", pileDropdowns + "                        // Render clamp dropdowns");

    fs.writeFileSync(specDialogPath, specContent, 'utf8');
    console.log('Spec Dialog updated');
} catch (e) { console.error('Spec Dialog error:', e.message); }

// 3. Update Edit Dialog
try {
    let editContent = fs.readFileSync(editDialogPath, 'utf8');

    // Fetch
    editContent = editContent.replace(
        "const { data: caisAtData } = useSWR(`/api/library/CAIS_AT`, fetcher);",
        "const { data: caisAtData } = useSWR(`/api/library/CAIS_AT`, fetcher);\n  const { data: pileTypeData } = useSWR(`/api/library/PILE_TYP`, fetcher);\n  const { data: pileMatData } = useSWR(`/api/library/PILE_MAT`, fetcher);"
    );

    // Labels
    editContent = editContent.replace(
        "if (key === 'electrically_cont') label = 'Electrically Continuous';",
        "if (key === 'electrically_cont') label = 'Electrically Continuous';\n                        if (key === 'pile_typ') label = 'Pile Types';\n                        if (key === 'pile_mat') label = 'Pile Materials';"
    );

    // Dropdowns
    const pileDropdownsEdit = `
                        // Render pile dropdowns
                        if (key === 'pile_typ' && formData.code?.toLowerCase() === 'pl') {
                          return (
                            <div key={key} className="space-y-2">
                              <Label htmlFor={\`edit-\${key}\`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                              <Select
                                value={value || ""}
                                onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                                disabled={!pileTypeData}
                              >
                                <SelectTrigger id={\`edit-\${key}\`} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                  <SelectValue placeholder="Select pile type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {pileTypeData?.data?.map((x: any) => (
                                    <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                      {x.lib_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        if (key === 'pile_mat' && formData.code?.toLowerCase() === 'pl') {
                          return (
                            <div key={key} className="space-y-2">
                              <Label htmlFor={\`edit-\${key}\`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                              <Select
                                value={value || ""}
                                onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                                disabled={!pileMatData}
                              >
                                <SelectTrigger id={\`edit-\${key}\`} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                  <SelectValue placeholder="Select pile material" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {pileMatData?.data?.map((x: any) => (
                                    <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                      {x.lib_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }
`;
    // Find where clamp dropdowns are rendered in edit dialog
    editContent = editContent.replace("// Render clamp dropdowns", pileDropdownsEdit + "                        // Render clamp dropdowns");

    fs.writeFileSync(editDialogPath, editContent, 'utf8');
    console.log('Edit Dialog updated');
} catch (e) { console.error('Edit Dialog error:', e.message); }
