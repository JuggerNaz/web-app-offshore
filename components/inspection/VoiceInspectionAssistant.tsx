"use client";

import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Check,
  RotateCcw,
  Volume2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Activity,
  PlusCircle,
  Copy,
  CheckCircle2,
  Layers,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { ParsedVoiceInspection } from "@/app/api/ai/parse-inspection-voice/route";

import { correctOffshoreTerminology } from "@/utils/offshore-spellcheck";

interface VoiceInspectionAssistantProps {
  inspMethod?: "DIVING" | "ROV";
  structureType?: "platform" | "pipeline";
  componentInfo?: {
    name?: string;
    type?: string;
    elevation?: string;
    depth?: string;
  };
  activeSpec?: string;
  availableFields?: string[];
  onApplyExtraction: (parsedData: ParsedVoiceInspection) => void;
  className?: string;
  variant?: "compact" | "full" | "button-only";
}

export const VoiceInspectionAssistant: React.FC<VoiceInspectionAssistantProps> = ({
  inspMethod = "ROV",
  structureType = "platform",
  componentInfo = {},
  activeSpec = "",
  availableFields = [],
  onApplyExtraction,
  className = "",
  variant = "compact",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [lastParsedResult, setLastParsedResult] = useState<ParsedVoiceInspection | null>(null);
  const [autoApply, setAutoApply] = useState(true);

  const {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  } = useVoiceRecognition({
    continuous: true,
    interimResults: true,
  });

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      if (fullTranscript) {
        setTranscript(correctOffshoreTerminology(fullTranscript));
      }
    } else {
      if (!isSupported) {
        toast.error("Browser speech recognition is not supported. Please use Google Chrome or Edge.");
        return;
      }
      resetTranscript();
      setLastParsedResult(null);
      startListening();
      if (!isOpen) setIsOpen(true);
    }
  };

  const handleProcessWithAI = async (customText?: string) => {
    const rawText = (customText || fullTranscript).trim();
    if (!rawText) {
      toast.warning("No spoken voice text recorded to process.");
      return;
    }

    if (isListening) {
      stopListening();
    }

    const textToProcess = correctOffshoreTerminology(rawText);
    setTranscript(textToProcess);

    setIsProcessingAI(true);
    try {
      const response = await fetch("/api/ai/parse-inspection-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToProcess,
          inspMethod,
          structureType,
          componentInfo,
          activeSpec,
          availableFields,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI parse failed with status: ${response.status}`);
      }

      const parsed: ParsedVoiceInspection = await response.json();
      setLastParsedResult(parsed);

      if (autoApply) {
        onApplyExtraction(parsed);
        const fieldCount = Object.keys(parsed.extracted_fields || {}).length;
        const extraCount = parsed.additional_readings?.length || 0;
        toast.success("✨ Voice data parsed & auto-filled!", {
          description: `Updated ${fieldCount} field(s)${extraCount > 0 ? `, added ${extraCount} extra reading(s)` : ""}${parsed.finding_type !== "Complete" ? ` [${parsed.finding_type}]` : ""}.`,
        });
      } else {
        toast.info("✨ Voice parsed! Review extraction below and click 'Apply to Form'.");
      }
    } catch (err: any) {
      console.error("AI Parse Error:", err);
      toast.error("Failed to parse voice transcript with AI. Check connection or API keys.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleManualApply = () => {
    if (lastParsedResult) {
      onApplyExtraction(lastParsedResult);
      const fieldCount = Object.keys(lastParsedResult.extracted_fields || {}).length;
      toast.success("✨ Form updated successfully from voice log!", {
        description: `Applied ${fieldCount} fields and findings summary.`,
      });
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* TRIGGER BAR */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          onClick={handleToggleListening}
          className={`h-7 px-2 text-[10px] font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-1.5 ${
            isListening
              ? "bg-red-600 hover:bg-red-700 text-white animate-pulse ring-2 ring-red-400"
              : "bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 text-white"
          }`}
          title={isListening ? "Stop Listening & Parse" : "Start Spoken Voice Log (AI Assistant)"}
        >
          {isListening ? (
            <>
              <MicOff className="w-3.5 h-3.5 animate-bounce" />
              <span>Recording...</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Voice AI Log</span>
            </>
          )}
        </Button>

        {(fullTranscript || lastParsedResult || isListening || isOpen) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen((prev) => !prev)}
            className="h-7 px-2 text-[10px] font-bold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
            <span>AI Scribe</span>
            {isOpen ? (
              <ChevronUp className="w-3 h-3 ml-1" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-1" />
            )}
          </Button>
        )}
      </div>

      {/* DROPDOWN / EXPANDABLE PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 min-w-[340px] max-w-[560px] bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800/80 rounded-xl shadow-2xl overflow-hidden p-3 text-slate-800 dark:text-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                  <Wand2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    Offshore AI Voice Scribe
                    <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 border-indigo-300 dark:border-indigo-700">
                      {inspMethod} • {structureType.toUpperCase()}
                    </Badge>
                  </h4>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">
                    Dictate CP, UT, MGI, elevation, defects & findings with auto Oil & Gas spell check
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[9px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer mr-1">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    className="w-3 h-3 rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Auto-Apply</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Live Audio Visualizer / Status */}
            {isListening && (
              <div className="mb-2.5 p-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 rounded-lg flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1 h-5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1 h-4 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    <span className="w-1 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "100ms" }}></span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200">
                    Listening to voice dictation...
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleToggleListening}
                  className="h-6 px-2 text-[9px] font-black uppercase tracking-wider"
                >
                  Done Speaking
                </Button>
              </div>
            )}

            {/* Transcript Area */}
            <div className="space-y-1 mb-2.5">
              <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-indigo-500" />
                    Raw Voice Transcript
                  </span>
                  <Badge variant="outline" className="text-[7.5px] px-1 py-0 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                    🛡️ O&G Spell Check Active
                  </Badge>
                </div>
                {fullTranscript && (
                  <button
                    type="button"
                    onClick={resetTranscript}
                    className="hover:text-red-500 flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <textarea
                  value={fullTranscript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Spoken words appear here automatically... or type custom notes to parse (e.g. 'CP reading -980mV at -15m, 45mm marine growth, pitting at 3 o'clock, extra UT 14.2mm at 12 o'clock')."
                  className="w-full min-h-[64px] max-h-[100px] text-xs font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  disabled={isProcessingAI || (!fullTranscript.trim() && !isListening)}
                  onClick={() => handleProcessWithAI()}
                  className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm"
                >
                  {isProcessingAI ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Parse & Fill Form
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleListening}
                  className={`h-7 px-2 text-[10px] font-bold border-slate-300 dark:border-slate-700 ${
                    isListening ? "text-red-600 border-red-300" : ""
                  }`}
                >
                  {isListening ? "Stop Mic" : "Start Mic"}
                </Button>
              </div>

              {lastParsedResult && !autoApply && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleManualApply}
                  className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                >
                  <Check className="w-3 h-3 mr-1" /> Apply to Form
                </Button>
              )}
            </div>

            {/* Quick Spoken Command Shortcuts Tip */}
            <div className="mb-2 px-2 py-1 bg-slate-100 dark:bg-slate-950/60 rounded border border-slate-200/60 dark:border-slate-800 text-[8.5px] font-semibold text-slate-500 flex flex-wrap gap-x-2 gap-y-1 items-center">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">💡 Voice Commands:</span>
              <span>"SKOPL381 Bracelet Anode depleted 10-20%"</span>
              <span>•</span>
              <span>"Save record"</span>
              <span>•</span>
              <span>"Next component"</span>
              <span>•</span>
              <span>"Capture photo"</span>
              <span>•</span>
              <span>"Switch to DIVING / ROV"</span>
            </div>

            {/* Parsed Preview Card */}
            {lastParsedResult && (
              <div className="p-2.5 rounded-lg border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
                      AI Structured Extraction
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {lastParsedResult.action_intent?.action && (
                      <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700">
                        ⚡ {lastParsedResult.action_intent.action.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {lastParsedResult.action_intent?.target_component_id && (
                      <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 uppercase bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700">
                        🎯 {lastParsedResult.action_intent.target_component_id}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        lastParsedResult.finding_type === "Anomaly"
                          ? "destructive"
                          : lastParsedResult.finding_type === "Finding"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[9px] font-black px-1.5 py-0 uppercase"
                    >
                      {lastParsedResult.finding_type}
                    </Badge>
                  </div>
                </div>

                {/* Extracted Form Values */}
                {Object.keys(lastParsedResult.extracted_fields || {}).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {Object.entries(lastParsedResult.extracted_fields).map(([k, v]) => (
                      <div
                        key={k}
                        className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-[10px]"
                      >
                        <span className="text-[8px] font-black uppercase text-slate-400 block truncate" title={k}>
                          {k.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Additional Multi-Readings */}
                {lastParsedResult.additional_readings && lastParsedResult.additional_readings.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-slate-500 block">
                      Additional Multi-Readings ({lastParsedResult.additional_readings.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {lastParsedResult.additional_readings.map((r, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300"
                        >
                          <span className="text-indigo-500 mr-1">{r.type}:</span>
                          {r.reading} {r.location ? `(${r.location})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Findings Summary */}
                {lastParsedResult.findings_summary && (
                  <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                      Findings Summary:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed">
                      "{lastParsedResult.findings_summary}"
                    </p>
                  </div>
                )}

                {/* Recommendations */}
                {lastParsedResult.recommendations && (
                  <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                      Recommendation:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {lastParsedResult.recommendations}
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
