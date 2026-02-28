const fs = require('fs');

let code = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');

if (!code.includes("logType: 'video_log'")) {
    const syncDeploymentStateRe = /let currentTape = tapeId;[\s\S]*?setCurrentRecords\(\[\]\);\s*\}/;

    const newSyncCode = `let currentTape = tapeId;
            const { data: tapes } = await supabase.from('insp_video_tapes').select('*').eq(inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id', activeDep.id).order('cr_date', { ascending: false });
            if (tapes && tapes.length > 0) {
                setTapeNo(tapes[0].tape_no);
                setTapeId(tapes[0].tape_id);
                currentTape = tapes[0].tape_id;
            } else {
                setTapeNo(\`VDO-\${new Date().getFullYear()}-01\`);
                setVideoEvents([]);
                setTapeId(null);
            }

            let allEv: any[] = [];
            if (currentTape) {
                const { data: logs } = await supabase.from('insp_video_logs').select('*').eq('tape_id', currentTape).order('event_time', { ascending: false });
                if (logs) {
                    allEv.push(...logs.map(l => ({ id: \`log_\${l.video_log_id}\`, realId: l.video_log_id, time: l.timecode_start || '00:00:00', action: l.event_type, logType: 'video_log' })));
                }
            }

            // 3. Inspections (Session Records)
            const inspCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
            const { data: insps } = await supabase.from('insp_records').select(\`
                *,
                inspection_type!left(id, code, name),
                structure_components:component_id!left (q_id)
            \`).eq(inspCol, activeDep.id).order('inspection_date', { ascending: false }).order('inspection_time', { ascending: false }).order('insp_id', { ascending: false });
            
            if (insps) {
                setCurrentRecords(insps);
                const formatCounter = (val: any) => {
                    if (!val) return null;
                    if (typeof val === 'string' && val.includes(':')) return val;
                    const sec = Number(val);
                    if (!isNaN(sec)) {
                        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                        const s = Math.floor(sec % 60).toString().padStart(2, '0');
                        return \`\${h}:\${m}:\${s}\`;
                    }
                    return null;
                };

                allEv.push(...insps.map(r => {
                    const status = r.has_anomaly || (r.status === 'Anomaly' || r.status === 'Defect') ? 'ANOMALY' : 'INSPECTION';
                    const timeStr = r.inspection_data?._meta_timecode || formatCounter(r.tape_count_no) || r.video_time_start || '00:00:00';
                    return {
                        id: \`insp_\${r.insp_id}\`,
                        realId: r.insp_id,
                        time: timeStr,
                        action: status,
                        logType: 'insp'
                    };
                }));
            } else {
                setCurrentRecords([]);
            }

            const timeToSecs = (t: string) => {
                if (!t || typeof t !== 'string') return 0;
                const parts = t.split(':').map(Number);
                if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
                return 0;
            };
            allEv.sort((a,b) => timeToSecs(b.time) - timeToSecs(a.time));
            setVideoEvents(allEv);\n        }`;

    code = code.replace(syncDeploymentStateRe, newSyncCode);

    // update handleLogEvent
    const handleLogEventRe = /const handleLogEvent = async \(action: string\) => \{[\s\S]*?setVidState\("IDLE"\);\s*\};/;
    const newHandleLogEvent = `const handleLogEvent = async (action: string) => {
        const optimisticId = \`log_\${Date.now()}\`;
        const tcode = formatTime(vidTimer);
        setVideoEvents([{ id: optimisticId, realId: 0, time: tcode, action, logType: 'video_log' }, ...videoEvents]);

        let tId = tapeId;
        if (!tId && activeDep?.id) {
            const user = (await supabase.auth.getUser()).data.user;
            const { data: newTape } = await supabase.from('insp_video_tapes').insert({
                tape_no: tapeNo,
                tape_type: "DIGITAL - PRIMARY",
                status: 'ACTIVE',
                [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: activeDep.id,
                cr_user: user?.id || 'system'
            }).select('tape_id').single();
            if (newTape) {
                setTapeId(newTape.tape_id);
                tId = newTape.tape_id;
            }
        }
        if (tId) {
            const { data: newLog } = await supabase.from('insp_video_logs').insert({
                tape_id: tId,
                event_type: action,
                event_time: new Date().toISOString(),
                timecode_start: tcode,
                tape_counter_start: vidTimer,
                remarks: ""
            }).select('video_log_id').single();
            
            if (newLog) {
                setVideoEvents(prev => prev.map(ev => ev.id === optimisticId ? { ...ev, id: \`log_\${newLog.video_log_id}\`, realId: newLog.video_log_id } : ev));
            }
        }

        if (action === "Start Tape" || action === "Resume") setVidState("RECORDING");
        if (action === "Pause") setVidState("PAUSED");
        if (action === "Stop Tape") setVidState("IDLE");
    };`;

    code = code.replace(handleLogEventRe, newHandleLogEvent);

    // update handleDeleteEvent
    const handleDeleteEventRe = /const handleDeleteEvent = async \(id: number\) => \{\s*setVideoEvents\(videoEvents\.filter\(ev => ev\.id !== id\)\);\s*await supabase\.from\('insp_video_logs'\)\.delete\(\)\.eq\('video_log_id', id\);\s*\};/;
    const newHandleDeleteEvent = `const handleDeleteEvent = async (id: string, logType: string, realId: number) => {
        if (!confirm("Delete this event?")) return;
        setVideoEvents(videoEvents.filter(ev => ev.id !== id));
        if (logType === 'video_log') {
            await supabase.from('insp_video_logs').delete().eq('video_log_id', realId);
        } else if (logType === 'insp') {
            await handleDeleteRecord(realId);
        }
    };`;

    code = code.replace(handleDeleteEventRe, newHandleDeleteEvent);

    // update handleEditEventSave
    const handleEditEventSaveRe = /const handleEditEventSave = async \(tcode: string, newAction: string\) => \{[\s\S]*?\};/;
    const newHandleEditEventSave = `const handleEditEventSave = async (tcode: string, newAction: string) => {
        if (!editingEvent?.id) return;
        setVideoEvents(videoEvents.map(ev => ev.id === editingEvent.id ? { ...ev, time: tcode, action: newAction } : ev));
        if (editingEvent.logType === 'video_log') {
            await supabase.from('insp_video_logs').update({
                timecode_start: tcode,
                event_type: newAction
            }).eq('video_log_id', editingEvent.realId);
        }
        setEditingEvent(null);
    };`;
    code = code.replace(handleEditEventSaveRe, newHandleEditEventSave);

    // update UI
    const uiRe = /<div className="flex gap-0\.5 opacity-20 group-hover:opacity-100 transition-opacity">\s*<button onClick=\{\(\) => setEditingEvent\(ev\)\}.*?<\/button>\s*<button onClick=\{\(\) => handleDeleteEvent\(ev\.id\)\}.*?<\/button>\s*<\/div>/;
    const newUi = `<div className="flex gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingEvent(ev)} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Modify Event" disabled={ev.logType === 'insp'}><Edit className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)} className="p-1 hover:bg-red-50 rounded text-red-500" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>`;

    code = code.replace(uiRe, newUi);

    // Also handle the style changes: if logType === 'insp', text should be blue/red instead of green/amber etc.
    const uiStyleRe = /<span className=\{\`font-bold \$\{ev\.action === 'Start Tape'[\s\S]*?\}\`\}>\{ev\.action\}<\/span>/;
    const newUiStyle = `<span className={\`font-bold \${ev.action === 'Start Tape' || ev.action === 'Resume' ? 'text-green-600' : ev.action === 'Pause' ? 'text-amber-600' : ev.action === 'Stop Tape' ? 'text-red-600' : ev.action === 'ANOMALY' ? 'text-red-600 tracking-wider text-[9px]' : 'text-blue-600 tracking-wider text-[9px]'}\`}>{ev.action}</span>`;
    code = code.replace(uiStyleRe, newUiStyle);


    // We must also ensure handleCommitRecord updates videoEvents
    const handleCommitRe = /const newRecDisplay = \{[\s\S]*?hasPhoto: photoLinked\s*\};\s*setCurrentRecords\(\[newRecDisplay, \.\.\.currentRecords\]\);/;
    const newHandleCommit = `const newRecDisplay = {
                insp_id: newRecord.record_id, 
                id: newRecord.record_id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: activeSpec,
                comp: selectedComp.name,
                status: findingType,
                timer: formatTime(vidTimer),
                hasPhoto: photoLinked,
                inspection_date: new Date().toISOString(),
                inspection_type: { name: activeSpec, code: activeSpec }
            };
            setCurrentRecords([newRecDisplay, ...currentRecords]);

            const newInspEvent = {
                id: \`insp_\${newRecord.record_id}\`,
                realId: newRecord.record_id,
                time: formatTime(vidTimer),
                action: findingType === 'Anomaly' ? 'ANOMALY' : 'INSPECTION',
                logType: 'insp'
            };
            setVideoEvents([newInspEvent, ...videoEvents].sort((a,b) => {
                const timeToSecs = (t: string) => {
                    if (!t || typeof t !== 'string') return 0;
                    const parts = t.split(':').map(Number);
                    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
                    return 0;
                };
                return timeToSecs(b.time) - timeToSecs(a.time);
            }));`;
    code = code.replace(handleCommitRe, newHandleCommit);

    fs.writeFileSync('app/dashboard/inspection-v2/workspace/page.tsx', code);
    console.log('Done script replacement');
} else {
    console.log('Already patched');
}
