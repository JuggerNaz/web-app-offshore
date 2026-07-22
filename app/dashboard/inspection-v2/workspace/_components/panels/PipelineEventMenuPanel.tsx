"use client";

import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

export interface PipelineEventItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  subEvents?: PipelineEventItem[];
}

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
        id: "anode_remote_block",
        name: "Remote Block Anode",
        subEvents: [
          { id: "anode_remote_block_0_25", name: "Remote Block - 0 - 25% Depletion" },
          { id: "anode_remote_block_25_50", name: "Remote Block - 25 - 50% Depletion" },
          { id: "anode_remote_block_50_75", name: "Remote Block - 50 - 75% Depletion" },
          { id: "anode_remote_block_75_100", name: "Remote Block - 75 - 100% Depletion" },
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
        id: "riser_clamps",
        name: "Clamps & Supports",
        subEvents: [
          { id: "riser_clamp_guide", name: "Riser Clamp / Guide Frame" },
          { id: "riser_neoprene", name: "Neoprene Liner / Isolator" },
          { id: "riser_bolt_assembly", name: "Riser Clamp Bolt Assembly" },
        ],
      },
      {
        id: "riser_base",
        name: "Riser Base & Touchdown",
        subEvents: [
          { id: "riser_bend_elbow", name: "Riser Bend / 90° Elbow" },
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
        id: "line_boundaries_turns",
        name: "Line Boundaries & Turns",
        subEvents: [
          { id: "line_start", name: "Line Start" },
          { id: "line_end", name: "Line End" },
          { id: "line_skip_start", name: "Skip Start" },
          { id: "line_skip_end", name: "Skip End" },
          { id: "line_turns", name: "Line Turns" },
        ],
      },
      {
        id: "line_fittings_conn",
        name: "Fittings & Connections",
        subEvents: [
          { id: "line_jtube", name: "J - Tube" },
          { id: "line_flange", name: "Flange" },
          { id: "line_sidetap", name: "Side Tap" },
          { id: "line_t_joint", name: "T - Joint" },
          { id: "line_valve_spindle", name: "Valve - Spindle Handle" },
          { id: "line_valve_normal", name: "Valve - Normal" },
          { id: "line_connector", name: "Connector" },
        ],
      },
      {
        id: "line_crossings_supports",
        name: "Crossings & Supports",
        subEvents: [
          { id: "line_crossing", name: "Crossing..." },
          { id: "line_elbow_port", name: "Elbow - Port Side" },
          { id: "line_elbow_starboard", name: "Elbow - Starboard Side" },
          { id: "line_repair_clamp", name: "Repair Clamp" },
          { id: "line_clamp", name: "Clamp" },
          { id: "line_mag_tape", name: "Magnetic Tape Marker" },
          { id: "line_trawl_guard", name: "Over Trawl Guard" },
        ],
      },
      {
        id: "line_damage_anomalies",
        name: "Damage & Anomalies",
        subEvents: [
          { id: "line_anchor_drag", name: "Anchor Drag" },
          { id: "line_buckle_arrestor", name: "Buckle Arrestor" },
          { id: "line_buckle_trigger", name: "Buckle Trigger" },
          // Coating Damage Options
          { id: "line_cd_bare_metal", name: "Coating Damage - Bare Metal Showing" },
          { id: "line_cd_cracked", name: "Coating Damage - Coating Cracked" },
          { id: "line_cd_cracked_long", name: "Coating Damage - Coating Cracked Longitudinally" },
          { id: "line_cd_cracked_circ", name: "Coating Damage - Coating Cracked Circumferentially" },
          { id: "line_cd_reinf_exposed", name: "Coating Damage - Reinforcing Exposed" },
          { id: "line_cd_superficial", name: "Coating Damage - Superficial Damage" },
          { id: "line_cd_wire_scars", name: "Coating Damage - Wire Scars" },
          { id: "line_cd_wrap_damage", name: "Coating Damage - Wrap Damage" },
          { id: "line_cd_other", name: "Coating Damage - Other Defect" },
          // Physical Damage Options
          { id: "line_pd_bend_port", name: "Physical Damage - Bend/Buckle To Port Side" },
          { id: "line_pd_bend_starboard", name: "Physical Damage - Bend/Buckle To Starboard Side" },
          { id: "line_pd_bend_upwards", name: "Physical Damage - Bend/Buckle Upwards" },
          { id: "line_pd_bend_downwards", name: "Physical Damage - Bend/Buckle Downwards" },
          { id: "line_pd_dent_port", name: "Dent - Port Side" },
          { id: "line_pd_dent_starboard", name: "Dent - Starboard Side" },
          { id: "line_pd_dent_top", name: "Dent - Top" },
          { id: "line_pd_dent_bottom", name: "Dent - Bottom" },
          { id: "line_pd_leak", name: "Physical Damage - Leak" },
          { id: "line_pd_ruptured", name: "Physical Damage - Ruptured" },
          { id: "line_pd_other", name: "Physical Damage - Other Defect" },
          { id: "line_other", name: "Other" },
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

// Default Initial Most Frequent Shortcuts
const INITIAL_SHORTCUT_IDS = [
  "span_start",
  "span_end",
  "anode_bracelet_0_25",
  "cp_stab_anode",
  "fj_start",
  "debris_pipe",
];

interface PipelineEventMenuPanelProps {
  onSelectEvent: (eventData: {
    eventName: string;
    eventType: string;
    eventCategory: string;
    description: string;
  }) => void;
  currentKp?: number | string;
  inspMethod?: "DIVING" | "ROV";
}

export function PipelineEventMenuPanel({
  onSelectEvent,
  currentKp = "0.000",
  inspMethod = "ROV",
}: PipelineEventMenuPanelProps) {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dynamic Pinned Shortcuts & Event Usage Counter State
  const [pinnedShortcutIds, setPinnedShortcutIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pipeline_event_pinned_shortcuts");
      if (saved) {
        try {
          return JSON.parse(saved);
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

  // Save pinned shortcuts and usage counts to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pipeline_event_pinned_shortcuts", JSON.stringify(pinnedShortcutIds));
    }
  }, [pinnedShortcutIds]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pipeline_event_usage_counts", JSON.stringify(usageCounts));
    }
  }, [usageCounts]);

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

  // Compute Active 6 Shortcuts to display in bottom bar
  const activeShortcuts = useMemo(() => {
    // 1. First gather user-pinned items in exact order
    const pinnedList = pinnedShortcutIds
      .map((id) => allFlattenedEvents.find((e) => e.id === id))
      .filter(Boolean) as typeof allFlattenedEvents;

    // 2. If fewer than 6, auto-fill from highest usage frequency
    if (pinnedList.length < 6) {
      const sortedByUsage = [...allFlattenedEvents]
        .filter((e) => !pinnedShortcutIds.includes(e.id))
        .sort((a, b) => (usageCounts[b.id] || 0) - (usageCounts[a.id] || 0));

      return [...pinnedList, ...sortedByUsage].slice(0, 6);
    }

    return pinnedList.slice(0, 6);
  }, [pinnedShortcutIds, allFlattenedEvents, usageCounts]);

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

  const handleTriggerEvent = (catName: string, subCatName: string, eventName: string, eventId?: string) => {
    // Increment usage frequency for smart auto-placement
    if (eventId) {
      setUsageCounts((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] || 0) + 1,
      }));
    } else {
      // Find event ID if not explicitly passed
      const target = allFlattenedEvents.find((e) => e.event === eventName);
      if (target) {
        setUsageCounts((prev) => ({
          ...prev,
          [target.id]: (prev[target.id] || 0) + 1,
        }));
      }
    }

    onSelectEvent({
      eventName: eventName,
      eventType: catName,
      eventCategory: subCatName,
      description: `${eventName} recorded during ${inspMethod} survey`,
    });

    // Automatically bring back the main menu after logging the event
    setSelectedCatId(null);
    setSelectedSubCatId(null);
    setSearchTerm("");
  };

  const togglePinShortcut = (id: string) => {
    setPinnedShortcutIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
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
          KP {currentKp}
        </Badge>
      </div>

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
              searchResults.map(({ category, subCat, event }) => (
                <button
                  key={`${category.id}-${event.id}`}
                  onClick={() => handleTriggerEvent(category.name, subCat.name, event.name, event.id)}
                  className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition group flex justify-between items-center shadow-md"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[8.5px] font-semibold uppercase px-1.5 py-0.5 rounded shadow-sm ${category.badgeBg}`}>
                        {category.badgeText}
                      </span>
                      <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        {subCat.name}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition truncate">
                      {event.name}
                    </div>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 opacity-90 group-hover:scale-110 transition" />
                </button>
              ))
            )}
          </div>
        ) : !selectedCatId ? (
          /* LEVEL 1: AUTO RESIZING MAIN MENU (5 ICONS IN A ROW) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 flex-1 min-h-0 auto-rows-fr">
            {PIPELINE_EVENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`w-full flex-1 min-h-[78px] sm:min-h-[88px] h-full p-2 rounded-xl border-2 shadow-xl font-medium uppercase tracking-wider ${cat.borderClass} ${cat.colorClass} transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.97] flex flex-col items-center justify-between group overflow-hidden relative`}
                title={cat.name}
              >
                {/* Big Centered Icon */}
                <div className="flex-1 w-full flex flex-col items-center justify-center p-0.5">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-black/20 dark:bg-black/30 ring-1 ring-white/20 flex items-center justify-center shadow-inner text-white group-hover:bg-black/35 group-hover:ring-white/40 group-hover:scale-105 transition-all duration-200">
                    {cat.icon}
                  </div>
                </div>

                {/* Elegant Normal-Font Name Box */}
                <div className="w-full text-center px-1 py-1 bg-[#0f172a]/80 dark:bg-black/80 rounded-md backdrop-blur-md shrink-0 mt-1 flex items-center justify-center min-h-[26px] shadow-sm border border-white/15">
                  <span className="font-semibold tracking-wider uppercase leading-[1.1] text-center text-white block max-w-full break-words text-[8.5px] sm:text-[9.5px]">
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
              {activeSubCat?.subEvents?.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() =>
                    activeCat && activeSubCat && handleTriggerEvent(activeCat.name, activeSubCat.name, evt.name, evt.id)
                  }
                  className="w-full text-left p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 transition-all group flex flex-col items-center justify-between shadow-sm hover:scale-[1.02] active:scale-[0.98] min-h-[96px] sm:min-h-[105px]"
                >
                  <div className="flex-1 w-full flex items-center justify-center p-1">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition shrink-0 shadow-xs">
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="w-full text-center px-1 py-1 bg-slate-100/90 dark:bg-slate-950/90 rounded-lg shrink-0 mt-1 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center min-h-[36px]">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300 leading-snug text-center block max-w-full break-words">
                      {evt.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Section: Most Frequent Events Icon Menu Bar + Settings */}
      <div className="bg-slate-100/90 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1.5 mb-1 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Most Frequent Events (1-Click Quick Log)
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 shadow-xs"
            title="Configure Most Frequent Events Bar"
          >
            <Settings className="w-3 h-3 text-slate-500" /> Settings
          </button>
        </div>

        {/* Icon Tile Button Layout for Shortcuts with Full Event Names */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {activeShortcuts.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleTriggerEvent(sc.cat, sc.sub, sc.event, sc.id)}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-blue-50/60 dark:hover:bg-slate-850 hover:border-blue-500 dark:hover:border-blue-400 transition-all flex flex-col items-center justify-between group shadow-xs hover:scale-[1.02] active:scale-[0.98] min-h-[70px] sm:min-h-[76px]"
              title={`Quick log ${sc.event}`}
            >
              <div className="flex-1 flex items-center justify-center p-0.5">
                <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-900 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition shrink-0">
                  {sc.icon}
                </div>
              </div>
              <div className="w-full text-center px-1 py-1 bg-slate-100/80 dark:bg-slate-900 rounded shrink-0 mt-0.5 border border-slate-200/60 dark:border-slate-800 min-h-[26px] flex items-center justify-center">
                <span className="text-[8.5px] sm:text-[9.5px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 leading-[1.15] text-center block max-w-full break-words line-clamp-2">
                  {sc.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-slate-100 dark:bg-[#090d16] border-t border-slate-200 dark:border-slate-800 px-3 py-1 text-[10px] text-slate-600 dark:text-slate-400 flex justify-between items-center shrink-0">
        <span className="font-semibold truncate">Mode: {inspMethod} Survey</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold">1-Click Auto Capture</span>
      </div>

      {/* Interactive Settings Dialog for Shortcuts Configuration */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden font-sans">
          <DialogHeader className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Configure Frequent Quick Events
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToAutoFrequency}
                className="h-7 text-[10px] font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 px-2"
              >
                <RotateCcw className="w-3 h-3" /> Auto-Reset
              </Button>
            </div>
            <DialogDescription className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Select events to pin to your persistent bottom 1-click bar. Unpinned slots will auto-fill based on your survey frequency.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 max-h-[350px] overflow-y-auto custom-scrollbar space-y-3">
            {PIPELINE_EVENT_CATEGORIES.map((cat) => (
              <div key={cat.id} className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1">
                  <div className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                    {cat.icon}
                  </div>
                  <span>{cat.name}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {cat.subCategories.flatMap((sc) =>
                    sc.subEvents?.map((evt) => {
                      const isChecked = pinnedShortcutIds.includes(evt.id);
                      return (
                        <label
                          key={evt.id}
                          className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePinShortcut(evt.id)}
                          />
                          <span className="truncate">{evt.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <Button
              onClick={() => setIsSettingsOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 h-8"
            >
              Done & Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
