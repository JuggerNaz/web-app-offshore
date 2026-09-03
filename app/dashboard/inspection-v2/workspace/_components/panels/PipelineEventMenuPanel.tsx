"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useROVConnection } from "@/components/rov-connection-provider";
import { createClient } from "@/utils/supabase/client";
import pipelineEventDefaultsConfig from "@/utils/types/pipeline-event-defaults.json";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  ArrowLeft,
  Search,
  Zap,
  FolderTree,
  Activity,
  Trash2,
  Sprout,
  Link2,
  ArrowUpRight,
  GitCommit,
  Waves,
  Layers,
  Box,
  CheckCircle2,
  Sparkles,
  Settings,
  RotateCcw,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Square,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Keyboard,
  Command,
  X,
} from "lucide-react";

export interface PipelineEventItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  subEvents?: PipelineEventItem[];
}

export interface EventAutoCopyConfig {
  eventName?: string;        // Main Menu Category (e.g., "SEABED PROFILE")
  eventType?: string;        // Submenu Category (e.g., "SPAN")
  eventPosition?: string;    // Action / Position (e.g., "START", "END")
  eventDescription?: string; // Optional custom description template
  findingType?: string;      // Optional finding type (e.g. "Complete", "Observation", "Anomaly")
  findings?: string;         // Optional findings summary text
}

// Centralized Default Auto-Copy Mappings (Loaded directly from pipeline-event-defaults.json)
export const EVENT_AUTO_COPY_DEFAULTS: Record<string, EventAutoCopyConfig> = (pipelineEventDefaultsConfig?.defaults as Record<string, EventAutoCopyConfig>) || {
  span_start: { eventName: "SEABED PROFILE", eventType: "SPAN", eventPosition: "START" },
  span_end: { eventName: "SEABED PROFILE", eventType: "SPAN", eventPosition: "END" },
};

export interface PipelineCategory {
  id: string;
  name: string;
  colorClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
  icon: React.ReactNode;
  subCategories: PipelineEventItem[];
}

export interface QuickShortcutItem {
  id: string;
  label: string;
  cat: string;
  sub: string;
  event: string;
  catId: string;
  icon: React.ReactNode;
  colorClass: string;
  isPinned?: boolean;
}

// Custom Elegant Thin SVG Icons for Offshore Pipeline Inspection
const AnodeIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="3" fill="currentColor" fillOpacity="0.15" />
    <path d="M7 6V4M17 6V4M7 18v2M17 18v2" strokeWidth="1.5" />
    <path d="M11 9l-2 3h4l-2 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CpStabIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" />
    <path d="M12 7v10M8 12h8" strokeWidth="1.5" />
    <path d="M3 12h3M18 12h3" strokeWidth="1.5" />
    <path d="M7 17l10-10" strokeDasharray="2 2" />
  </svg>
);

const DebrisIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" fill="currentColor" fillOpacity="0.15" />
    <path d="M10 11v6M14 11v6" strokeWidth="1.5" />
  </svg>
);

const MarineGrowthIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V10M12 10C10 7 7 6 4 7c0 4 2.5 7 8 3M12 14c2.5-3 6-3.5 8-3 0 4-3 6-8 3" fill="currentColor" fillOpacity="0.15" />
    <circle cx="12" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

const FieldJointIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="10" rx="2" fill="currentColor" fillOpacity="0.15" />
    <rect x="9" y="5" width="6" height="14" rx="1" fill="currentColor" fillOpacity="0.35" strokeWidth="1.5" />
    <path d="M2 12h20" strokeDasharray="3 3" />
  </svg>
);

const RiserIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21V5a2 2 0 012-2h4a2 2 0 012 2v16" fill="currentColor" fillOpacity="0.15" />
    <path d="M5 10h14M5 16h14" strokeWidth="1.5" />
    <path d="M12 3l3 3M12 3l-3 3" strokeWidth="1.5" />
  </svg>
);

const LineFeatureIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h20" strokeWidth="2" />
    <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.25" />
    <path d="M12 4v4M12 16v4" strokeWidth="1.5" />
  </svg>
);

const SeabedProfileIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9h20" strokeWidth="1.75" />
    <path d="M2 16c4 0 5-3 8-3s4 4 8 4 4-2 6-2" fill="currentColor" fillOpacity="0.15" strokeWidth="1.5" />
    <path d="M2 20c4 0 5-3 8-3s4 4 8 4 4-2 6-2" strokeWidth="1.25" opacity="0.6" />
  </svg>
);

const StabilisationIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
    <rect x="13" y="4" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
    <rect x="3" y="13" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
    <rect x="13" y="13" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

const SubseaStructureIcon = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-current opacity-90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" fill="currentColor" fillOpacity="0.15" strokeWidth="1.5" />
    <path d="M12 3v18M21 8l-9 5M3 8l9 5" strokeWidth="1.25" />
  </svg>
);

export const PIPELINE_EVENT_CATEGORIES: PipelineCategory[] = [
  {
    id: "ANODE",
    name: "Anode",
    colorClass: "bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 hover:from-slate-500 hover:to-slate-700 text-white",
    borderClass: "border-slate-400/50",
    badgeBg: "bg-slate-700 text-slate-100 border border-slate-500/50",
    badgeText: "ANODE",
    iconColor: "text-slate-100",
    icon: AnodeIcon,
    subCategories: [
      {
        id: "anode_bar",
        name: "Bar Anode",
        subEvents: [
          { id: "anode_bar_0_25", name: "Bar Anode - 0 - 25% Depletion" },
          { id: "anode_bar_25_50", name: "Bar Anode - 25 - 50% Depletion" },
          { id: "anode_bar_50_75", name: "Bar Anode - 50 - 75% Depletion" },
          { id: "anode_bar_75_100", name: "Bar Anode - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_bracelet",
        name: "Bracelet Anode",
        subEvents: [
          { id: "anode_bracelet_0_25", name: "Bracelet Anode - 0 - 25% Depletion" },
          { id: "anode_bracelet_25_50", name: "Bracelet Anode - 25 - 50% Depletion" },
          { id: "anode_bracelet_50_75", name: "Bracelet Anode - 50 - 75% Depletion" },
          { id: "anode_bracelet_75_100", name: "Bracelet Anode - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_collar",
        name: "Collar Anode",
        subEvents: [
          { id: "anode_collar_0_25", name: "Collar Anode - 0 - 25% Depletion" },
          { id: "anode_collar_25_50", name: "Collar Anode - 25 - 50% Depletion" },
          { id: "anode_collar_50_75", name: "Collar Anode - 50 - 75% Depletion" },
          { id: "anode_collar_75_100", name: "Collar Anode - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_remote_block_port",
        name: "Remote Block Anode (Port Side)",
        subEvents: [
          { id: "anode_remote_block_port_0_25", name: "Remote Block Port - 0 - 25% Depletion" },
          { id: "anode_remote_block_port_25_50", name: "Remote Block Port - 25 - 50% Depletion" },
          { id: "anode_remote_block_port_50_75", name: "Remote Block Port - 50 - 75% Depletion" },
          { id: "anode_remote_block_port_75_100", name: "Remote Block Port - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_remote_block_starboard",
        name: "Remote Block Anode (Starboard Side)",
        subEvents: [
          { id: "anode_remote_block_stbd_0_25", name: "Remote Block Stbd - 0 - 25% Depletion" },
          { id: "anode_remote_block_stbd_25_50", name: "Remote Block Stbd - 25 - 50% Depletion" },
          { id: "anode_remote_block_stbd_50_75", name: "Remote Block Stbd - 50 - 75% Depletion" },
          { id: "anode_remote_block_stbd_75_100", name: "Remote Block Stbd - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_sled",
        name: "Anode Sled",
        subEvents: [
          { id: "anode_sled_0_25", name: "Anode Sled - 0 - 25% Depletion" },
          { id: "anode_sled_25_50", name: "Anode Sled - 25 - 50% Depletion" },
          { id: "anode_sled_50_75", name: "Anode Sled - 50 - 75% Depletion" },
          { id: "anode_sled_75_100", name: "Anode Sled - 75 - 100% Depletion" },
        ],
      },
      {
        id: "anode_cable",
        name: "Continuity Cable",
        subEvents: [
          { id: "anode_cable_intact", name: "Continuity Cable - Intact / Connected" },
          { id: "anode_cable_damaged", name: "Continuity Cable - Damaged / Loose" },
          { id: "anode_cable_severed", name: "Continuity Cable - Disconnected / Severed" },
        ],
      },
    ],
  },
  {
    id: "CP_STAB",
    name: "CP Stab",
    colorClass: "bg-gradient-to-b from-purple-600 via-purple-700 to-purple-900 hover:from-purple-500 hover:to-purple-800 text-white",
    borderClass: "border-purple-400/50",
    badgeBg: "bg-purple-900 text-purple-100 border border-purple-600/50",
    badgeText: "CP STAB",
    iconColor: "text-purple-100",
    icon: CpStabIcon,
    subCategories: [
      {
        id: "cp_stab_sub",
        name: "CP Stab",
        subEvents: [
          { id: "cp_anode_stab", name: "Anode Stab" },
          { id: "cp_fj_stab", name: "Field Joint Stab" },
          { id: "cp_line_stab", name: "Line Stab" },
          { id: "cp_flange_stab", name: "Flange Stab" },
          { id: "cp_riser_stab", name: "Riser Stab" },
          { id: "cp_connector_stab", name: "Connector Stab" },
          { id: "cp_repair_clamp_stab", name: "Repair Clamp Stab" },
          { id: "cp_clamp_stab", name: "Clamp Stab" },
        ],
      },
      {
        id: "cp_image_sub",
        name: "Image",
        subEvents: [
          { id: "cp_proximity_image", name: "CP Proximity Image" },
          { id: "cp_stab_loc_image", name: "CP Stab Location Image" },
          { id: "cp_calib_cell_image", name: "CP Calibration Cell Image" },
        ],
      },
    ],
  },
  {
    id: "DEBRIS",
    name: "Debris",
    colorClass: "bg-gradient-to-b from-teal-600 via-teal-700 to-teal-900 hover:from-teal-500 hover:to-teal-800 text-white",
    borderClass: "border-teal-400/50",
    badgeBg: "bg-teal-900 text-teal-100 border border-teal-600/50",
    badgeText: "DEBRIS",
    iconColor: "text-teal-100",
    icon: DebrisIcon,
    subCategories: [
      {
        id: "debris_metallic_struct",
        name: "Metallic & Structural",
        subEvents: [
          { id: "debris_boat_landing", name: "Boat Landing" },
          { id: "debris_grating", name: "Grating" },
          { id: "debris_ladder", name: "Ladder" },
          { id: "debris_metallic_items", name: "Metallic Items" },
          { id: "debris_metallic_small", name: "Metallic Small Items" },
          { id: "debris_metallic_tubular", name: "Metallic Tubular" },
          { id: "debris_scaffolding_pole", name: "Scaffolding Pole" },
          { id: "debris_stairway", name: "Stairway" },
        ],
      },
      {
        id: "debris_nets_lines",
        name: "Nets, Lines & Ropes",
        subEvents: [
          { id: "debris_fish_trap", name: "Fish Trap" },
          { id: "debris_fishing_net", name: "Fishing Net" },
          { id: "debris_hard_line", name: "Hard Line" },
          { id: "debris_soft_line", name: "Soft Line" },
          { id: "debris_soft_rope", name: "Soft Rope" },
        ],
      },
      {
        id: "debris_other_general",
        name: "Seabed, Rubber & Other",
        subEvents: [
          { id: "debris_rock_boulders", name: "Rock / Boulders" },
          { id: "debris_tyre", name: "Tyre" },
          { id: "debris_wood", name: "Wood" },
          { id: "debris_sand_bag", name: "Sand Bag" },
          { id: "debris_other", name: "Other" },
        ],
      },
    ],
  },
  {
    id: "MARINE_GROWTH",
    name: "Marine Growth",
    colorClass: "bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-500 hover:to-emerald-800 text-white",
    borderClass: "border-emerald-400/50",
    badgeBg: "bg-emerald-900 text-emerald-100 border border-emerald-600/50",
    badgeText: "MARINE GROWTH",
    iconColor: "text-emerald-100",
    icon: MarineGrowthIcon,
    subCategories: [
      {
        id: "mg_hard",
        name: "Hard",
        subEvents: [
          { id: "mg_hard_0_20", name: "Hard Growth - 0 - 20% Coverage" },
          { id: "mg_hard_20_40", name: "Hard Growth - 20 - 40% Coverage" },
          { id: "mg_hard_40_60", name: "Hard Growth - 40 - 60% Coverage" },
          { id: "mg_hard_60_80", name: "Hard Growth - 60 - 80% Coverage" },
          { id: "mg_hard_80_100", name: "Hard Growth - 80 - 100% Coverage" },
          { id: "mg_hard_all_over", name: "Hard Growth - All Over" },
        ],
      },
      {
        id: "mg_hard_soft",
        name: "Hard and Soft",
        subEvents: [
          { id: "mg_hs_0_20", name: "Hard & Soft - 0 - 20% Coverage" },
          { id: "mg_hs_20_40", name: "Hard & Soft - 20 - 40% Coverage" },
          { id: "mg_hs_40_60", name: "Hard & Soft - 40 - 60% Coverage" },
          { id: "mg_hs_60_80", name: "Hard & Soft - 60 - 80% Coverage" },
          { id: "mg_hs_80_100", name: "Hard & Soft - 80 - 100% Coverage" },
          { id: "mg_hs_all_over", name: "Hard & Soft - All Over" },
        ],
      },
      {
        id: "mg_soft",
        name: "Soft",
        subEvents: [
          { id: "mg_soft_0_20", name: "Soft Growth - 0 - 20% Coverage" },
          { id: "mg_soft_20_40", name: "Soft Growth - 20 - 40% Coverage" },
          { id: "mg_soft_40_60", name: "Soft Growth - 40 - 60% Coverage" },
          { id: "mg_soft_60_80", name: "Soft Growth - 60 - 80% Coverage" },
          { id: "mg_soft_80_100", name: "Soft Growth - 80 - 100% Coverage" },
          { id: "mg_soft_all_over", name: "Soft Growth - All Over" },
        ],
      },
    ],
  },
  {
    id: "FIELD_JOINT",
    name: "Field Joint",
    colorClass: "bg-gradient-to-b from-cyan-600 via-cyan-700 to-cyan-900 hover:from-cyan-500 hover:to-cyan-800 text-white",
    borderClass: "border-cyan-400/50",
    badgeBg: "bg-cyan-950 text-cyan-100 border border-cyan-600/50",
    badgeText: "FIELD JOINT",
    iconColor: "text-cyan-100",
    icon: FieldJointIcon,
    subCategories: [
      {
        id: "fj_tin_wrap",
        name: "Tin Wrap",
        subEvents: [
          { id: "fj_tin_good", name: "In Good Condition" },
          { id: "fj_tin_clad_bitumen_good", name: "Clad Off - Bitumen in Good Condition" },
          { id: "fj_tin_clad_cracked_no_bare", name: "Clad Off - Bitumen Cracked - Bare Metal not Showing" },
          { id: "fj_tin_clad_cracked_bare", name: "Clad Off - Bitumen Cracked - Bare Metal Showing" },
          { id: "fj_tin_clad_disint_no_bare", name: "Clad Off - Bitumen Disintegrated - Bare Metal not Showing" },
          { id: "fj_tin_clad_disint_bare", name: "Clad Off - Bitumen Disintegrated - Bare Metal Showing" },
          { id: "fj_tin_other", name: "Other Defect" },
        ],
      },
      {
        id: "fj_tape_wrap",
        name: "Tape Wrap",
        subEvents: [
          { id: "fj_tape_good", name: "In Good Condition" },
          { id: "fj_tape_off_no_bare", name: "Wrapping Off - Bare Metal not Showing" },
          { id: "fj_tape_off_bare", name: "Wrapping Off - Bare Metal Showing" },
          { id: "fj_tape_other", name: "Other Defect" },
        ],
      },
      {
        id: "fj_not_visible",
        name: "Not Visible",
        subEvents: [
          { id: "fj_nv_buried", name: "Not Visible - Buried" },
          { id: "fj_nv_debris", name: "Not Visible - Covered by Debris / Growth" },
          { id: "fj_nv_other", name: "Not Visible - Other" },
        ],
      },
    ],
  },
  {
    id: "RISER_FEATURE",
    name: "Riser Feature",
    colorClass: "bg-gradient-to-b from-lime-700 via-lime-800 to-lime-950 hover:from-lime-600 hover:to-lime-800 text-white",
    borderClass: "border-lime-400/50",
    badgeBg: "bg-lime-950 text-lime-100 border border-lime-600/50",
    badgeText: "RISER FEATURE",
    iconColor: "text-lime-100",
    icon: RiserIcon,
    subCategories: [
      {
        id: "riser_bend_sub",
        name: "Bend",
        subEvents: [
          { id: "riser_bend_elbow", name: "Riser Bend / 90° Elbow" },
        ],
      },
      {
        id: "riser_clamps",
        name: "Clamp",
        subEvents: [
          {
            id: "riser_clamp_hinge",
            name: "Hinge",
            subEvents: [
              { id: "riser_clamp_hinge_2bolt", name: "2 Bolt" },
              { id: "riser_clamp_hinge_4bolt", name: "4 Bolt" },
              { id: "riser_clamp_hinge_6bolt", name: "6 Bolt" },
              { id: "riser_clamp_hinge_8bolt", name: "8 Bolt" },
            ],
          },
          {
            id: "riser_clamp_shell",
            name: "Shell",
            subEvents: [
              { id: "riser_clamp_shell_2bolt", name: "2 Bolt" },
              { id: "riser_clamp_shell_4bolt", name: "4 Bolt" },
              { id: "riser_clamp_shell_6bolt", name: "6 Bolt" },
              { id: "riser_clamp_shell_8bolt", name: "8 Bolt" },
            ],
          },
          { id: "riser_clamp_guide", name: "Riser Clamp / Guide Frame" },
          { id: "riser_neoprene", name: "Neoprene Liner / Isolator" },
          { id: "riser_bolt_assembly", name: "Riser Clamp Bolt Assembly" },
        ],
      },
      {
        id: "riser_elbow_sub",
        name: "Elbow",
        subEvents: [
          { id: "riser_elbow_90", name: "90° Elbow" },
          { id: "riser_elbow_45", name: "45° Elbow" },
        ],
      },
      {
        id: "riser_flange_sub",
        name: "Flange",
        subEvents: [
          { id: "riser_flange_swivel", name: "Swivel Flange" },
          { id: "riser_flange_weldneck", name: "Weld Neck Flange" },
          { id: "riser_flange_blind", name: "Blind Flange" },
        ],
      },
      {
        id: "riser_guard_sub",
        name: "Guard",
        subEvents: [
          { id: "riser_guard_frame", name: "Protection Guard Frame" },
        ],
      },
      {
        id: "riser_knee_brace_sub",
        name: "Knee Brace",
        subEvents: [
          {
            id: "riser_kb_lower_conn",
            name: "Lower Connection",
            subEvents: [
              { id: "riser_kb_lower_bracket", name: "Bracket" },
              { id: "riser_kb_lower_welded", name: "Welded" },
            ],
          },
          {
            id: "riser_kb_upper_conn",
            name: "Upper Connection",
            subEvents: [
              { id: "riser_kb_upper_bracket", name: "Bracket" },
              { id: "riser_kb_upper_welded", name: "Welded" },
            ],
          },
        ],
      },
      {
        id: "riser_spool_piece_sub",
        name: "Spool Piece",
        subEvents: [
          { id: "riser_spool_piece", name: "Spool Piece / Tie-in Spool" },
        ],
      },
      {
        id: "riser_tie_in_sub",
        name: "Tie - In",
        subEvents: [
          { id: "riser_tie_in_flange", name: "Tie-In Flange" },
          { id: "riser_tie_in_spool", name: "Tie-In Spool" },
        ],
      },
      {
        id: "riser_base_td_sub",
        name: "Riser Base & Touchdown",
        subEvents: [
          { id: "riser_tdp", name: "Touchdown Point (TDP)" },
          { id: "riser_bellmouth", name: "J-Tube Bellmouth Entry" },
        ],
      },
      {
        id: "riser_protection",
        name: "Protection & Coating",
        subEvents: [
          { id: "riser_stiffener", name: "Bend Stiffener / Restrictor" },
          { id: "riser_splashzone", name: "Splash Zone Monel Wrap" },
        ],
      },
      {
        id: "riser_other_sub",
        name: "Other",
        subEvents: [
          { id: "riser_other_feature", name: "Other Riser Feature" },
        ],
      },
      {
        id: "riser_damage_sub",
        name: "Damage",
        subEvents: [
          { id: "riser_damage_coating", name: "Coating Damage" },
          { id: "riser_damage_corrosion", name: "Corrosion / Pitting" },
          { id: "riser_damage_mechanical", name: "Mechanical / Impact Damage" },
          { id: "riser_damage_deformed", name: "Deformed / Bent Support" },
        ],
      },
    ],
  },
  {
    id: "LINE_FEATURE",
    name: "Line Feature",
    colorClass: "bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 hover:from-blue-500 hover:to-blue-800 text-white",
    borderClass: "border-blue-400/50",
    badgeBg: "bg-blue-950 text-blue-100 border border-blue-600/50",
    badgeText: "LINE FEATURE",
    iconColor: "text-blue-100",
    icon: LineFeatureIcon,
    subCategories: [
      {
        id: "line_items_general",
        name: "General Line Features",
        subEvents: [
          { id: "line_start", name: "Line Start" },
          { id: "line_end", name: "Line End" },
          { id: "line_jtube", name: "J - Tube" },
          { id: "line_crossing", name: "Crossing..." },
          { id: "line_flange", name: "Flange" },
          { id: "line_sidetap", name: "Side Tap" },
          { id: "line_t_joint", name: "T - Joint" },
          { id: "line_anchor_drag", name: "Anchor Drag" },
          { id: "line_repair_clamp", name: "Repair Clamp" },
          { id: "line_clamp", name: "Clamp" },
          { id: "line_connector", name: "Connector" },
          { id: "line_mag_tape", name: "Magnetic Tape Marker" },
          { id: "line_trawl_guard", name: "Over Trawl Guard" },
          { id: "line_other", name: "Other" },
        ],
      },
      {
        id: "line_skip_sub",
        name: "Line Skip",
        subEvents: [
          { id: "line_skip_start", name: "Skip Start" },
          { id: "line_skip_end", name: "Skip End" },
        ],
      },
      {
        id: "line_elbow_sub",
        name: "Elbow",
        subEvents: [
          { id: "line_elbow_port", name: "Elbow - Port Side" },
          { id: "line_elbow_starboard", name: "Elbow - Starboard Side" },
        ],
      },
      {
        id: "line_turns_sub",
        name: "Line Turns",
        subEvents: [
          { id: "line_turn_port", name: "To Port Side" },
          { id: "line_turn_starboard", name: "To Starboard Side" },
          { id: "line_turn_upwards", name: "Upwards" },
        ],
      },
      {
        id: "line_valves_sub",
        name: "Valves",
        subEvents: [
          { id: "line_valve_spindle", name: "Spindle Handle" },
          { id: "line_valve_normal", name: "Normal" },
        ],
      },
      {
        id: "line_buckle_sub",
        name: "Buckle",
        subEvents: [
          { id: "line_buckle_arrestor", name: "Buckle Arrestor" },
          { id: "line_buckle_trigger", name: "Buckle Trigger" },
        ],
      },
      {
        id: "line_coating_damage_sub",
        name: "Coating Damage",
        subEvents: [
          { id: "line_cd_bare_metal", name: "Bare Metal Showing" },
          { id: "line_cd_cracked", name: "Coating Cracked" },
          { id: "line_cd_cracked_long", name: "Coating Cracked Longitudinally" },
          { id: "line_cd_cracked_circ", name: "Coating Cracked Circumferentially" },
          { id: "line_cd_reinf_exposed", name: "Reinforcing Exposed" },
          { id: "line_cd_superficial", name: "Superficial Damage" },
          { id: "line_cd_wire_scars", name: "Wire Scars" },
          { id: "line_cd_wrap_damage", name: "Wrap Damage" },
          { id: "line_cd_other", name: "Other Defect" },
        ],
      },
      {
        id: "line_physical_damage_sub",
        name: "Physical Damage",
        subEvents: [
          { id: "line_pd_bend_port", name: "Bend/Buckle To Port Side" },
          { id: "line_pd_bend_starboard", name: "Bend/Buckle To Starboard Side" },
          { id: "line_pd_bend_upwards", name: "Bend/Buckle Upwards" },
          { id: "line_pd_bend_downwards", name: "Bend/Buckle Downwards" },
          { id: "line_pd_dent_port", name: "Dent - Port Side" },
          { id: "line_pd_dent_starboard", name: "Dent - Starboard Side" },
          { id: "line_pd_dent_top", name: "Dent - Top" },
          { id: "line_pd_dent_bottom", name: "Dent - Bottom" },
          { id: "line_pd_leak", name: "Leak" },
          { id: "line_pd_ruptured", name: "Ruptured" },
          { id: "line_pd_other", name: "Other Defect" },
        ],
      },
    ],
  },
  {
    id: "SEABED_PROFILE",
    name: "Seabed Profile",
    colorClass: "bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-900 hover:from-indigo-500 hover:to-indigo-800 text-white",
    borderClass: "border-indigo-400/50",
    badgeBg: "bg-indigo-950 text-indigo-100 border border-indigo-600/50",
    badgeText: "SEABED PROFILE",
    iconColor: "text-indigo-100",
    icon: SeabedProfileIcon,
    subCategories: [
      {
        id: "seabed_burial_sub",
        name: "Burial",
        subEvents: [
          { id: "burial_start", name: "Burial - Start" },
          { id: "burial_end", name: "Burial - End" },
          { id: "burial_depth", name: "Burial - Depth" },
        ],
      },
      {
        id: "seabed_exposure_sub",
        name: "Exposure",
        subEvents: [
          { id: "exp_fully", name: "Fully Exposed" },
          { id: "exp_part_0_25", name: "Partially Exposed - 0 - 25% Exposed" },
          { id: "exp_part_25_50", name: "Partially Exposed - 25 - 50% Exposed" },
          { id: "exp_part_50_75", name: "Partially Exposed - 50 - 75% Exposed" },
          { id: "exp_buried", name: "Buried" },
        ],
      },
      {
        id: "seabed_intermittent_span",
        name: "Intermittent Span",
        subEvents: [
          { id: "inter_span_start", name: "Intermittent Span - Start" },
          { id: "inter_span_end", name: "Intermittent Span - End" },
          { id: "inter_span_max_ht", name: "Intermittent Span - Max Height" },
        ],
      },
      {
        id: "seabed_scour_sub",
        name: "Scour",
        subEvents: [
          { id: "scour_fish", name: "Fish Scour" },
          { id: "scour_natural", name: "Natural Scour" },
          { id: "scour_max_depth", name: "Scour Max Depth" },
        ],
      },
      {
        id: "seabed_span_sub",
        name: "Span",
        subEvents: [
          { id: "span_start", name: "Span Start" },
          { id: "span_touchdown", name: "Touchdown" },
          { id: "span_end", name: "Span End" },
          { id: "span_max_ht", name: "Span Max Height" },
        ],
      },
      {
        id: "seabed_trench_sub",
        name: "Trench",
        subEvents: [
          { id: "trench_start", name: "Trench Start" },
          { id: "trench_end", name: "Trench End" },
          { id: "trench_depth", name: "Trench Depth" },
        ],
      },
      {
        id: "seabed_undulated_sub",
        name: "Undulated Seabed",
        subEvents: [
          { id: "undulated_start", name: "Undulated Seabed Start" },
          { id: "undulated_end", name: "Undulated Seabed End" },
        ],
      },
    ],
  },
  {
    id: "STABILISATION",
    name: "Stabilisation",
    colorClass: "bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 hover:from-slate-600 hover:to-slate-900 text-white",
    borderClass: "border-slate-500/50",
    badgeBg: "bg-slate-900 text-slate-100 border border-slate-600/50",
    badgeText: "STABILISATION",
    iconColor: "text-slate-100",
    icon: StabilisationIcon,
    subCategories: [
      {
        id: "stab_pipeline_anchor",
        name: "Pipeline Anchor",
        subEvents: [
          { id: "anchor_intact", name: "Pipeline Anchor - Intact" },
          { id: "anchor_displaced", name: "Pipeline Anchor - Displaced / Loose" },
        ],
      },
      {
        id: "stab_saddle_sleeper",
        name: "Saddle / Sleeper",
        subEvents: [
          { id: "saddle_concrete", name: "Concrete" },
          { id: "saddle_precast", name: "Precast" },
          { id: "saddle_other", name: "Other" },
        ],
      },
      {
        id: "stab_sand_grout_bag",
        name: "Sand / Grout Bag",
        subEvents: [
          { id: "grout_normal", name: "Normal" },
          { id: "grout_pyramid", name: "Pyramid" },
        ],
      },
      {
        id: "stab_mattress_sub",
        name: "Mattress",
        subEvents: [
          { id: "matt_concrete", name: "Concrete" },
          { id: "matt_precast", name: "Precast" },
          { id: "matt_other", name: "Other" },
        ],
      },
    ],
  },
  {
    id: "SUBSEA_STRUCTURE",
    name: "Subsea Structure",
    colorClass: "bg-gradient-to-b from-red-700 via-red-800 to-red-950 hover:from-red-600 hover:to-red-800 text-white",
    borderClass: "border-red-400/50",
    badgeBg: "bg-red-950 text-red-100 border border-red-600/50",
    badgeText: "SUBSEA STRUCTURE",
    iconColor: "text-red-100",
    icon: SubseaStructureIcon,
    subCategories: [
      {
        id: "struct_tie_in",
        name: "Tie-In",
        subEvents: [
          { id: "tiein_flange", name: "Flange" },
          { id: "tiein_tee", name: "Tee" },
          { id: "tiein_valve", name: "Valve" },
          { id: "tiein_wye", name: "Wye" },
          { id: "tiein_other", name: "Other" },
        ],
      },
      {
        id: "struct_plet",
        name: "Plet",
        subEvents: [
          { id: "plet_flange", name: "Flange" },
          { id: "plet_tee", name: "Tee" },
          { id: "plet_valve", name: "Valve" },
          { id: "plet_wye", name: "Wye" },
          { id: "plet_other", name: "Other" },
        ],
      },
      {
        id: "struct_plem",
        name: "Plem",
        subEvents: [
          { id: "plem_flange", name: "Flange" },
          { id: "plem_tee", name: "Tee" },
          { id: "plem_valve", name: "Valve" },
          { id: "plem_wye", name: "Wye" },
          { id: "plem_other", name: "Other" },
        ],
      },
      {
        id: "struct_other_sub",
        name: "Other",
        subEvents: [
          { id: "struct_other_item", name: "Other Structure" },
        ],
      },
    ],
  },
];

// Paired Start/End Toggle Events (Only ONE shown at a time based on active status)
export const TOGGLE_PAIRS: Array<{ startId: string; endId: string; groupKey: string }> = [
  { startId: "span_start", endId: "span_end", groupKey: "span" },
  { startId: "line_skip_start", endId: "line_skip_end", groupKey: "skip" },
  { startId: "burial_start", endId: "burial_end", groupKey: "burial" },
  { startId: "inter_span_start", endId: "inter_span_end", groupKey: "inter_span" },
  { startId: "trench_start", endId: "trench_end", groupKey: "trench" },
  { startId: "undulated_start", endId: "undulated_end", groupKey: "undulated" },
];

// Default Initial Most Frequent Shortcuts (Only Start events or standalone events)
export const INITIAL_SHORTCUT_IDS = [
  "span_start",
  "anode_bracelet_0_25",
  "cp_stab_anode",
  "fj_start",
  "debris_pipe",
  "line_skip_start",
];

interface PipelineEventMenuPanelProps {
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
    northing?: string;
    easting?: string;
    depth?: string;
    cp_fg?: string;
    cp_fg_rdg?: string;
    heading?: string;
    rov_heading?: string;
  }) => void;
  currentKp?: number | string;
  inspMethod?: "DIVING" | "ROV";
  rovKp?: number | string; // Live KP from ROV telemetry data string feed
  rovDataString?: string; // Optional raw ROV string payload (NMEA/serial)
  isRovDataConnected?: boolean;
  isVideoPlaying?: boolean; // Prop indicating external video logger playback status
  unitSystem?: "METRIC" | "IMPERIAL"; // Unit system setting ("METRIC" | "IMPERIAL")
  totalPipelineLength?: number | string; // Total length of pipeline (e.g. 130.000)
  inspectionDirection?: string; // Inspection direction (e.g. "INCREASE_KP" / "DECREASE_KP")
  inspectionLocation?: string; // Inspection location (e.g. "PIPELINE" vs "CROSSING" etc)
  structureId?: string | number; // Current structure ID for historical queries
  sowReportNo?: string; // Current SOW report number
  jobPackId?: string | number; // Current jobpack ID
}

export function PipelineEventMenuPanel({
  onSelectEvent,
  currentKp = "0.000",
  inspMethod = "ROV",
  rovKp,
  rovDataString,
  isRovDataConnected,
  isVideoPlaying: isVideoPlayingProp = true,
  unitSystem = "METRIC",
  totalPipelineLength,
  inspectionDirection = "INCREASE_KP",
  inspectionLocation = "PIPELINE",
  structureId,
  sowReportNo,
  jobPackId,
}: PipelineEventMenuPanelProps) {
  const { isConnected: hookIsConnected, fields: rovConnectionFields } = useROVConnection();
  const effectiveConnected = isRovDataConnected || hookIsConnected;
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [settingsSearchTerm, setSettingsSearchTerm] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [isInlineExpanded, setIsInlineExpanded] = useState(false);

  // Position Details Dialog State (Debris & Subsea Structure)
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [pendingPositionItem, setPendingPositionItem] = useState<{
    catName: string;
    subCatName: string;
    eventName: string;
    eventId?: string;
    isDebris?: boolean;
    isSubseaStructure?: boolean;
  } | null>(null);
  const [positionIsTouching, setPositionIsTouching] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<"PORT SIDE" | "STARBOARD SIDE" | "OVER" | "UNDER">("PORT SIDE");

  // Pipeline Crossing Details Dialog State
  const [isCrossingModalOpen, setIsCrossingModalOpen] = useState(false);
  const [pendingCrossingItem, setPendingCrossingItem] = useState<{
    catName: string;
    subCatName: string;
    eventName: string;
    eventId?: string;
  } | null>(null);
  const [crossingOrientation, setCrossingOrientation] = useState<"Over the Current Line" | "Under the Current Line">("Over the Current Line");
  const [crossingLineName, setCrossingLineName] = useState<string>("");
  const [crossingKp, setCrossingKp] = useState<string>("");
  const [crossingAngle, setCrossingAngle] = useState<string>("");
  const [crossingType, setCrossingType] = useState<string>("CONVENTIONAL");
  const [crossingGap, setCrossingGap] = useState<string>("");
  const [crossingNumSupports, setCrossingNumSupports] = useState<string>("");

  // Span End Details Dialog State (Span Length & Height)
  const [isSpanEndModalOpen, setIsSpanEndModalOpen] = useState(false);
  const [pendingSpanEndItem, setPendingSpanEndItem] = useState<{
    catName: string;
    subCatName: string;
    eventName: string;
    eventId?: string;
  } | null>(null);
  const [spanLengthInput, setSpanLengthInput] = useState<string>("0.00");
  const [spanHeightInput, setSpanHeightInput] = useState<string>("0.0");
  const [spanCalcMode, setSpanCalcMode] = useState<"KP" | "NORTHING_EASTING">("KP");
  const [spanStartKp, setSpanStartKp] = useState<number | null>(null);
  const [spanStartNorthing, setSpanStartNorthing] = useState<number | null>(null);
  const [spanStartEasting, setSpanStartEasting] = useState<number | null>(null);

  // Historical Survey Events for Next Upcoming Predictions
  const [historicalEvents, setHistoricalEvents] = useState<Array<{ eventType: string; kp: number }>>([]);

  // Fetch historical inspection records for this structure to calculate next upcoming events
  useEffect(() => {
    let isMounted = true;
    async function fetchHistoricalData() {
      if (!structureId) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("insp_records")
          .select("fp_kp, inspection_data")
          .eq("structure_id", parseInt(String(structureId)))
          .not("fp_kp", "is", null)
          .order("insp_id", { ascending: false })
          .limit(300);

        if (!error && data && isMounted) {
          const parsedList: Array<{ eventType: string; kp: number }> = [];
          data.forEach((row: any) => {
            const kpVal = typeof row.fp_kp === "number" ? row.fp_kp : parseFloat(row.fp_kp);
            const evtName = (row.inspection_data?.event_name || row.inspection_data?.eventName || "").toUpperCase();
            const evtType = (row.inspection_data?.event_type || row.inspection_data?.eventType || "").toUpperCase();

            if (!isNaN(kpVal) && kpVal > 0) {
              if (evtName.includes("ANODE") || evtType.includes("ANODE")) {
                parsedList.push({ eventType: "ANODE", kp: kpVal });
              } else if (evtName.includes("CROSSING") || evtType.includes("CROSSING")) {
                parsedList.push({ eventType: "CROSSING", kp: kpVal });
              } else if (evtName.includes("FIELD JOINT") || evtType.includes("FIELD JOINT") || evtType.includes("FJ")) {
                parsedList.push({ eventType: "FIELD_JOINT", kp: kpVal });
              }
            }
          });
          setHistoricalEvents(parsedList);
        }
      } catch (e) {
        console.warn("Failed to fetch historical survey records:", e);
      }
    }

    fetchHistoricalData();
    return () => {
      isMounted = false;
    };
  }, [structureId]);

  // Burial End Details Dialog State (Burial Length & Coverage)
  const [isBurialEndModalOpen, setIsBurialEndModalOpen] = useState(false);
  const [pendingBurialEndItem, setPendingBurialEndItem] = useState<{
    catName: string;
    subCatName: string;
    eventName: string;
    eventId?: string;
  } | null>(null);
  const [burialLengthInput, setBurialLengthInput] = useState<string>("0.00");
  const [burialCoverageInput, setBurialCoverageInput] = useState<string>("100.0");
  const [burialCalcMode, setBurialCalcMode] = useState<"KP" | "NORTHING_EASTING">("KP");
  const [burialStartKp, setBurialStartKp] = useState<number | null>(null);
  const [burialStartNorthing, setBurialStartNorthing] = useState<number | null>(null);
  const [burialStartEasting, setBurialStartEasting] = useState<number | null>(null);

  // Live KP & Video Playback State for active event progress
  const [liveKp, setLiveKp] = useState<number>(() => {
    const parsed = parseFloat(String(currentKp));
    return !isNaN(parsed) && parsed > 0 ? parsed : 0.0;
  });

  const effectiveIsVideoPlaying = isVideoPlayingProp;

  // Helper to resolve effective KP: Uses live ROV data string if connected/available, else falls back to calculated KP
  const resolveEffectiveKp = (): { kp: string; numKp: number; source: "ROV_DATA_STRING" | "CALCULATED" } => {
    // 1. Check direct prop rovKp
    if (rovKp !== undefined && rovKp !== null && String(rovKp).trim() !== "") {
      const parsedRov = parseFloat(String(rovKp));
      if (!isNaN(parsedRov) && parsedRov >= 0) {
        return { kp: parsedRov.toFixed(3), numKp: parsedRov, source: "ROV_DATA_STRING" };
      }
    }

    // 2. Check window telemetry object if broadcast from serial/websocket feed
    if (typeof window !== "undefined" && (window as any).rovTelemetryKp !== undefined) {
      const winKp = parseFloat(String((window as any).rovTelemetryKp));
      if (!isNaN(winKp) && winKp >= 0) {
        return { kp: winKp.toFixed(3), numKp: winKp, source: "ROV_DATA_STRING" };
      }
    }

    // 3. Fallback to calculated incremented liveKp
    return { kp: liveKp.toFixed(3), numKp: liveKp, source: "CALCULATED" };
  };

  // Compute Inspection Info values (Completion %, Next FJ, Next Anode, Next Crossing)
  const inspectionInfoSummary = useMemo(() => {
    const isImperial = unitSystem === "IMPERIAL";
    const posPrefix = isImperial ? "FP" : "KP";
    const distUnit = isImperial ? "ft" : "m";

    // Value conversion multiplier: 1 KP = 1 km = 3280.84 ft
    const toPosVal = (kpInKm: number): number => {
      return isImperial ? kpInKm * 3280.84 : kpInKm;
    };

    const curPosVal = toPosVal(liveKp);
    const curPosFormatted = isImperial ? curPosVal.toFixed(1) : curPosVal.toFixed(3);

    const isIncreaseFlow = !inspectionDirection.toUpperCase().includes("DECREASE");
    const flowLabel = isIncreaseFlow ? `Increase ${posPrefix}` : `Decrease ${posPrefix}`;
    const isMainPipelineLocation = inspectionLocation.toUpperCase() === "PIPELINE";

    // 1. Completion Percentage
    let completionText = `${curPosFormatted}`;
    const totalLenKm = typeof totalPipelineLength === "number" ? totalPipelineLength : parseFloat(String(totalPipelineLength || ""));
    if (isMainPipelineLocation && !isNaN(totalLenKm) && totalLenKm > 0) {
      const totalPosVal = toPosVal(totalLenKm);
      const totalPosFormatted = isImperial ? totalPosVal.toFixed(1) : totalPosVal.toFixed(3);
      const pct = Math.min(100, Math.max(0, (liveKp / totalLenKm) * 100));
      completionText = `${curPosFormatted} / ${totalPosFormatted} = ${pct.toFixed(1)}%`;
    }

    // Helper to find next upcoming event from historical list or fallback interval (e.g. 12m for Field Joint)
    const findNextUpcoming = (type: "FIELD_JOINT" | "ANODE" | "CROSSING", fallbackIntervalMeters?: number) => {
      const matches = historicalEvents.filter((e) => e.eventType === type);
      let upcomingKp: number | null = null;

      if (matches.length > 0) {
        if (isIncreaseFlow) {
          const ahead = matches.filter((e) => e.kp > liveKp).sort((a, b) => a.kp - b.kp);
          if (ahead.length > 0) upcomingKp = ahead[0].kp;
        } else {
          const ahead = matches.filter((e) => e.kp < liveKp).sort((a, b) => b.kp - a.kp);
          if (ahead.length > 0) upcomingKp = ahead[0].kp;
        }
      }

      // If no historical survey match, fallback to standard 12m joint spacing for Field Joint
      if (upcomingKp === null && fallbackIntervalMeters) {
        const intervalKp = fallbackIntervalMeters / 1000;
        if (isIncreaseFlow) {
          upcomingKp = Math.ceil(liveKp / intervalKp) * intervalKp;
          if (upcomingKp <= liveKp) upcomingKp += intervalKp;
        } else {
          upcomingKp = Math.floor(liveKp / intervalKp) * intervalKp;
          if (upcomingKp >= liveKp) upcomingKp -= intervalKp;
        }
      }

      if (upcomingKp !== null) {
        const distMeters = Math.abs(upcomingKp - liveKp) * 1000;
        const displayUpcomingPos = toPosVal(upcomingKp);
        const displayUpcomingStr = isImperial ? displayUpcomingPos.toFixed(1) : displayUpcomingPos.toFixed(3);
        const displayDist = Math.round(isImperial ? distMeters * 3.28084 : distMeters);

        return {
          kpStr: `${posPrefix} ${displayUpcomingStr}`,
          distStr: `(${displayDist}${distUnit} ahead)`,
        };
      }

      return { kpStr: "N/A", distStr: "" };
    };

    const nextFj = findNextUpcoming("FIELD_JOINT", 12);
    const nextAnode = findNextUpcoming("ANODE");
    const nextCrossing = findNextUpcoming("CROSSING");

    return {
      posPrefix,
      curPosFormatted,
      completionText,
      flowLabel,
      nextFj,
      nextAnode,
      nextCrossing,
    };
  }, [liveKp, inspectionDirection, inspectionLocation, totalPipelineLength, historicalEvents, unitSystem]);

  // Sync liveKp when currentKp prop updates from parent
  useEffect(() => {
    const parsed = parseFloat(String(currentKp));
    if (!isNaN(parsed) && parsed > 0 && liveKp === 0) {
      setLiveKp(parsed);
    }
  }, [currentKp]);

  // Toggle active state for paired events (Span Start <-> Span End, etc.)
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pipeline_event_active_toggles");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pipeline_event_active_toggles", JSON.stringify(activeToggles));
    }
  }, [activeToggles]);

  // Dynamic Pinned Shortcuts & Event Usage Counter State (Excludes End events)
  const [pinnedShortcutIds, setPinnedShortcutIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pipeline_event_pinned_shortcuts");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Filter out any legacy End event IDs (e.g., span_end, line_skip_end, etc.)
            return parsed.filter((id: string) => !TOGGLE_PAIRS.some((p) => p.endId === id));
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return INITIAL_SHORTCUT_IDS;
  });

  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pipeline_event_usage_counts");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return {};
  });

  // Custom Hotkeys state (e.g. { span_start: "Alt+1", line_skip_start: "Alt+2" })
  const [customHotkeys, setCustomHotkeys] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pipeline_event_custom_hotkeys");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return {
      span_start: "Alt+1",
      anode_bracelet_0_25: "Alt+2",
      cp_stab_anode: "Alt+3",
      fj_start: "Alt+4",
      debris_pipe: "Alt+5",
      line_skip_start: "Alt+6",
    };
  });

  // Cross-Device Sync: Fetch remote user profile preferences on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchUserPreferences() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && isMounted) {
          const remotePrefs = user.user_metadata?.event_menu_preferences;
          if (remotePrefs) {
            if (Array.isArray(remotePrefs.pinnedShortcutIds) && remotePrefs.pinnedShortcutIds.length > 0) {
              const sanitized = remotePrefs.pinnedShortcutIds.filter(
                (id: string) => !TOGGLE_PAIRS.some((p) => p.endId === id)
              );
              setPinnedShortcutIds(sanitized);
            }
            if (remotePrefs.customHotkeys && typeof remotePrefs.customHotkeys === "object") {
              setCustomHotkeys(remotePrefs.customHotkeys);
            }
            if (remotePrefs.usageCounts && typeof remotePrefs.usageCounts === "object") {
              setUsageCounts(remotePrefs.usageCounts);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load user profile preferences:", err);
      }
    }

    fetchUserPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save to LocalStorage + Sync to Supabase User Profile Metadata across devices
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sanitized = pinnedShortcutIds.filter((id) => !TOGGLE_PAIRS.some((p) => p.endId === id));
      localStorage.setItem("pipeline_event_pinned_shortcuts", JSON.stringify(sanitized));
      localStorage.setItem("pipeline_event_usage_counts", JSON.stringify(usageCounts));
      localStorage.setItem("pipeline_event_custom_hotkeys", JSON.stringify(customHotkeys));
      window.dispatchEvent(new Event("pipeline_shortcuts_changed"));

      // Debounced sync to User Account Metadata in background
      const syncTimer = setTimeout(async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.auth.updateUser({
              data: {
                event_menu_preferences: {
                  pinnedShortcutIds: sanitized,
                  customHotkeys,
                  usageCounts,
                },
              },
            });
          }
        } catch (e) {
          // silently handle background sync error
        }
      }, 1200);

      return () => clearTimeout(syncTimer);
    }
  }, [pinnedShortcutIds, customHotkeys, usageCounts]);

  // Function to move a pinned shortcut left/right (up/down in list)
  const movePinnedShortcut = (index: number, direction: -1 | 1) => {
    setPinnedShortcutIds((prev) => {
      const rawList = prev.length > 0 ? prev : INITIAL_SHORTCUT_IDS;
      const currentList = rawList.filter((id) => !TOGGLE_PAIRS.some((p) => p.endId === id));
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= currentList.length) return prev;
      const updated = [...currentList];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Flattened List of all Sub-Events across all categories
  const allFlattenedEvents = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      cat: string;
      sub: string;
      event: string;
      catId: string;
      icon: React.ReactNode;
      colorClass: string;
    }> = [];

    PIPELINE_EVENT_CATEGORIES.forEach((cat) => {
      cat.subCategories.forEach((subCat) => {
        subCat.subEvents?.forEach((evt) => {
          list.push({
            id: evt.id,
            label: evt.name, // Full descriptive event name
            cat: cat.name,
            sub: subCat.name,
            event: evt.name,
            catId: cat.id,
            icon: cat.icon,
            colorClass: cat.colorClass,
          });
        });
      });
    });

    return list;
  }, []);

  // Compute Active Shortcuts to display in bottom bar / view all panel (Strictly user-pinned items)
  const activeShortcuts = useMemo(() => {
    const activeIds = pinnedShortcutIds.length > 0 ? pinnedShortcutIds : INITIAL_SHORTCUT_IDS;

    const pinnedList = activeIds
      .map((id) => allFlattenedEvents.find((e) => e.id === id))
      .filter(Boolean) as typeof allFlattenedEvents;

    // Filter toggle pairs so ONLY ONE of each toggle pair (start vs end) is shown based on activeToggles state!
    const filtered = pinnedList.filter((item) => {
      const pair = TOGGLE_PAIRS.find((p) => p.startId === item.id || p.endId === item.id);
      if (!pair) return true; // not a toggle pair, keep it

      const isActive = !!activeToggles[pair.groupKey];
      if (isActive) {
        // Active state: show endId, hide startId
        return item.id === pair.endId;
      } else {
        // Inactive state: show startId, hide endId
        return item.id === pair.startId;
      }
    });

    return filtered;
  }, [pinnedShortcutIds, allFlattenedEvents, activeToggles]);

  // Compute currently active in-progress events list for top monitoring alert banner
  const activeEventsList = useMemo(() => {
    const list: Array<{
      groupKey: string;
      label: string;
      startKp: string;
      startTime: string;
      startId: string;
      endId: string;
      catName: string;
      subCatName: string;
      endEventName: string;
    }> = [];

    TOGGLE_PAIRS.forEach((pair) => {
      if (activeToggles[pair.groupKey]) {
        const startEvt = allFlattenedEvents.find((e) => e.id === pair.startId);
        const endEvt = allFlattenedEvents.find((e) => e.id === pair.endId);
        const labelFormatted = pair.groupKey.toUpperCase().replace("_", " ");
        list.push({
          groupKey: pair.groupKey,
          label: labelFormatted,
          startKp: String(currentKp),
          startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          startId: pair.startId,
          endId: pair.endId,
          catName: endEvt?.cat || startEvt?.cat || "Pipeline",
          subCatName: endEvt?.sub || startEvt?.sub || "Event",
          endEventName: endEvt?.event || `${labelFormatted} End`,
        });
      }
    });

    return list;
  }, [activeToggles, allFlattenedEvents, currentKp]);

  // Auto-increment live KP value while active events exist AND video is playing
  useEffect(() => {
    if (activeEventsList.length === 0 || !effectiveIsVideoPlaying) return;

    const interval = setInterval(() => {
      setLiveKp((prev) => parseFloat((prev + 0.001).toFixed(3)));
    }, 1000); // Increments by 0.001 KP per second during playback

    return () => clearInterval(interval);
  }, [activeEventsList.length, effectiveIsVideoPlaying]);

  const handleStopActiveEvent = (activeEvt: (typeof activeEventsList)[0]) => {
    const { kp: finalKpStr, source: kpSource } = resolveEffectiveKp();
    handleTriggerEvent(
      activeEvt.catName,
      activeEvt.subCatName,
      activeEvt.endEventName,
      activeEvt.endId
    );
  };

  const activeCat = useMemo(() => {
    return PIPELINE_EVENT_CATEGORIES.find((c) => c.id === selectedCatId) || null;
  }, [selectedCatId]);

  const activeSubCat = useMemo(() => {
    if (!activeCat || !selectedSubCatId) return null;
    return activeCat.subCategories.find((sc) => sc.id === selectedSubCatId) || null;
  }, [activeCat, selectedSubCatId]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    const results: Array<{
      category: PipelineCategory;
      subCat: PipelineEventItem;
      event: PipelineEventItem;
    }> = [];

    PIPELINE_EVENT_CATEGORIES.forEach((cat) => {
      cat.subCategories.forEach((sc) => {
        sc.subEvents?.forEach((evt) => {
          if (
            evt.name.toLowerCase().includes(q) ||
            sc.name.toLowerCase().includes(q) ||
            cat.name.toLowerCase().includes(q)
          ) {
            results.push({ category: cat, subCat: sc, event: evt });
          }
        });
      });
    });

    return results;
  }, [searchTerm]);

  // Helper to check if an event button is disabled based on active toggle states
  const getEventDisabledStatus = (eventId?: string): { isDisabled: boolean; reason?: string } => {
    if (!eventId) return { isDisabled: false };

    const pair = TOGGLE_PAIRS.find((p) => p.startId === eventId || p.endId === eventId);
    if (!pair) return { isDisabled: false };

    const isActive = !!activeToggles[pair.groupKey];

    // If start button is clicked and currently in progress, disable start button!
    if (eventId === pair.startId && isActive) {
      return {
        isDisabled: true,
        reason: `${pair.groupKey.toUpperCase().replace("_", " ")} is currently IN PROGRESS. Use STOP & END or End button to complete it.`,
      };
    }

    // If start button has NOT been triggered yet, disable end button!
    if (eventId === pair.endId && !isActive) {
      return {
        isDisabled: true,
        reason: `${pair.groupKey.toUpperCase().replace("_", " ")} has not been started yet. Click Start first.`,
      };
    }

    return { isDisabled: false };
  };

  // Authoritative Hotkey Resolver (guarantees every pinned button gets a clean, non-null hotkey badge!)
  const getEffectiveHotkey = (id: string, overrideIndex?: number): string => {
    // 1. Direct custom hotkey assignment
    if (customHotkeys[id]) return customHotkeys[id];

    // 2. Check paired start event ID
    const pair = TOGGLE_PAIRS.find((p) => p.endId === id || p.startId === id);
    const lookupId = pair ? pair.startId : id;
    if (customHotkeys[lookupId]) return customHotkeys[lookupId];

    // 3. Fallback to sequential position index (Alt+1, Alt+2, Alt+3...)
    const rawList = pinnedShortcutIds.length > 0 ? pinnedShortcutIds : INITIAL_SHORTCUT_IDS;
    const cleanList = rawList.filter((item) => !TOGGLE_PAIRS.some((p) => p.endId === item));
    const pos = typeof overrideIndex === "number" ? overrideIndex : cleanList.indexOf(lookupId);

    if (pos >= 0) {
      return `Alt+${pos + 1}`;
    }

    return "";
  };

  const handleTriggerEvent = (
    catName: string,
    subCatName: string,
    eventName: string,
    eventId?: string,
    positionOverrides?: { touching?: boolean; position: "PORT SIDE" | "STARBOARD SIDE" | "OVER" | "UNDER"; isDamaged?: boolean },
    crossingOverrides?: {
      orientation: "Over the Current Line" | "Under the Current Line";
      crossingLine: string;
      crossingKp: string;
      angle: string;
      crossingType: string;
      gap: string;
      numSupports: string;
    },
    spanEndOverrides?: {
      lengthPrimary: string;
      lengthSecondary: string;
      heightPrimary: string;
      heightSecondary: string;
      lengthValueNum: number;
      heightValueNum: number;
    },
    burialEndOverrides?: {
      lengthPrimary: string;
      lengthSecondary: string;
      coveragePct: string;
    }
  ) => {
    const targetId = eventId || allFlattenedEvents.find((e) => e.event === eventName)?.id;

    // Track Start KP and Northing/Easting telemetry when span_start is triggered
    if (targetId === "span_start" || targetId === "inter_span_start") {
      const { numKp } = resolveEffectiveKp();
      setSpanStartKp(numKp);

      let curNorth: number | null = null;
      let curEast: number | null = null;

      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
        rovConnectionFields.forEach((f) => {
          if (f.value && f.value !== "--") {
            const tf = (f.targetField || f.label || "").toLowerCase().trim();
            if (tf.includes("northing")) curNorth = parseFloat(f.value);
            if (tf.includes("easting")) curEast = parseFloat(f.value);
          }
        });
      }
      if (typeof window !== "undefined") {
        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
      }
      setSpanStartNorthing(curNorth);
      setSpanStartEasting(curEast);
    }

    // Track Start KP and Northing/Easting telemetry when burial_start is triggered
    if (targetId === "burial_start") {
      const { numKp } = resolveEffectiveKp();
      setBurialStartKp(numKp);

      let curNorth: number | null = null;
      let curEast: number | null = null;

      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
        rovConnectionFields.forEach((f) => {
          if (f.value && f.value !== "--") {
            const tf = (f.targetField || f.label || "").toLowerCase().trim();
            if (tf.includes("northing")) curNorth = parseFloat(f.value);
            if (tf.includes("easting")) curEast = parseFloat(f.value);
          }
        });
      }
      if (typeof window !== "undefined") {
        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
      }
      setBurialStartNorthing(curNorth);
      setBurialStartEasting(curEast);
    }

    // Intercept Burial End event trigger to show Burial Length & Coverage modal dialog
    const isBurialEndEvent = targetId === "burial_end";
    if (isBurialEndEvent && !burialEndOverrides) {
      const { numKp: endKp } = resolveEffectiveKp();

      let calculatedLengthMeters = 0;

      if (burialStartKp !== null && endKp > burialStartKp) {
        calculatedLengthMeters = Math.abs(endKp - burialStartKp) * 1000;
      }

      let curNorth: number | null = null;
      let curEast: number | null = null;
      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
        rovConnectionFields.forEach((f) => {
          if (f.value && f.value !== "--") {
            const tf = (f.targetField || f.label || "").toLowerCase().trim();
            if (tf.includes("northing")) curNorth = parseFloat(f.value);
            if (tf.includes("easting")) curEast = parseFloat(f.value);
          }
        });
      }
      if (typeof window !== "undefined") {
        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
      }

      if (burialCalcMode === "NORTHING_EASTING" && burialStartNorthing !== null && burialStartEasting !== null && curNorth !== null && curEast !== null) {
        const dN = curNorth - burialStartNorthing;
        const dE = curEast - burialStartEasting;
        const distMeters = Math.sqrt(dN * dN + dE * dE);
        if (!isNaN(distMeters) && distMeters > 0) {
          calculatedLengthMeters = distMeters;
        }
      }

      const finalLen = unitSystem === "IMPERIAL" ? (calculatedLengthMeters * 3.28084).toFixed(2) : calculatedLengthMeters.toFixed(2);

      setPendingBurialEndItem({ catName, subCatName, eventName, eventId: targetId });
      setBurialLengthInput(finalLen);
      setBurialCoverageInput("100.0");
      setIsBurialEndModalOpen(true);
      return;
    }

    // Intercept Span End event trigger to show Span Length & Height modal dialog
    const isSpanEndEvent = targetId === "span_end" || targetId === "inter_span_end";
    if (isSpanEndEvent && !spanEndOverrides) {
      const { numKp: endKp } = resolveEffectiveKp();

      let calculatedLengthMeters = 0;

      // 1. Calculate length using KP difference (KP is in km -> convert to meters)
      if (spanStartKp !== null && endKp > spanStartKp) {
        calculatedLengthMeters = Math.abs(endKp - spanStartKp) * 1000;
      }

      // 2. Check Northing / Easting distance calculation option if available
      let curNorth: number | null = null;
      let curEast: number | null = null;
      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
        rovConnectionFields.forEach((f) => {
          if (f.value && f.value !== "--") {
            const tf = (f.targetField || f.label || "").toLowerCase().trim();
            if (tf.includes("northing")) curNorth = parseFloat(f.value);
            if (tf.includes("easting")) curEast = parseFloat(f.value);
          }
        });
      }
      if (typeof window !== "undefined") {
        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
      }

      if (spanCalcMode === "NORTHING_EASTING" && spanStartNorthing !== null && spanStartEasting !== null && curNorth !== null && curEast !== null) {
        const dN = curNorth - spanStartNorthing;
        const dE = curEast - spanStartEasting;
        const distMeters = Math.sqrt(dN * dN + dE * dE);
        if (!isNaN(distMeters) && distMeters > 0) {
          calculatedLengthMeters = distMeters;
        }
      }

      setPendingSpanEndItem({ catName, subCatName, eventName, eventId: targetId });
      setSpanLengthInput(calculatedLengthMeters.toFixed(2));
      setSpanHeightInput("0.0");
      setIsSpanEndModalOpen(true);
      return;
    }

    // Intercept Crossing event trigger to show Pipeline Crossing modal dialog
    const isCrossingEvent = targetId === "line_crossing" || eventName.toLowerCase().includes("crossing");
    if (isCrossingEvent && !crossingOverrides) {
      const { kp: effectiveKp } = resolveEffectiveKp();
      setPendingCrossingItem({ catName, subCatName, eventName, eventId: targetId });
      setCrossingOrientation("Over the Current Line");
      setCrossingLineName("");
      setCrossingKp(effectiveKp);
      setCrossingAngle("");
      setCrossingType("CONVENTIONAL");
      setCrossingGap("");
      setCrossingNumSupports("");
      setIsCrossingModalOpen(true);
      return;
    }

    // Intercept Debris items or Subsea Structure items to show position details prompt
    const isDebrisCategory = Boolean(
      catName.toUpperCase() === "DEBRIS" ||
      subCatName.toUpperCase().includes("DEBRIS") ||
      (targetId && targetId.toLowerCase().includes("debris"))
    );

    const isSubseaStructureCategory = Boolean(
      catName.toUpperCase() === "SUBSEA STRUCTURE" ||
      subCatName.toUpperCase().includes("SUBSEA STRUCTURE") ||
      (targetId && (targetId.startsWith("tiein_") || targetId.startsWith("plet_") || targetId.startsWith("plem_") || targetId.startsWith("struct_")))
    );

    if ((isDebrisCategory || isSubseaStructureCategory) && !positionOverrides) {
      setPendingPositionItem({
        catName,
        subCatName,
        eventName,
        eventId: targetId,
        isDebris: isDebrisCategory,
        isSubseaStructure: isSubseaStructureCategory,
      });
      setPositionIsTouching(false);
      setSelectedPosition("PORT SIDE");
      setIsPositionModalOpen(true);
      return;
    }

    if (targetId) {
      const disabledStatus = getEventDisabledStatus(targetId);
      if (disabledStatus.isDisabled) {
        return; // Guard against clicking active in-progress event or unstarted end event!
      }

      // Toggle state logic for paired Start/End events
      const pair = TOGGLE_PAIRS.find((p) => p.startId === targetId || p.endId === targetId);
      if (pair) {
        setActiveToggles((prev) => ({
          ...prev,
          [pair.groupKey]: targetId === pair.startId,
        }));
      }

      setUsageCounts((prev) => ({
        ...prev,
        [targetId]: (prev[targetId] || 0) + 1,
      }));
    }

    const { kp: finalKpStr, source: kpSource } = resolveEffectiveKp();

    const customDefault = targetId ? EVENT_AUTO_COPY_DEFAULTS[targetId] : undefined;

    // Mapping per user request:
    // DEBRIS: Event Name -> DEBRIS, Event Type -> Item Name, Event Position -> Position, Event Description -> TOUCHING THE LINE / NOT TOUCHING THE LINE
    // SUBSEA STRUCTURE: Event Name -> SUBSEA STRUCTURE, Event Type -> Item Name, Event Description -> Position (PORT SIDE / STARBOARD SIDE / OVER / UNDER)
    const isDebris = catName.toUpperCase() === "DEBRIS" || (targetId && targetId.startsWith("debris_"));
    const isSubseaStructure =
      catName.toUpperCase() === "SUBSEA STRUCTURE" ||
      (targetId && (targetId.startsWith("tiein_") || targetId.startsWith("plet_") || targetId.startsWith("plem_") || targetId.startsWith("struct_")));

    const mappedEventName = isDebris ? "DEBRIS" : isSubseaStructure ? "SUBSEA STRUCTURE" : (customDefault?.eventName || catName);
    let mappedEventType = isDebris || isSubseaStructure ? eventName.toUpperCase() : (customDefault?.eventType || subCatName);
    if (isCrossingEvent && crossingOverrides) {
      mappedEventType = crossingOverrides.crossingType ? crossingOverrides.crossingType.toUpperCase() : "CONVENTIONAL";
    }

    let mappedEventPosition = isSubseaStructure
      ? ""
      : isDebris && positionOverrides
      ? positionOverrides.position
      : (customDefault?.eventPosition || (
          eventName.toLowerCase().includes("start")
            ? "START"
            : eventName.toLowerCase().includes("end")
            ? "END"
            : eventName
        ));
    if (isCrossingEvent && crossingOverrides) {
      mappedEventPosition = crossingOverrides.orientation.toLowerCase().includes("over") ? "OVER" : "UNDER";
    }

    // Resolve Description template & findings
    let mappedDescription = `${eventName} recorded at KP ${finalKpStr} [${kpSource === "ROV_DATA_STRING" ? "Live ROV Data String" : "Calculated KP Sync"}] during ${inspMethod} survey`;
    let mappedFindings = customDefault?.findings || `${eventName} recorded`;

    if (burialEndOverrides) {
      mappedDescription = `LENGTH:${burialEndOverrides.lengthPrimary}/${burialEndOverrides.lengthSecondary} COVERAGE:${burialEndOverrides.coveragePct}%`;
      mappedFindings = `Pipeline burial section ended at KP ${finalKpStr}. LENGTH:${burialEndOverrides.lengthPrimary}/${burialEndOverrides.lengthSecondary} COVERAGE:${burialEndOverrides.coveragePct}%`;
    } else if (spanEndOverrides) {
      mappedDescription = `LENGTH:${spanEndOverrides.lengthPrimary}/${spanEndOverrides.lengthSecondary} HEIGHT:${spanEndOverrides.heightPrimary}/${spanEndOverrides.heightSecondary}`;
      mappedFindings = `Free span ended at KP ${finalKpStr}. LENGTH:${spanEndOverrides.lengthPrimary}/${spanEndOverrides.lengthSecondary} HEIGHT:${spanEndOverrides.heightPrimary}/${spanEndOverrides.heightSecondary}`;
    } else if (isCrossingEvent && crossingOverrides) {
      const descParts: string[] = [];
      if (crossingOverrides.angle) descParts.push(`Angle: ${crossingOverrides.angle}°`);
      if (crossingOverrides.gap) descParts.push(`Gap: ${crossingOverrides.gap}m`);
      if (crossingOverrides.numSupports) descParts.push(`# Supports: ${crossingOverrides.numSupports}`);
      mappedDescription = descParts.length > 0 ? descParts.join(", ") : "NO ANGLE / GAP / SUPPORTS DATA";

      const findingParts: string[] = [crossingOverrides.orientation];
      if (crossingOverrides.crossingLine) findingParts.push(`Line: ${crossingOverrides.crossingLine}`);
      if (crossingOverrides.crossingKp) findingParts.push(`KP: ${crossingOverrides.crossingKp}`);
      if (crossingOverrides.angle) findingParts.push(`Angle: ${crossingOverrides.angle}°`);
      if (crossingOverrides.crossingType) findingParts.push(`Type: ${crossingOverrides.crossingType}`);
      if (crossingOverrides.gap) findingParts.push(`Gap: ${crossingOverrides.gap}m`);
      if (crossingOverrides.numSupports) findingParts.push(`# Supports: ${crossingOverrides.numSupports}`);
      mappedFindings = findingParts.join(", ");
    } else if (isDebris && positionOverrides) {
      mappedDescription = positionOverrides.touching ? "TOUCHING THE LINE" : "NOT TOUCHING THE LINE";
    } else if (isSubseaStructure && positionOverrides) {
      mappedDescription = positionOverrides.isDamaged ? "Damaged" : "";
    } else if (customDefault?.eventDescription) {
      mappedDescription = customDefault.eventDescription
        .replace(/\{kp\}/g, finalKpStr)
        .replace(/\{eventName\}/g, eventName)
        .replace(/\{kpSource\}/g, kpSource === "ROV_DATA_STRING" ? "Live ROV Data String" : "Calculated KP Sync")
        .replace(/\{inspMethod\}/g, inspMethod);
    }

    // Fetch telemetry details from connected ROV string/provider or window objects
    let telemetryNorthing = "";
    let telemetryEasting = "";
    let telemetryDepth = "";
    let telemetryCpFg = "";
    let telemetryHeading = "";

    if (effectiveConnected && Array.isArray(rovConnectionFields)) {
      rovConnectionFields.forEach((f) => {
        if (f.value && f.value !== "--") {
          const tf = (f.targetField || f.label || "").toLowerCase().trim();
          if (tf.includes("northing") || tf === "northing") telemetryNorthing = f.value;
          if (tf.includes("easting") || tf === "easting") telemetryEasting = f.value;
          if (tf.includes("depth") || tf === "depth") telemetryDepth = f.value;
          if (tf.includes("cp") || tf === "cp_fg_rdg" || tf === "cp_fg") telemetryCpFg = f.value;
          if (tf.includes("heading") || tf === "rov_heading") telemetryHeading = f.value;
        }
      });
    }

    if (typeof window !== "undefined") {
      if (!telemetryNorthing && (window as any).rovTelemetryNorthing) telemetryNorthing = String((window as any).rovTelemetryNorthing);
      if (!telemetryEasting && (window as any).rovTelemetryEasting) telemetryEasting = String((window as any).rovTelemetryEasting);
      if (!telemetryDepth && (window as any).rovTelemetryDepth) telemetryDepth = String((window as any).rovTelemetryDepth);
      if (!telemetryCpFg && (window as any).rovTelemetryCpFg) telemetryCpFg = String((window as any).rovTelemetryCpFg);
      if (!telemetryHeading && (window as any).rovTelemetryHeading) telemetryHeading = String((window as any).rovTelemetryHeading);
    }

    onSelectEvent({
      eventName: mappedEventName,
      eventType: mappedEventType,
      eventPosition: mappedEventPosition,
      actionName: eventName,
      eventCategory: subCatName,
      description: mappedDescription,
      eventDescription: mappedDescription,
      findingType: customDefault?.findingType,
      findings: mappedFindings,
      kp: finalKpStr,
      kpSource: kpSource,
      northing: telemetryNorthing,
      easting: telemetryEasting,
      depth: telemetryDepth,
      cp_fg: telemetryCpFg,
      cp_fg_rdg: telemetryCpFg,
      heading: telemetryHeading,
      rov_heading: telemetryHeading,
    });

    // Automatically bring back the main menu after logging the event
    setSelectedCatId(null);
    setSelectedSubCatId(null);
    setSearchTerm("");
  };

  // Global Keyboard Listener for Custom Hotkeys (Alt, Ctrl, Shift + Key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return; // Modifier key alone
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      const keyUpper = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyUpper);

      const pressedCombo = parts.join("+");

      // Match against activeShortcuts assigned hotkeys
      const match = activeShortcuts.find((sc, index) => {
        const assigned = getEffectiveHotkey(sc.id, index);
        return assigned && assigned.toUpperCase() === pressedCombo.toUpperCase();
      });

      if (match) {
        e.preventDefault();
        e.stopPropagation();
        handleTriggerEvent(match.cat, match.sub, match.event, match.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeShortcuts, customHotkeys]);

  const togglePinShortcut = (id: string) => {
    // End events cannot be pinned separately; only Start events can be selected
    if (TOGGLE_PAIRS.some((p) => p.endId === id)) return;

    setPinnedShortcutIds((prev) => {
      const isAlreadyPinned = prev.includes(id);
      if (isAlreadyPinned) {
        return prev.filter((item) => item !== id);
      } else {
        const nextList = [...prev, id];
        const cleanList = nextList.filter((item) => !TOGGLE_PAIRS.some((p) => p.endId === item));
        const newIndex = cleanList.indexOf(id);

        setCustomHotkeys((hkPrev) => {
          if (!hkPrev[id]) {
            return { ...hkPrev, [id]: `Alt+${newIndex + 1}` };
          }
          return hkPrev;
        });

        return nextList;
      }
    });
  };

  const resetToAutoFrequency = () => {
    setPinnedShortcutIds(INITIAL_SHORTCUT_IDS);
    setUsageCounts({});
  };

  return (
    <Card className="flex flex-col h-full w-full min-h-0 border-none shadow-none rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Panel Header */}
      <div className="bg-slate-100 dark:bg-[#090d16] border-b border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-[11px] sm:text-xs font-medium tracking-wider uppercase text-slate-800 dark:text-slate-200">
            Pipeline Event Menu
          </span>
          {selectedCatId && (
            <button
              onClick={() => {
                setSelectedCatId(null);
                setSelectedSubCatId(null);
                setSearchTerm("");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-md shadow-sm border border-blue-400/40 ml-2"
              title="Return to Main Menu in 1 Click"
            >
              <RotateCcw className="w-3 h-3 text-white" /> Main Menu
            </button>
          )}
        </div>
        <Badge variant="outline" className="text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/60 px-2 py-0.5 shadow-sm">
          {inspectionInfoSummary.posPrefix} {inspectionInfoSummary.curPosFormatted}
        </Badge>
      </div>

      {/* Active Events Quick Stop Pill Buttons (All side-by-side in 1 Row) */}
      {activeEventsList.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-400/50 px-2.5 py-1.5 shrink-0 flex items-center gap-1.5 flex-wrap shadow-2xs">
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-[9.5px] font-black uppercase text-amber-900 dark:text-amber-200 tracking-wider">
              ACTIVE:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {activeEventsList.map((activeEvt) => {
              const { kp: resolvedKpStr } = resolveEffectiveKp();
              return (
                <button
                  key={activeEvt.groupKey}
                  onClick={() => handleStopActiveEvent(activeEvt)}
                  className="h-6.5 px-2.5 rounded-md bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-700 hover:to-amber-700 active:scale-95 text-white font-black text-[9.5px] tracking-wider uppercase shadow-xs border border-red-400/60 flex items-center gap-1.5 transition-all shrink-0"
                  title={`Stop ${activeEvt.label} and log end at KP ${resolvedKpStr}`}
                >
                  <span className="flex items-center gap-1 text-amber-100">
                    <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                    {activeEvt.label}: {resolvedKpStr}
                  </span>
                  <span className="bg-black/35 px-1.5 py-0.5 rounded text-[8.5px] font-black flex items-center gap-1 border border-white/20 text-white">
                    <Square className="w-2 h-2 fill-white text-white" /> STOP &amp; END
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Search */}
      <div className="p-2 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search event (Freespan, Anode, CP...)"
            className="h-8 pl-8 text-[11px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:ring-1 focus:ring-blue-500 font-normal"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Body Navigation View - Auto Resizing Container */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 bg-slate-100/60 dark:bg-[#0b101d]">
        {/* IF SEARCH ACTIVE */}
        {searchTerm.trim() ? (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-1">
              Found {searchResults.length} Matching Events
            </div>
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-[11px]">
                No pipeline event matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              searchResults.map(({ category, subCat, event }) => {
                const disabledStatus = getEventDisabledStatus(event.id);
                return (
                  <button
                    key={`${category.id}-${event.id}`}
                    disabled={disabledStatus.isDisabled}
                    onClick={() => handleTriggerEvent(category.name, subCat.name, event.name, event.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition group flex justify-between items-center shadow-md ${
                      disabledStatus.isDisabled
                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800"
                        : "bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:scale-[1.01]"
                    }`}
                    title={disabledStatus.reason || `Log ${event.name}`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[8.5px] font-semibold uppercase px-1.5 py-0.5 rounded shadow-sm ${category.badgeBg}`}>
                          {category.badgeText}
                        </span>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          {subCat.name}
                        </span>
                        {disabledStatus.isDisabled && (
                          <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500 text-white shadow-2xs">
                            IN PROGRESS / DISABLED
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition truncate">
                        {event.name}
                      </div>
                    </div>
                    <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 opacity-90 group-hover:scale-110 transition" />
                  </button>
                );
              })
            )}
          </div>
        ) : !selectedCatId ? (
          /* LEVEL 1: AUTO RESIZING MAIN MENU (5 ICONS IN A ROW) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 flex-1 min-h-0 auto-rows-fr">
            {PIPELINE_EVENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`w-full flex-1 min-h-[62px] sm:min-h-[70px] h-full p-1.5 rounded-xl border-2 shadow-md font-medium uppercase tracking-wider ${cat.borderClass} ${cat.colorClass} transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-between group overflow-hidden relative`}
                title={cat.name}
              >
                {/* Big Centered Icon */}
                <div className="flex-1 w-full flex flex-col items-center justify-center p-0.5">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-black/20 dark:bg-black/30 ring-1 ring-white/20 flex items-center justify-center shadow-inner text-white group-hover:bg-black/35 group-hover:scale-105 transition-all duration-200">
                    {cat.icon}
                  </div>
                </div>

                {/* Elegant Normal-Font Name Box */}
                <div className="w-full text-center px-1 py-0.5 bg-[#0f172a]/80 dark:bg-black/80 rounded-md backdrop-blur-md shrink-0 mt-0.5 flex items-center justify-center min-h-[22px] shadow-sm border border-white/15">
                  <span className="font-semibold tracking-wider uppercase leading-none text-center text-white block max-w-full break-words text-[8px] sm:text-[9px]">
                    {cat.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : !selectedSubCatId && activeCat ? (
          /* LEVEL 2: SUB-CATEGORY MENU (SINGLE ROW HEADER WITH BACK BUTTON) */
          <div className="space-y-2">
            {/* Active Category Single-Row Header Banner with Back Arrow */}
            <div className={`p-2 sm:p-2.5 rounded-xl border-l-4 ${activeCat.borderClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-2 flex items-center justify-between shadow-sm text-slate-900 dark:text-slate-100`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setSelectedCatId(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 p-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 transition"
                  title="Back to Main Categories"
                >
                  <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
                </button>
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
                  {activeCat.icon}
                </div>
                <div>
                  <div className="text-[9px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Selected Category</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{activeCat.name}</div>
                </div>
              </div>
              <Badge className={`${activeCat.badgeBg} font-medium text-[9px] px-2.5 py-1 shadow-xs`}>
                {activeCat.badgeText}
              </Badge>
            </div>

            {/* 5 Icons in 1 Row Grid Layout - No Truncation */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 auto-rows-fr">
              {activeCat.subCategories.map((subCat) => (
                <button
                  key={subCat.id}
                  onClick={() => setSelectedSubCatId(subCat.id)}
                  className="w-full min-h-[96px] sm:min-h-[105px] p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 transition-all flex flex-col items-center justify-between group shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex-1 flex items-center justify-center p-1">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105 transition-all shadow-sm">
                      {activeCat.icon}
                    </div>
                  </div>
                  <div className="w-full text-center px-1 py-1 bg-slate-100/90 dark:bg-slate-950/80 rounded-lg shrink-0 mt-1 border border-slate-200 dark:border-slate-800 shadow-xs min-h-[30px] flex items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300 block leading-[1.15] text-center max-w-full break-words line-clamp-2">
                      {subCat.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* LEVEL 3: ELEGANT ACTION / EVENT TILES (SINGLE ROW HEADER WITH BACK BUTTON) */
          <div className="space-y-2">
            {/* Active Sub-Category Single-Row Header Banner with Back Arrow */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-2 flex items-center justify-between shadow-sm text-slate-900 dark:text-slate-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setSelectedSubCatId(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 p-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 transition"
                  title={`Back to ${activeCat?.name}`}
                >
                  <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCatId(null);
                    setSelectedSubCatId(null);
                    setSearchTerm("");
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 p-1.5 rounded-lg border border-blue-500 shadow-sm transition"
                  title="Return to Main Menu in 1-Click"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Main Menu</span>
                </button>
                {activeCat?.icon && (
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
                    {activeCat.icon}
                  </div>
                )}
                <div>
                  <div className="text-[9px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">{activeCat?.name} &gt; Sub-Category</div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white uppercase">{activeSubCat?.name}</div>
                </div>
              </div>
              <Badge className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-medium text-[10px] px-2.5 py-1">
                SELECT EVENT
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 auto-rows-fr">
              {activeSubCat?.subEvents?.map((evt) => {
                const disabledStatus = getEventDisabledStatus(evt.id);
                const isStartDisabled = TOGGLE_PAIRS.some((p) => p.startId === evt.id && activeToggles[p.groupKey]);
                const isEndDisabled = TOGGLE_PAIRS.some((p) => p.endId === evt.id && !activeToggles[p.groupKey]);

                return (
                  <button
                    key={evt.id}
                    disabled={disabledStatus.isDisabled}
                    onClick={() =>
                      activeCat && activeSubCat && handleTriggerEvent(activeCat.name, activeSubCat.name, evt.name, evt.id)
                    }
                    className={`w-full text-left p-2 rounded-xl transition-all group flex flex-col items-center justify-between shadow-sm min-h-[96px] sm:min-h-[105px] relative overflow-hidden ${
                      disabledStatus.isDisabled
                        ? "opacity-40 cursor-not-allowed select-none bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800"
                        : "bg-white dark:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                    title={disabledStatus.reason || `Quick log ${evt.name}`}
                  >
                    {isStartDisabled && (
                      <span className="absolute top-1 right-1 text-[7.5px] font-black uppercase px-1 py-0.2 rounded bg-amber-500 text-white shadow-xs animate-pulse">
                        IN PROGRESS
                      </span>
                    )}
                    {isEndDisabled && (
                      <span className="absolute top-1 right-1 text-[7.5px] font-bold uppercase px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        START REQ
                      </span>
                    )}

                    <div className="flex-1 w-full flex items-center justify-center p-1">
                      <div className={`p-2 rounded-xl border text-blue-600 dark:text-blue-400 shrink-0 shadow-xs ${
                        disabledStatus.isDisabled
                          ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-60"
                          : "bg-blue-50 dark:bg-blue-950 border-blue-200/80 dark:border-blue-800 group-hover:scale-105"
                      }`}>
                        <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                      </div>
                    </div>
                    <div className="w-full text-center px-1 py-1 bg-slate-100/90 dark:bg-slate-950/90 rounded-lg shrink-0 mt-1 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center min-h-[36px]">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300 leading-snug text-center block max-w-full break-words">
                        {evt.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="bg-slate-100 dark:bg-[#090d16] border-t border-slate-200 dark:border-slate-800 px-3 py-1 text-[10px] text-slate-600 dark:text-slate-400 flex justify-between items-center shrink-0">
        <span className="font-semibold truncate">Mode: {inspMethod} Survey</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold">Pipeline Event Menu</span>
      </div>

      {/* Position Details Selection Dialog Modal (Debris & Subsea Structure) */}
      <Dialog open={isPositionModalOpen} onOpenChange={setIsPositionModalOpen}>
        <DialogContent className="max-w-[280px] sm:max-w-[300px] p-3.5 bg-[#e9e9e9] dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-none shadow-xl text-slate-900 dark:text-slate-100">
          <DialogHeader className="pb-1 border-b border-slate-300 dark:border-slate-700">
            <DialogTitle className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {pendingPositionItem?.isSubseaStructure ? "Subsea Structure Details" : "Debris Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {pendingPositionItem?.isSubseaStructure ? (
              <>
                {/* Damaged Checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="subsea-damaged-checkbox"
                    checked={positionIsTouching}
                    onCheckedChange={(checked) => setPositionIsTouching(!!checked)}
                    className="w-4 h-4 rounded-none border-slate-500"
                  />
                  <label
                    htmlFor="subsea-damaged-checkbox"
                    className="text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer select-none"
                  >
                    Damaged
                  </label>
                </div>

                {/* Disabled Position Radio Buttons Box (as per reference screenshot) */}
                <div className="p-2.5 bg-slate-200/60 dark:bg-slate-950/60 border border-slate-400 dark:border-slate-700 opacity-60 pointer-events-none select-none">
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input type="radio" disabled className="w-3.5 h-3.5" />
                      <span>Port Side</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input type="radio" disabled className="w-3.5 h-3.5" />
                      <span>Starboard Side</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input type="radio" disabled className="w-3.5 h-3.5" />
                      <span>Over</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input type="radio" disabled className="w-3.5 h-3.5" />
                      <span>Under</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Touching the Line Checkbox (Debris) */}
                <div className="p-2.5 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                  <Checkbox
                    id="debris-touching-checkbox"
                    checked={positionIsTouching}
                    onCheckedChange={(checked) => setPositionIsTouching(!!checked)}
                  />
                  <label
                    htmlFor="debris-touching-checkbox"
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                  >
                    Touching the Line
                  </label>
                </div>

                {/* Active Position Options for Debris */}
                <div className="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">
                    POSITION
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: "PORT SIDE", label: "Port Side" },
                      { id: "STARBOARD SIDE", label: "Starboard Side" },
                      { id: "OVER", label: "Over" },
                      { id: "UNDER", label: "Under" },
                    ].map((option) => (
                      <label
                        key={option.id}
                        onClick={() => setSelectedPosition(option.id as any)}
                        className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition select-none ${
                          selectedPosition === option.id
                            ? "bg-teal-50 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 font-semibold border border-teal-300 dark:border-teal-700"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="position-option-radio"
                          checked={selectedPosition === option.id}
                          onChange={() => setSelectedPosition(option.id as any)}
                          className="accent-teal-600 w-3.5 h-3.5"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center pt-2 border-t border-slate-300 dark:border-slate-800">
            <Button
              size="sm"
              onClick={() => {
                if (pendingPositionItem) {
                  const { catName, subCatName, eventName, eventId } = pendingPositionItem;
                  setIsPositionModalOpen(false);
                  setPendingPositionItem(null);
                  handleTriggerEvent(catName, subCatName, eventName, eventId, {
                    touching: positionIsTouching,
                    position: selectedPosition,
                    isDamaged: pendingPositionItem.isSubseaStructure ? positionIsTouching : undefined,
                  });
                }
              }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600 h-7 text-xs font-semibold px-8 shadow-sm"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pipeline Crossing Selection & Details Dialog Modal */}
      <Dialog open={isCrossingModalOpen} onOpenChange={setIsCrossingModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-md bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 shadow-2xl">
          <DialogHeader className="pb-2 border-b border-slate-300 dark:border-slate-800">
            <DialogTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Pipeline Crossing
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {/* Orientation Radio Selector Box */}
            <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-300 dark:border-slate-800 space-y-1.5">
              {[
                "Over the Current Line",
                "Under the Current Line",
              ].map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer select-none font-medium"
                >
                  <input
                    type="radio"
                    name="crossing-orientation-radio"
                    checked={crossingOrientation === opt}
                    onChange={() => setCrossingOrientation(opt as any)}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            {/* Row 1: Crossing Line | KP(km) | Angle */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Crossing Line
                </label>
                <input
                  type="text"
                  value={crossingLineName}
                  onChange={(e) => setCrossingLineName(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  KP(km)
                </label>
                <input
                  type="text"
                  value={crossingKp}
                  onChange={(e) => setCrossingKp(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Angle
                </label>
                <input
                  type="text"
                  value={crossingAngle}
                  onChange={(e) => setCrossingAngle(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: Crossing Type | Gap | # Supports */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Crossing Type
                </label>
                <select
                  value={crossingType}
                  onChange={(e) => setCrossingType(e.target.value)}
                  className="w-full h-7 px-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="CONVENTIONAL">CONVENTIONAL</option>
                  <option value="HARD">HARD</option>
                  <option value="SOFT">SOFT</option>
                  <option value="BRIDGE">BRIDGE</option>
                  <option value="TUNNEL">TUNNEL</option>
                  <option value="MATTRESS">MATTRESS</option>
                  <option value="SLEEPER">SLEEPER</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Gap
                </label>
                <input
                  type="text"
                  value={crossingGap}
                  onChange={(e) => setCrossingGap(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  # Supports
                </label>
                <input
                  type="text"
                  value={crossingNumSupports}
                  onChange={(e) => setCrossingNumSupports(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2 border-t border-slate-300 dark:border-slate-800">
            <Button
              size="sm"
              onClick={() => {
                if (pendingCrossingItem) {
                  const { catName, subCatName, eventName, eventId } = pendingCrossingItem;
                  setIsCrossingModalOpen(false);
                  setPendingCrossingItem(null);
                  handleTriggerEvent(
                    catName,
                    subCatName,
                    eventName,
                    eventId,
                    undefined,
                    {
                      orientation: crossingOrientation,
                      crossingLine: crossingLineName,
                      crossingKp,
                      angle: crossingAngle,
                      crossingType,
                      gap: crossingGap,
                      numSupports: crossingNumSupports,
                    }
                  );
                }
              }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600 h-8 text-xs font-semibold px-8 shadow-sm"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Span Length & Height Dialog Prompt for Seabed Profile Span End */}
      <Dialog open={isSpanEndModalOpen} onOpenChange={setIsSpanEndModalOpen}>
        <DialogContent className="max-w-[340px] p-4 bg-[#e9e9e9] dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-none shadow-xl text-slate-900 dark:text-slate-100">
          <DialogHeader className="pb-1 border-b border-slate-300 dark:border-slate-700">
            <DialogTitle className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Span Length & Height
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-3 text-xs">
            {/* Length Row */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-slate-800 dark:text-slate-200 font-medium text-xs">Length</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={spanLengthInput}
                  onChange={(e) => setSpanLengthInput(e.target.value)}
                  className="w-20 h-6 px-1.5 text-right font-mono text-xs bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-semibold text-xs text-red-700 dark:text-red-400">
                  {unitSystem === "IMPERIAL" ? "ft" : "m"}
                </span>
              </div>
              <span className="ml-auto font-mono text-xs text-slate-700 dark:text-slate-300">
                {(() => {
                  const val = parseFloat(spanLengthInput) || 0;
                  if (unitSystem === "IMPERIAL") {
                    return `${(val / 3.28084).toFixed(2)} m`;
                  } else {
                    return `${(val * 3.28084).toFixed(2)} ft`;
                  }
                })()}
              </span>
            </div>

            {/* Height Row */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-slate-800 dark:text-slate-200 font-medium text-xs">Height</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={spanHeightInput}
                  onChange={(e) => setSpanHeightInput(e.target.value)}
                  className="w-20 h-6 px-1.5 text-right font-mono text-xs bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-semibold text-xs text-red-700 dark:text-red-400">
                  {unitSystem === "IMPERIAL" ? "in" : "mm"}
                </span>
              </div>
              <span className="ml-auto font-mono text-xs text-slate-700 dark:text-slate-300">
                {(() => {
                  const val = parseFloat(spanHeightInput) || 0;
                  if (unitSystem === "IMPERIAL") {
                    return `${(val * 25.4).toFixed(1)} mm`;
                  } else {
                    return `${(val / 25.4).toFixed(2)} in`;
                  }
                })()}
              </span>
            </div>

            {/* Calculation Method Selection */}
            <div className="pt-2 border-t border-slate-300 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-600 dark:text-slate-400">Calc Mode:</span>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="span-calc-mode"
                    checked={spanCalcMode === "KP"}
                    onChange={() => {
                      setSpanCalcMode("KP");
                      const { numKp: endKp } = resolveEffectiveKp();
                      if (spanStartKp !== null && endKp > spanStartKp) {
                        const lenM = Math.abs(endKp - spanStartKp) * 1000;
                        const finalLen = unitSystem === "IMPERIAL" ? (lenM * 3.28084).toFixed(2) : lenM.toFixed(2);
                        setSpanLengthInput(finalLen);
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <span>KP Diff</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="span-calc-mode"
                    checked={spanCalcMode === "NORTHING_EASTING"}
                    onChange={() => {
                      setSpanCalcMode("NORTHING_EASTING");
                      let curNorth: number | null = null;
                      let curEast: number | null = null;
                      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
                        rovConnectionFields.forEach((f) => {
                          if (f.value && f.value !== "--") {
                            const tf = (f.targetField || f.label || "").toLowerCase().trim();
                            if (tf.includes("northing")) curNorth = parseFloat(f.value);
                            if (tf.includes("easting")) curEast = parseFloat(f.value);
                          }
                        });
                      }
                      if (typeof window !== "undefined") {
                        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
                        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
                      }
                      if (spanStartNorthing !== null && spanStartEasting !== null && curNorth !== null && curEast !== null) {
                        const dN = curNorth - spanStartNorthing;
                        const dE = curEast - spanStartEasting;
                        const distM = Math.sqrt(dN * dN + dE * dE);
                        if (!isNaN(distM) && distM > 0) {
                          const finalLen = unitSystem === "IMPERIAL" ? (distM * 3.28084).toFixed(2) : distM.toFixed(2);
                          setSpanLengthInput(finalLen);
                        }
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <span>N / E Dist</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2 border-t border-slate-300 dark:border-slate-800">
            <Button
              size="sm"
              onClick={() => {
                if (pendingSpanEndItem) {
                  const { catName, subCatName, eventName, eventId } = pendingSpanEndItem;
                  const lengthVal = parseFloat(spanLengthInput) || 0;
                  const heightVal = parseFloat(spanHeightInput) || 0;

                  let lengthPrimary = "";
                  let lengthSecondary = "";
                  let heightPrimary = "";
                  let heightSecondary = "";

                  if (unitSystem === "IMPERIAL") {
                    lengthPrimary = `${lengthVal.toFixed(2)}ft`;
                    lengthSecondary = `${(lengthVal / 3.28084).toFixed(2)}m`;
                    heightPrimary = `${heightVal.toFixed(2)}in`;
                    heightSecondary = `${(heightVal * 25.4).toFixed(1)}mm`;
                  } else {
                    lengthPrimary = `${lengthVal.toFixed(2)}m`;
                    lengthSecondary = `${(lengthVal * 3.28084).toFixed(2)}ft`;
                    heightPrimary = `${heightVal.toFixed(1)}mm`;
                    heightSecondary = `${(heightVal / 25.4).toFixed(2)}in`;
                  }

                  setIsSpanEndModalOpen(false);
                  setPendingSpanEndItem(null);

                  handleTriggerEvent(
                    catName,
                    subCatName,
                    eventName,
                    eventId,
                    undefined,
                    undefined,
                    {
                      lengthPrimary,
                      lengthSecondary,
                      heightPrimary,
                      heightSecondary,
                      lengthValueNum: lengthVal,
                      heightValueNum: heightVal,
                    }
                  );
                }
              }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600 h-7 text-xs font-semibold px-8 shadow-sm"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Burial Length & Coverage Dialog Prompt for Burial End */}
      <Dialog open={isBurialEndModalOpen} onOpenChange={setIsBurialEndModalOpen}>
        <DialogContent className="max-w-[340px] p-4 bg-[#e9e9e9] dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-none shadow-xl text-slate-900 dark:text-slate-100">
          <DialogHeader className="pb-1 border-b border-slate-300 dark:border-slate-700">
            <DialogTitle className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Burial Length & Coverage
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-3 text-xs">
            {/* Length Row */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-slate-800 dark:text-slate-200 font-medium text-xs">Length</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={burialLengthInput}
                  onChange={(e) => setBurialLengthInput(e.target.value)}
                  className="w-20 h-6 px-1.5 text-right font-mono text-xs bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-semibold text-xs text-red-700 dark:text-red-400">
                  {unitSystem === "IMPERIAL" ? "ft" : "m"}
                </span>
              </div>
              <span className="ml-auto font-mono text-xs text-slate-700 dark:text-slate-300">
                {(() => {
                  const val = parseFloat(burialLengthInput) || 0;
                  if (unitSystem === "IMPERIAL") {
                    return `${(val / 3.28084).toFixed(2)} ft`;
                  } else {
                    return `${(val * 3.28084).toFixed(2)} ft`;
                  }
                })()}
              </span>
            </div>

            {/* Coverage Row */}
            <div className="flex items-center gap-2">
              <span className="w-16 text-slate-800 dark:text-slate-200 font-medium text-xs">Coverage</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={burialCoverageInput}
                  onChange={(e) => setBurialCoverageInput(e.target.value)}
                  className="w-20 h-6 px-1.5 text-right font-mono text-xs bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-semibold text-xs text-red-700 dark:text-red-400">%</span>
              </div>
            </div>

            {/* Calculation Method Selection */}
            <div className="pt-2 border-t border-slate-300 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-600 dark:text-slate-400">Calc Mode:</span>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="burial-calc-mode"
                    checked={burialCalcMode === "KP"}
                    onChange={() => {
                      setBurialCalcMode("KP");
                      const { numKp: endKp } = resolveEffectiveKp();
                      if (burialStartKp !== null && endKp > burialStartKp) {
                        const lenM = Math.abs(endKp - burialStartKp) * 1000;
                        const finalLen = unitSystem === "IMPERIAL" ? (lenM * 3.28084).toFixed(2) : lenM.toFixed(2);
                        setBurialLengthInput(finalLen);
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <span>KP Diff</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="burial-calc-mode"
                    checked={burialCalcMode === "NORTHING_EASTING"}
                    onChange={() => {
                      setBurialCalcMode("NORTHING_EASTING");
                      let curNorth: number | null = null;
                      let curEast: number | null = null;
                      if (effectiveConnected && Array.isArray(rovConnectionFields)) {
                        rovConnectionFields.forEach((f) => {
                          if (f.value && f.value !== "--") {
                            const tf = (f.targetField || f.label || "").toLowerCase().trim();
                            if (tf.includes("northing")) curNorth = parseFloat(f.value);
                            if (tf.includes("easting")) curEast = parseFloat(f.value);
                          }
                        });
                      }
                      if (typeof window !== "undefined") {
                        if (curNorth === null && (window as any).rovTelemetryNorthing) curNorth = parseFloat(String((window as any).rovTelemetryNorthing));
                        if (curEast === null && (window as any).rovTelemetryEasting) curEast = parseFloat(String((window as any).rovTelemetryEasting));
                      }
                      if (burialStartNorthing !== null && burialStartEasting !== null && curNorth !== null && curEast !== null) {
                        const dN = curNorth - burialStartNorthing;
                        const dE = curEast - burialStartEasting;
                        const distM = Math.sqrt(dN * dN + dE * dE);
                        if (!isNaN(distM) && distM > 0) {
                          const finalLen = unitSystem === "IMPERIAL" ? (distM * 3.28084).toFixed(2) : distM.toFixed(2);
                          setBurialLengthInput(finalLen);
                        }
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <span>N / E Dist</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2 border-t border-slate-300 dark:border-slate-800">
            <Button
              size="sm"
              onClick={() => {
                if (pendingBurialEndItem) {
                  const { catName, subCatName, eventName, eventId } = pendingBurialEndItem;
                  const lengthVal = parseFloat(burialLengthInput) || 0;
                  const covVal = parseFloat(burialCoverageInput) || 100;

                  let lengthPrimary = "";
                  let lengthSecondary = "";

                  if (unitSystem === "IMPERIAL") {
                    lengthPrimary = `${lengthVal.toFixed(2)}ft`;
                    lengthSecondary = `${(lengthVal / 3.28084).toFixed(2)}m`;
                  } else {
                    lengthPrimary = `${lengthVal.toFixed(2)}m`;
                    lengthSecondary = `${(lengthVal * 3.28084).toFixed(2)}ft`;
                  }

                  setIsBurialEndModalOpen(false);
                  setPendingBurialEndItem(null);

                  handleTriggerEvent(
                    catName,
                    subCatName,
                    eventName,
                    eventId,
                    undefined,
                    undefined,
                    undefined,
                    {
                      lengthPrimary,
                      lengthSecondary,
                      coveragePct: covVal.toFixed(1),
                    }
                  );
                }
              }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600 h-7 text-xs font-semibold px-8 shadow-sm"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
