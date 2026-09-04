"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Sparkles,
  Settings,
  Zap,
  Square,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Keyboard,
  X,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Re-import shared constants from PipelineEventMenuPanel
// ---------------------------------------------------------------------------
import {
  PIPELINE_EVENT_CATEGORIES,
  TOGGLE_PAIRS,
  INITIAL_SHORTCUT_IDS,
} from "./PipelineEventMenuPanel";

// ---------------------------------------------------------------------------
// localStorage keys (must match PipelineEventMenuPanel exactly)
// ---------------------------------------------------------------------------
const LS_PINNED   = "pipeline_event_pinned_shortcuts";
const LS_TOGGLES  = "pipeline_event_active_toggles";
const LS_HOTKEYS  = "pipeline_event_custom_hotkeys";

const DEFAULT_HOTKEYS: Record<string, string> = {
  span_start:           "Alt+1",
  anode_bracelet_0_25:  "Alt+2",
  cp_stab_anode:        "Alt+3",
  fj_start:             "Alt+4",
  debris_pipe:          "Alt+5",
  line_skip_start:      "Alt+6",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface QuickShortcutsPanelProps {
  /** Fires the same event payload shape as PipelineEventMenuPanel.onSelectEvent */
  onSelectEvent: (eventData: {
    eventName: string;
    eventType: string;
    eventPosition?: string;
    actionName?: string;
    eventCategory: string;
    description: string;
    eventDescription?: string;
    findingType?: string;
    findings?: string;
    kp?: string | number;
    kpSource?: "ROV_DATA_STRING" | "CALCULATED";
  }) => void;
  /** Current KP for display only */
  currentKp?: number | string;
  inspMethod?: "DIVING" | "ROV";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuickShortcutsPanel({
  onSelectEvent,
  currentKp = "0.000",
  inspMethod = "ROV",
}: QuickShortcutsPanelProps) {
  // ─── State (mirrors PipelineEventMenuPanel localStorage keys) ──────────
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const loaded = readLS<string[]>(LS_PINNED, []);
    const sanitized = loaded.filter((id) => !TOGGLE_PAIRS.some((p) => p.endId === id));
    return sanitized.length > 0 ? sanitized : INITIAL_SHORTCUT_IDS;
  });

  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>(() =>
    readLS<Record<string, boolean>>(LS_TOGGLES, {})
  );

  const [customHotkeys, setCustomHotkeys] = useState<Record<string, string>>(() =>
    readLS<Record<string, string>>(LS_HOTKEYS, DEFAULT_HOTKEYS)
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  const [settingsSearch, setSettingsSearch] = useState("");

  // ─── Container ref for ResizeObserver (auto columns) ──────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        // Each tile ~80px min width; max 10 cols
        const computed = Math.max(2, Math.min(10, Math.floor(w / 82)));
        setCols(computed);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Cross-window & In-App Event Sync ──────────────────────────────────────
  useEffect(() => {
    const syncFromLS = () => {
      const pins = readLS<string[]>(LS_PINNED, []);
      const sanitized = pins.filter((id) => !TOGGLE_PAIRS.some((p) => p.endId === id));
      const effective = sanitized.length > 0 ? sanitized : INITIAL_SHORTCUT_IDS;
      setPinnedIds(effective);

      const toggles = readLS<Record<string, boolean>>(LS_TOGGLES, {});
      setActiveToggles(toggles);

      const hks = readLS<Record<string, string>>(LS_HOTKEYS, DEFAULT_HOTKEYS);
      setCustomHotkeys(hks);
    };

    const handler = (e: StorageEvent) => {
      if (e.key === LS_PINNED && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as string[];
          setPinnedIds(parsed.filter((id) => !TOGGLE_PAIRS.some((p) => p.endId === id)));
        } catch { /* ignore */ }
      }
      if (e.key === LS_TOGGLES && e.newValue) {
        try { setActiveToggles(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
      if (e.key === LS_HOTKEYS && e.newValue) {
        try { setCustomHotkeys(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };

    window.addEventListener("storage", handler);
    window.addEventListener("pipeline_shortcuts_changed", syncFromLS);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("pipeline_shortcuts_changed", syncFromLS);
    };
  }, []);

  // ─── Flattened events master list ───────────────────────────────────────
  const allFlattenedEvents = useMemo(() => {
    type FlatEvt = {
      id: string; label: string; cat: string; sub: string;
      event: string; catId: string; icon: React.ReactNode; colorClass: string;
    };
    const list: FlatEvt[] = [];
    PIPELINE_EVENT_CATEGORIES.forEach((cat) => {
      cat.subCategories.forEach((subCat) => {
        (subCat as any).subEvents?.forEach((evt: any) => {
          list.push({
            id: evt.id, label: evt.name, cat: cat.name, sub: subCat.name,
            event: evt.name, catId: cat.id, icon: cat.icon, colorClass: cat.colorClass,
          });
        });
      });
    });
    return list;
  }, []);

  // ─── Active shortcuts (respects toggle pairs and search) ────────────────
  const activeShortcuts = useMemo(() => {
    const effectiveIds = pinnedIds.length > 0 ? pinnedIds : INITIAL_SHORTCUT_IDS;
    const list = effectiveIds
      .map((id) => allFlattenedEvents.find((e) => e.id === id))
      .filter(Boolean) as typeof allFlattenedEvents;

    const pairedList = list.filter((item) => {
      const pair = TOGGLE_PAIRS.find((p) => p.startId === item.id || p.endId === item.id);
      if (!pair) return true;
      const isActive = !!activeToggles[pair.groupKey];
      return isActive ? item.id === pair.endId : item.id === pair.startId;
    });

    if (!panelSearch.trim()) return pairedList;
    const q = panelSearch.toLowerCase().trim();
    return pairedList.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sub.toLowerCase().includes(q) ||
        item.cat.toLowerCase().includes(q)
    );
  }, [pinnedIds, allFlattenedEvents, activeToggles, panelSearch]);

  // ─── Active in-progress events banner ───────────────────────────────────
  const activeEventsList = useMemo(() => {
    return TOGGLE_PAIRS
      .filter((p) => activeToggles[p.groupKey])
      .map((p) => ({
        groupKey: p.groupKey,
        label: p.groupKey.toUpperCase().replace("_", " "),
        endId: p.endId,
        catName: allFlattenedEvents.find((e) => e.id === p.endId)?.cat ?? "",
        subCatName: allFlattenedEvents.find((e) => e.id === p.endId)?.sub ?? "",
        endEventName: allFlattenedEvents.find((e) => e.id === p.endId)?.event ?? "",
      }));
  }, [activeToggles, allFlattenedEvents]);

  // ─── Hotkey badge helper ─────────────────────────────────────────────────
  const getHotkey = useCallback((id: string, idx: number) => {
    if (customHotkeys[id]) return customHotkeys[id];
    if (idx < 6) return `Alt+${idx + 1}`;
    return null;
  }, [customHotkeys]);

  // ─── Handle button click (fires onSelectEvent & updates toggle state) ───
  const handleClick = useCallback((sc: typeof allFlattenedEvents[0]) => {
    const pair = TOGGLE_PAIRS.find((p) => p.startId === sc.id || p.endId === sc.id);
    const isEndEvent = pair ? sc.id === pair.endId : false;

    if (pair) {
      const next = { ...activeToggles };
      if (isEndEvent) {
        delete next[pair.groupKey];
      } else {
        next[pair.groupKey] = true;
      }
      setActiveToggles(next);
      localStorage.setItem(LS_TOGGLES, JSON.stringify(next));
    }

    const kp = parseFloat(String(currentKp)) || 0;
    onSelectEvent({
      eventName: sc.cat,
      eventType: sc.sub,
      eventPosition: isEndEvent ? "END" : "START",
      actionName: sc.event,
      eventCategory: sc.cat,
      description: sc.event,
      eventDescription: sc.event,
      kp: kp.toFixed(4),
      kpSource: "CALCULATED",
    });
  }, [activeToggles, currentKp, onSelectEvent]);

  // ─── Global Keyboard Listener for Custom Hotkeys ────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      const keyUpper = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyUpper);

      const pressedCombo = parts.join("+");

      const match = activeShortcuts.find((sc, index) => {
        const assigned = getHotkey(sc.id, index);
        return assigned && assigned.toUpperCase() === pressedCombo.toUpperCase();
      });

      if (match) {
        e.preventDefault();
        e.stopPropagation();
        handleClick(match);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeShortcuts, getHotkey, handleClick]);

  // ─── Handle stop banner click ────────────────────────────────────────────
  const handleStop = useCallback((groupKey: string, endId: string) => {
    const sc = allFlattenedEvents.find((e) => e.id === endId);
    if (!sc) return;
    const next = { ...activeToggles };
    delete next[groupKey];
    setActiveToggles(next);
    localStorage.setItem(LS_TOGGLES, JSON.stringify(next));

    const kp = parseFloat(String(currentKp)) || 0;
    onSelectEvent({
      eventName: sc.cat,
      eventType: sc.sub,
      eventPosition: "END",
      actionName: sc.event,
      eventCategory: sc.cat,
      description: sc.event,
      eventDescription: sc.event,
      kp: kp.toFixed(4),
      kpSource: "CALCULATED",
    });
  }, [activeToggles, allFlattenedEvents, currentKp, onSelectEvent]);

  // ─── Settings panel helpers ──────────────────────────────────────────────
  const movePinned = (index: number, dir: -1 | 1) => {
    setPinnedIds((prev) => {
      const cur = prev.length > 0 ? prev : INITIAL_SHORTCUT_IDS;
      const target = index + dir;
      if (target < 0 || target >= cur.length) return prev;
      const next = [...cur];
      [next[index], next[target]] = [next[target], next[index]];
      localStorage.setItem(LS_PINNED, JSON.stringify(next));
      return next;
    });
  };

  const removePinned = (id: string) => {
    setPinnedIds((prev) => {
      const next = (prev.length > 0 ? prev : INITIAL_SHORTCUT_IDS).filter((x) => x !== id);
      localStorage.setItem(LS_PINNED, JSON.stringify(next));
      return next;
    });
  };

  const togglePinned = (id: string, checked: boolean) => {
    setPinnedIds((prev) => {
      const cur = prev.length > 0 ? prev : INITIAL_SHORTCUT_IDS;
      const next = checked ? [...cur, id] : cur.filter((x) => x !== id);
      localStorage.setItem(LS_PINNED, JSON.stringify(next));
      return next;
    });
  };

  const resetPins = () => {
    setPinnedIds(INITIAL_SHORTCUT_IDS);
    setCustomHotkeys(DEFAULT_HOTKEYS);
    localStorage.setItem(LS_PINNED, JSON.stringify(INITIAL_SHORTCUT_IDS));
    localStorage.setItem(LS_HOTKEYS, JSON.stringify(DEFAULT_HOTKEYS));
  };

  // ─── Grid column inline style ────────────────────────────────────────────
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap: "6px",
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-slate-100/90 dark:bg-[#0a0f1c] overflow-hidden font-sans">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100/90 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
            Quick Log
          </span>
          <Badge
            variant="secondary"
            className="text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-1.5"
          >
            {activeShortcuts.length} Items
          </Badge>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition bg-white dark:bg-slate-950 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm"
          title="Configure Quick Log shortcuts, reorder, & assign hotkeys"
        >
          <Settings className="w-3 h-3 text-slate-500" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* ── Quick Search Bar ─────────────────────────────────────────────── */}
      <div className="p-2 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <Input
            value={panelSearch}
            onChange={(e) => setPanelSearch(e.target.value)}
            placeholder="Search quick events..."
            className="h-8 pl-8 text-[11px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:ring-1 focus:ring-blue-500 font-normal"
          />
          {panelSearch && (
            <button
              onClick={() => setPanelSearch("")}
              className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Active in-progress banner ─────────────────────────────────────── */}
      {activeEventsList.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-400/50 px-2.5 py-1.5 shrink-0 flex items-center gap-1.5 flex-wrap">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="text-[9.5px] font-black uppercase text-amber-900 dark:text-amber-200 tracking-wider shrink-0">
            ACTIVE:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {activeEventsList.map((a) => (
              <button
                key={a.groupKey}
                onClick={() => handleStop(a.groupKey, a.endId)}
                className="h-6 px-2.5 rounded-md bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-700 hover:to-amber-700 active:scale-95 text-white font-black text-[9px] tracking-wider uppercase shadow-sm border border-red-400/60 flex items-center gap-1.5 transition-all shrink-0"
                title={`Stop ${a.label} event`}
              >
                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                {a.label}
                <span className="bg-black/35 px-1.5 py-0.5 rounded text-[8px] font-black flex items-center gap-1 border border-white/20">
                  <Square className="w-2 h-2 fill-white text-white" /> STOP
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Auto-sizing shortcut grid ─────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2"
      >
        {activeShortcuts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-600 text-[11px] text-center p-4 gap-2">
            <Sparkles className="w-6 h-6 opacity-40" />
            <span>
              {panelSearch ? `No quick log item matching "${panelSearch}"` : "No shortcuts pinned. Click Settings to configure."}
            </span>
          </div>
        ) : (
          <div style={gridStyle}>
            {activeShortcuts.map((sc, index) => {
              const isEndActive = TOGGLE_PAIRS.some(
                (p) => p.endId === sc.id && activeToggles[p.groupKey]
              );
              const hkBadge = getHotkey(sc.id, index);
              return (
                <button
                  key={sc.id}
                  onClick={() => handleClick(sc)}
                  className={[
                    "w-full p-1.5 rounded-xl transition-all flex flex-col items-center justify-between group shadow-sm",
                    "hover:shadow-md hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden",
                    "min-h-[72px]",
                    isEndActive
                      ? "border-2 border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 ring-2 ring-amber-400/50"
                      : "border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-500 dark:hover:border-blue-400",
                  ].join(" ")}
                  title={isEndActive ? `Stop ${sc.event}` : `Quick log ${sc.event}`}
                >
                  {/* Badge: IN PROGRESS or hotkey */}
                  {isEndActive ? (
                    <span className="absolute top-1 right-1 text-[7px] font-black uppercase px-1 py-0.5 rounded bg-amber-500 text-white shadow-sm animate-pulse">
                      IN PROG
                    </span>
                  ) : hkBadge ? (
                    <span
                      className="absolute top-1 left-1 text-[7px] font-mono font-black uppercase px-1 py-0.5 rounded bg-slate-800 text-amber-300 dark:bg-slate-200 dark:text-slate-900 border border-amber-400/40 shadow-sm"
                      title={`Press ${hkBadge} to quick-log`}
                    >
                      {hkBadge}
                    </span>
                  ) : null}

                  {/* Icon */}
                  <div className="flex-1 flex items-center justify-center p-0.5 pt-3">
                    <div
                      className={[
                        "p-1.5 rounded-lg transition-all shrink-0 shadow-sm",
                        isEndActive
                          ? "bg-amber-500 text-white"
                          : "bg-slate-100 dark:bg-slate-900 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white",
                      ].join(" ")}
                    >
                      <span className="[&_svg]:w-5 [&_svg]:h-5 block">{sc.icon}</span>
                    </div>
                  </div>

                  {/* Label */}
                  <div
                    className={[
                      "w-full text-center px-1 py-0.5 rounded-md shrink-0 mt-1 min-h-[24px] flex items-center justify-center border",
                      isEndActive
                        ? "bg-amber-100/90 dark:bg-amber-900/90 border-amber-300 dark:border-amber-700"
                        : "bg-slate-100/90 dark:bg-slate-900/90 border-slate-200/60 dark:border-slate-800",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "text-[9px] font-semibold leading-snug text-center block max-w-full break-words line-clamp-2",
                        isEndActive
                          ? "text-amber-950 dark:text-amber-100"
                          : "text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300",
                      ].join(" ")}
                    >
                      {sc.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="bg-slate-100 dark:bg-[#090d16] border-t border-slate-200 dark:border-slate-800 px-3 py-1 text-[9.5px] text-slate-500 dark:text-slate-500 flex justify-between items-center shrink-0">
        <span className="font-semibold">Mode: {inspMethod} Survey</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold">{cols} cols · {activeShortcuts.length} items</span>
      </div>

      {/* ── Settings Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden font-sans">
          <DialogHeader className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-amber-500" /> Quick Log Settings — Order &amp; Hotkeys
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reorder items, assign custom hotkeys (e.g. Alt+1, Ctrl+1), or search to pin new events.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 max-h-[440px] overflow-y-auto custom-scrollbar space-y-4">
            {/* Order & Custom Hotkey Assignment */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Order &amp; Custom Hotkeys
                </span>
                <span className="text-[9px] font-normal text-amber-700 dark:text-amber-300">
                  Alt, Ctrl, Shift + Key
                </span>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {(pinnedIds.length > 0 ? pinnedIds : INITIAL_SHORTCUT_IDS).map((id, index) => {
                  const evt = allFlattenedEvents.find((e) => e.id === id);
                  if (!evt) return null;
                  const currentHotkey = getHotkey(id, index) || "";

                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] shadow-2xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[9px] font-black text-slate-400 w-4 shrink-0">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {evt.label}
                          </div>
                          <div className="text-[8.5px] text-slate-400 truncate">
                            {evt.cat} › {evt.sub}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Reorder Up / Down Controls */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => movePinned(index, -1)}
                            disabled={index === 0}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => movePinned(index, 1)}
                            disabled={index === (pinnedIds.length > 0 ? pinnedIds : INITIAL_SHORTCUT_IDS).length - 1}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Editable Custom Hotkey Input */}
                        <input
                          type="text"
                          value={currentHotkey}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = { ...customHotkeys, [id]: val };
                            setCustomHotkeys(updated);
                            localStorage.setItem(LS_HOTKEYS, JSON.stringify(updated));
                          }}
                          placeholder="Hotkey"
                          className="w-20 h-6.5 px-1 text-[10px] font-mono font-extrabold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded text-center focus:ring-1 focus:ring-amber-500 uppercase"
                          title="Type hotkey combo e.g. Alt+1, Ctrl+S, Shift+A"
                        />

                        <button
                          onClick={() => removePinned(id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-red-500"
                          title="Remove pin"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Events Selection with Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  All Pipeline Events — Check to Pin
                </span>
                <Badge variant="outline" className="text-[9px] font-bold">
                  {(pinnedIds.length > 0 ? pinnedIds : INITIAL_SHORTCUT_IDS).length} Pinned
                </Badge>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  value={settingsSearch}
                  onChange={(e) => setSettingsSearch(e.target.value)}
                  placeholder="Search events to pin (Anode, CP, Span, Skip...)"
                  className="h-8 pl-8 text-[11px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
                {settingsSearch && (
                  <button
                    onClick={() => setSettingsSearch("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-0.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                {allFlattenedEvents
                  .filter((e) => {
                    if (TOGGLE_PAIRS.some((p) => p.endId === e.id)) return false;
                    if (!settingsSearch.trim()) return true;
                    const q = settingsSearch.toLowerCase().trim();
                    return (
                      e.label.toLowerCase().includes(q) ||
                      e.sub.toLowerCase().includes(q) ||
                      e.cat.toLowerCase().includes(q)
                    );
                  })
                  .map((e) => {
                    const isPinned = (pinnedIds.length > 0 ? pinnedIds : INITIAL_SHORTCUT_IDS).includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Checkbox
                          checked={isPinned}
                          onCheckedChange={(checked) => togglePinned(e.id, !!checked)}
                          className="border-slate-400 dark:border-slate-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {e.label}
                          </div>
                          <div className="text-[8.5px] text-slate-400 truncate">
                            {e.cat} › {e.sub}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <button
              onClick={resetPins}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Defaults
            </button>
            <Button
              size="sm"
              onClick={() => {
                setIsSettingsOpen(false);
                setSettingsSearch("");
              }}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 h-8"
            >
              Done &amp; Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
