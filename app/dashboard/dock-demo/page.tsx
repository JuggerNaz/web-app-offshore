"use client";

import React, { useState } from "react";
import { Layout, Model, TabNode, IJsonModel } from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Video, ClipboardList, List, TableProperties } from "lucide-react";

// The default layout configuration
const defaultConfig: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabSetEnableMaximize: true,
  },
  borders: [
    {
      type: "border",
      location: "bottom",
      size: 200,
      children: [
        {
          type: "tab",
          name: "Captured Events",
          component: "events",
        }
      ]
    }
  ],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "column",
        weight: 20,
        children: [
          {
            type: "tabset",
            weight: 50,
            children: [
              {
                type: "tab",
                name: "Diver Log",
                component: "diverLog",
              },
            ],
          },
          {
            type: "tabset",
            weight: 50,
            children: [
              {
                type: "tab",
                name: "Video Log",
                component: "videoLog",
              },
            ],
          },
        ],
      },
      {
        type: "tabset",
        weight: 60,
        children: [
          {
            type: "tab",
            name: "Marine Growth Form",
            component: "inspectionForm",
          },
        ],
      },
      {
        type: "tabset",
        weight: 20,
        children: [
          {
            type: "tab",
            name: "Component List",
            component: "components",
          },
        ],
      },
    ],
  },
};

export default function DockDemo() {
  const [model] = useState<Model>(Model.fromJson(defaultConfig));

  // High-density Inspection Form component
  const InspectionFormDemo = () => (
    <div className="h-full w-full overflow-y-auto p-2 bg-slate-950 text-slate-200">
      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Spec: Marine Growth Inspection
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs bg-slate-900 border-slate-700">Update Record</Button>
      </div>

      {/* Dynamic Grid: auto-fills columns based on available width! This replaces media queries. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 mb-4">
        <div className="bg-slate-900 p-2 rounded border border-slate-800">
          <Label className="text-[10px] text-slate-400 uppercase">Verification Depth</Label>
          <div className="flex gap-1 mt-1">
            <Input className="h-7 text-xs bg-slate-950 border-slate-700" defaultValue="-10" />
            <Select defaultValue="m">
              <SelectTrigger className="h-7 w-[60px] text-xs bg-slate-950 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m">m</SelectItem>
                <SelectItem value="ft">ft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="bg-slate-900 p-2 rounded border border-slate-800">
          <Label className="text-[10px] text-slate-400 uppercase">Elevation Range</Label>
          <Input className="h-7 text-xs mt-1 bg-slate-950 border-slate-700" defaultValue="2 - -29 m" />
        </div>

        <div className="bg-slate-900 p-2 rounded border border-slate-800">
          <Label className="text-[10px] text-slate-400 uppercase">Inspection Date</Label>
          <Input className="h-7 text-xs mt-1 bg-slate-950 border-slate-700" type="date" defaultValue="2026-05-10" />
        </div>
      </div>

      {/* High-density grid for MGI Thickness */}
      <div className="border border-green-900/50 bg-green-950/20 rounded-md p-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-green-400 uppercase tracking-wider">MGI Thickness</span>
          <span className="text-[10px] text-green-500 bg-green-950 px-2 py-0.5 rounded">MAX: 73.0mm</span>
        </div>

        {/* The measurement grid automatically wraps/adjusts */}
        <div className="flex flex-wrap gap-2">
          {['12 O\'CLK', '3 O\'CLK', '6 O\'CLK', '9 O\'CLK'].map((clk, i) => (
            <div key={clk} className="flex-1 min-w-[120px] bg-slate-900/50 p-2 rounded border border-slate-800">
              <div className="text-center text-[10px] text-slate-400 mb-1">{clk}</div>
              
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[9px] w-6 text-red-400 font-bold">HARD</span>
                <Input className="h-6 text-xs bg-slate-950 border-slate-700 px-1" placeholder="Val" />
                <span className="text-[10px] text-slate-500">mm</span>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-[9px] w-6 text-green-400 font-bold">SOFT</span>
                <Input className="h-6 text-xs bg-slate-950 border-slate-700 px-1" placeholder="Val" />
                <span className="text-[10px] text-slate-500">mm</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // The factory function that renders React components based on the tab's component name
  const factory = (node: TabNode) => {
    const component = node.getComponent();

    if (component === "diverLog") {
      return (
        <div className="p-4 h-full bg-slate-900 text-slate-300 flex flex-col items-center justify-center border-t-2 border-blue-500">
          <Info className="h-8 w-8 mb-2 text-blue-400" />
          <h2 className="font-bold">Diver Log</h2>
          <p className="text-xs text-center mt-2 opacity-70">Drag this tab to reposition or float it!</p>
        </div>
      );
    }

    if (component === "videoLog") {
      return (
        <div className="p-4 h-full bg-slate-900 text-slate-300 flex flex-col items-center justify-center border-t-2 border-red-500">
          <Video className="h-8 w-8 mb-2 text-red-400" />
          <h2 className="font-bold">Video Log</h2>
          <p className="text-xs text-center mt-2 opacity-70">Resize this panel to see how others react.</p>
        </div>
      );
    }

    if (component === "inspectionForm") {
      return <InspectionFormDemo />;
    }

    if (component === "components") {
      return (
        <div className="p-4 h-full bg-slate-900 text-slate-300">
          <h3 className="font-bold text-sm border-b border-slate-800 pb-2 mb-2 flex items-center gap-2">
            <List className="h-4 w-4" /> Component List
          </h3>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="text-xs p-2 bg-slate-800 rounded">
                BAN00{i} <span className="float-right text-slate-500">-9m</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (component === "events") {
      return (
        <div className="p-4 h-full bg-slate-900 text-slate-300">
          <h3 className="font-bold text-sm border-b border-slate-800 pb-2 mb-2 flex items-center gap-2">
            <TableProperties className="h-4 w-4" /> Captured Events
          </h3>
          <p className="text-xs text-slate-500">This is a bottom border tab. You can hide/show it.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shrink-0">
        <h1 className="text-white font-bold tracking-wider text-sm flex items-center gap-2">
          <span className="text-blue-500">⚙</span> DOCKABLE UI DEMO
        </h1>
        <div className="text-xs text-slate-400">
          Try dragging tabs, resizing panels, and using the float icon on the tab headers!
        </div>
      </div>

      {/* The FlexLayout Container must have position relative or absolute */}
      <div className="flex-1 relative">
        <Layout
          model={model}
          factory={factory}
          // Theming customization via classes or overriding global css (flexlayout-react/style/dark.css)
          classNameMapper={(className) => {
            if (className === "flexlayout__tab_button") return className + " bg-slate-900 hover:bg-slate-800 text-slate-300";
            if (className === "flexlayout__tab_button--selected") return className + " bg-slate-800 text-white font-bold border-b-2 border-blue-500";
            return className;
          }}
        />
      </div>

      {/* Quick custom styles to override default FlexLayout ugly gray colors */}
      <style dangerouslySetInnerHTML={{__html: `
        .flexlayout__layout { background-color: #020617; } /* slate-950 */
        .flexlayout__splitter { background-color: #0f172a; } /* slate-900 */
        .flexlayout__splitter:hover { background-color: #3b82f6; transition: background-color 0.2s; }
        .flexlayout__tabset_header { background-color: #020617; }
        .flexlayout__tabset_header_inner { border-bottom: 1px solid #1e293b; }
        .flexlayout__tab { background-color: #020617; overflow: hidden; }
        .flexlayout__tab_button { background-color: #020617; color: #94a3b8; padding: 0 16px; border-radius: 4px 4px 0 0; }
        .flexlayout__tab_button--selected { background-color: #0f172a; color: #fff; }
        .flexlayout__border_bottom { background-color: #020617; border-top: 1px solid #1e293b; }
      `}} />
    </div>
  );
}
