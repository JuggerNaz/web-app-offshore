"use client";

import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Html,
  ContactShadows,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";
import { Badge } from "@/components/ui/badge";
import { X, MapPin, Compass } from "lucide-react";

export interface PipelineEvent3D {
  id: string | number;
  kp: number;
  easting: number;
  northing: number;
  depth: number;
  eventType: string; // e.g. "SPAN", "BURIAL", "ANODE", "FIELD_JOINT", "SUPPORT", "DEBRIS", "CP", "UT"
  eventName?: string;
  eventPosition?: string;
  isAnomaly?: boolean;
  defectType?: string;
  defectCode?: string;
  priority?: string;
  cpValue?: string | number;
  utValue?: string | number;
  findings?: string;
  length?: number;
  height?: number;
  supportType?: string;
  anodeDepletion?: string;
  surveyYear?: string;
}

export interface Pipeline3DViewerProps {
  records: PipelineEvent3D[];
  comparisonRecords?: PipelineEvent3D[];
  startPlatformName?: string;
  endPlatformName?: string;
  selectedEventId?: string | number;
  onSelectEvent?: (evt: PipelineEvent3D) => void;
  showComparison?: boolean;
  surveyLabel?: string;
  comparisonLabel?: string;
}

// ----------------------------------------------------------------------------
// 3D PLATFORM TOWER COMPONENT (Start & End Nodes)
// ----------------------------------------------------------------------------
const PlatformTower = ({
  position,
  label,
  color = "#3b82f6",
}: {
  position: [number, number, number];
  label: string;
  color?: string;
}) => {
  return (
    <group position={position}>
      {/* 4 Leg Jacket Tower */}
      {[-2, 2].map((x) =>
        [-2, 2].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 5, z]}>
            <cylinderGeometry args={[0.2, 0.4, 10, 16]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}
      {/* Platform Deck */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[6, 0.4, 6]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Platform Helipad */}
      <mesh position={[0, 10.5, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.1, 32]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Floating 3D Label */}
      <Html position={[0, 12, 0]} center distanceFactor={15}>
        <div className="bg-slate-900/90 backdrop-blur-md border border-blue-500/50 text-white px-2 py-1 rounded shadow-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>🏗️ {label}</span>
        </div>
      </Html>
    </group>
  );
};

// ----------------------------------------------------------------------------
// 3D EVENT MARKERS & GEOMETRIES
// ----------------------------------------------------------------------------
const EventMarker = ({
  evt,
  position,
  isSelected,
  onClick,
}: {
  evt: PipelineEvent3D;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const typeUpper = (evt.eventType || "").toUpperCase();
  const isAnomaly = evt.isAnomaly || typeUpper.includes("ANOMALY") || typeUpper.includes("DEFECT");

  // Determine geometry based on event type
  const isAnode = typeUpper.includes("ANODE");
  const isFieldJoint = typeUpper.includes("FIELD") || typeUpper.includes("JOINT") || typeUpper.includes("FJ");
  const isSupport = typeUpper.includes("SUPPORT") || typeUpper.includes("SLEEPER") || typeUpper.includes("MATTRESS") || typeUpper.includes("BAG");
  const isSpan = typeUpper.includes("SPAN");
  const isBurial = typeUpper.includes("BURIAL") || typeUpper.includes("EXPOSED");

  return (
    <group position={position}>
      {/* 1. ANODE SLEEVE RING */}
      {isAnode && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.6, 32]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} />
          <Edges color="#7dd3fc" />
        </mesh>
      )}

      {/* 2. FIELD JOINT BAND */}
      {isFieldJoint && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.25, 32]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
          <Edges color="#fbbf24" />
        </mesh>
      )}

      {/* 3. PIPE SUPPORT BLOCK */}
      {isSupport && (
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
          <meshStandardMaterial color="#78716c" metalness={0.3} roughness={0.7} />
          <Edges color="#a8a29e" />
        </mesh>
      )}

      {/* 4. SEMI-TRANSPARENT SPAN OR BURIAL LAYER */}
      {isSpan && (
        <group position={[0, -0.6, 0]}>
          {/* Elevated Gap Under Span */}
          <mesh>
            <boxGeometry args={[evt.length || 3, 0.8, 1.5]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} />
          </mesh>
        </group>
      )}

      {isBurial && (
        <group position={[0, 0.2, 0]}>
          {/* Semi-Transparent Mud Layer Covering Pipe */}
          <mesh>
            <boxGeometry args={[evt.length || 4, 0.9, 1.8]} />
            <meshStandardMaterial color="#78350f" transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* 5. RED ANOMALY BEACON / FLAG */}
      {isAnomaly && (
        <group position={[0, 1.2, 0]}>
          {/* Beacon Cone */}
          <mesh>
            <coneGeometry args={[0.3, 0.6, 16]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
          </mesh>
          {/* Pulsing Outer Aura */}
          <mesh>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="#f87171" transparent opacity={0.25} />
          </mesh>
        </group>
      )}

      {/* HIT TARGET MESH */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        position={[0, 0.4, 0]}
      >
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* FLOATING EVENT BADGE ICON */}
      <Html position={[0, 1.6, 0]} center distanceFactor={12}>
        <button
          onClick={onClick}
          className={`cursor-pointer transition-all transform hover:scale-110 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg border ${
            isAnomaly
              ? "bg-red-600 text-white border-red-300 animate-pulse ring-2 ring-red-400"
              : isSelected
              ? "bg-blue-600 text-white border-blue-300 ring-2 ring-blue-400"
              : hovered
              ? "bg-indigo-600 text-white border-indigo-300"
              : "bg-slate-900/90 text-slate-200 border-slate-700"
          }`}
        >
          <span>
            {isAnomaly
              ? "🚩 ANOMALY"
              : isAnode
              ? "⚡ ANODE"
              : isFieldJoint
              ? "🔗 FJ"
              : isSpan
              ? "🌊 SPAN"
              : isBurial
              ? "⏳ BURIAL"
              : isSupport
              ? "🧱 SUPP"
              : "📍 EVT"}
          </span>
          <span className="font-mono text-[8.5px] opacity-90">KP {evt.kp.toFixed(3)}</span>
        </button>
      </Html>
    </group>
  );
};

// ----------------------------------------------------------------------------
// MAIN 3D CANVAS COMPONENT
// ----------------------------------------------------------------------------
export const Pipeline3DViewer: React.FC<Pipeline3DViewerProps> = ({
  records = [],
  comparisonRecords = [],
  startPlatformName = "Platform A",
  endPlatformName = "Platform B",
  selectedEventId,
  onSelectEvent,
  showComparison = false,
  surveyLabel = "Primary Survey",
  comparisonLabel = "Historical Survey",
}) => {
  const [selectedEvt, setSelectedEvt] = useState<PipelineEvent3D | null>(null);

  // Normalize points & spatial bounding box calculation
  const { primaryPoints, primaryEvts, compPoints, compEvts, center } = useMemo(() => {
    if (!records || records.length === 0) {
      // Mock pipeline trajectory if empty
      const pts: [number, number, number][] = [];
      const evts: { evt: PipelineEvent3D; pos: [number, number, number] }[] = [];
      for (let i = 0; i <= 20; i++) {
        const kp = i * 0.1;
        const x = i * 4 - 40;
        const y = -15 + Math.sin(i * 0.5) * 1.5;
        const z = Math.sin(i * 0.3) * 6;
        pts.push([x, y, z]);

        if (i % 3 === 0) {
          const type = i === 6 ? "SPAN" : i === 12 ? "ANODE" : i === 15 ? "ANOMALY" : "FIELD_JOINT";
          evts.push({
            evt: {
              id: `evt-${i}`,
              kp,
              easting: 700000 + x * 10,
              northing: 9000000 + z * 10,
              depth: Math.abs(y),
              eventType: type,
              isAnomaly: type === "ANOMALY",
              defectType: type === "ANOMALY" ? "CP Under-Protection" : undefined,
              cpValue: -985 + i,
              findings: type === "ANOMALY" ? "CP breach recorded -750mV" : "Normal inspection condition.",
            },
            pos: [x, y, z],
          });
        }
      }
      return {
        primaryPoints: pts,
        primaryEvts: evts,
        compPoints: [],
        compEvts: [],
        bounds: { minX: -40, maxX: 40, minY: -20, maxY: 0, minZ: -10, maxZ: 10 },
        center: [0, -10, 0] as [number, number, number],
      };
    }

    // Process real Northing / Easting / Depth values
    const minE = Math.min(...records.map((r) => r.easting || 0));
    const maxE = Math.max(...records.map((r) => r.easting || 0));
    const minN = Math.min(...records.map((r) => r.northing || 0));
    const maxN = Math.max(...records.map((r) => r.northing || 0));
    const rangeE = maxE - minE || 1;
    const rangeN = maxN - minN || 1;

    // Scale to Three.js world space [-40, 40]
    const pts: [number, number, number][] = records.map((r, idx) => {
      const x = ((r.easting - minE) / rangeE) * 80 - 40;
      const z = ((r.northing - minN) / rangeN) * 80 - 40;
      const y = -Math.abs(r.depth || 0) * 0.4;
      return [isNaN(x) ? idx * 4 - 30 : x, isNaN(y) ? -10 : y, isNaN(z) ? 0 : z];
    });

    const evts = records.map((r, idx) => ({
      evt: r,
      pos: pts[idx] || [0, 0, 0],
    }));

    // Comparison records processing
    let compPts: [number, number, number][] = [];
    let compEvtList: { evt: PipelineEvent3D; pos: [number, number, number] }[] = [];

    if (comparisonRecords && comparisonRecords.length > 0) {
      compPts = comparisonRecords.map((r, idx) => {
        const x = ((r.easting - minE) / rangeE) * 80 - 40;
        const z = ((r.northing - minN) / rangeN) * 80 - 40;
        const y = -Math.abs(r.depth || 0) * 0.4 - 0.3; // Offset slightly for visual comparison
        return [isNaN(x) ? idx * 4 - 30 : x, isNaN(y) ? -10.3 : y, isNaN(z) ? 0 : z];
      });
      compEvtList = comparisonRecords.map((r, idx) => ({
        evt: r,
        pos: compPts[idx] || [0, 0, 0],
      }));
    }

    return {
      primaryPoints: pts,
      primaryEvts: evts,
      compPoints: compPts,
      compEvts: compEvtList,
      bounds: { minX: -40, maxX: 40, minY: -20, maxY: 0, minZ: -40, maxZ: 40 },
      center: [0, -10, 0] as [number, number, number],
    };
  }, [records, comparisonRecords]);

  // Construct 3D Smooth Curve Tube for Primary Pipeline
  const primaryTubeGeometry = useMemo(() => {
    if (primaryPoints.length < 2) return null;
    const v3Points = primaryPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(v3Points, false, "catmullrom", 0.3);
    return new THREE.TubeGeometry(curve, 128, 0.3, 16, false);
  }, [primaryPoints]);

  // Construct 3D Smooth Curve Tube for Comparison Pipeline
  const compTubeGeometry = useMemo(() => {
    if (compPoints.length < 2) return null;
    const v3Points = compPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(v3Points, false, "catmullrom", 0.3);
    return new THREE.TubeGeometry(curve, 128, 0.28, 16, false);
  }, [compPoints]);

  const handleMarkerClick = (evt: PipelineEvent3D) => {
    setSelectedEvt(evt);
    if (onSelectEvent) onSelectEvent(evt);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* TOP STATUS BAR & LEGEND */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <Badge className="bg-slate-900/90 border border-slate-700 text-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
          <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span>3D PIPELINE SPATIAL TRAJECTORY</span>
        </Badge>

        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-300">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Primary Pipe</span>
          {showComparison && (
            <span className="flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> {comparisonLabel}</span>
          )}
          <span className="flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span> Anomaly</span>
          <span className="flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Anode</span>
        </div>
      </div>

      {/* THREE.JS CANVAS */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, 60]} fov={50} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2 + 0.1}
          minDistance={5}
          maxDistance={120}
          target={center}
        />

        {/* LIGHTING & UNDERWATER FOG */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 40, 20]} intensity={1.2} castShadow />
        <directionalLight position={[-20, 20, -20]} intensity={0.5} color="#38bdf8" />
        <fog attach="fog" args={["#020617", 40, 140]} />

        {/* SEMI-TRANSPARENT MUDLINE SEABED PLANE */}
        <group position={[0, -16, 0]}>
          <Grid
            args={[160, 160]}
            cellSize={4}
            cellThickness={1}
            cellColor="#1e293b"
            sectionSize={16}
            sectionThickness={1.5}
            sectionColor="#3b82f6"
            fadeDistance={100}
            fadeStrength={1}
          />
          {/* Mud Texture Surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[160, 160]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.6} roughness={0.9} />
          </mesh>
        </group>

        {/* START & END PLATFORM TOWERS */}
        {primaryPoints.length > 0 && (
          <>
            <PlatformTower
              position={primaryPoints[0]}
              label={startPlatformName}
              color="#2563eb"
            />
            <PlatformTower
              position={primaryPoints[primaryPoints.length - 1]}
              label={endPlatformName}
              color="#0284c7"
            />
          </>
        )}

        {/* PRIMARY PIPELINE TUBE */}
        {primaryTubeGeometry && (
          <mesh geometry={primaryTubeGeometry} castShadow receiveShadow>
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.7}
              roughness={0.2}
              emissive="#b45309"
              emissiveIntensity={0.2}
            />
          </mesh>
        )}

        {/* COMPARISON PIPELINE TUBE */}
        {showComparison && compTubeGeometry && (
          <mesh geometry={compTubeGeometry}>
            <meshStandardMaterial
              color="#38bdf8"
              metalness={0.8}
              roughness={0.2}
              transparent
              opacity={0.7}
            />
          </mesh>
        )}

        {/* PRIMARY EVENT MARKERS */}
        {primaryEvts.map(({ evt, pos }) => (
          <EventMarker
            key={evt.id}
            evt={evt}
            position={pos}
            isSelected={selectedEventId === evt.id || selectedEvt?.id === evt.id}
            onClick={() => handleMarkerClick(evt)}
          />
        ))}

        {/* COMPARISON EVENT MARKERS */}
        {showComparison &&
          compEvts.map(({ evt, pos }) => (
            <EventMarker
              key={`comp-${evt.id}`}
              evt={{ ...evt, eventName: `${evt.eventName || ""} (${comparisonLabel})` }}
              position={pos}
              isSelected={selectedEventId === evt.id}
              onClick={() => handleMarkerClick(evt)}
            />
          ))}

        <ContactShadows position={[0, -16.1, 0]} opacity={0.4} scale={100} blur={2} far={20} />
      </Canvas>

      {/* INTERACTIVE 3D GLASSMORPHISM EVENT POPUP OVERLAY */}
      {selectedEvt && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[380px] z-30 bg-slate-900/95 backdrop-blur-xl border-2 border-indigo-500/60 rounded-2xl p-4 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  {selectedEvt.eventName || selectedEvt.eventType}
                  <Badge
                    variant={selectedEvt.isAnomaly ? "destructive" : "secondary"}
                    className="text-[8px] font-black px-1.5 py-0 uppercase"
                  >
                    {selectedEvt.isAnomaly ? "ANOMALY" : "INSPECTION EVENT"}
                  </Badge>
                </h4>
                <span className="text-[9.5px] font-mono text-slate-400">
                  KP {selectedEvt.kp.toFixed(4)} • Depth: -{Math.abs(selectedEvt.depth).toFixed(1)}m
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedEvt(null)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-[10.5px]">
            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono">
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Easting (X)</span>
                <span className="font-bold text-cyan-400">{selectedEvt.easting.toFixed(2)} m</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Northing (Y)</span>
                <span className="font-bold text-cyan-400">{selectedEvt.northing.toFixed(2)} m</span>
              </div>
            </div>

            {/* Telemetry Details */}
            <div className="flex items-center gap-2">
              {selectedEvt.cpValue && (
                <div className="flex-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">CP Potential</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">{selectedEvt.cpValue} mV</span>
                </div>
              )}
              {selectedEvt.anodeDepletion && (
                <div className="flex-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">Depletion Rate</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">{selectedEvt.anodeDepletion}</span>
                </div>
              )}
            </div>

            {/* Findings & Summary */}
            {selectedEvt.findings && (
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Findings Summary:</span>
                <p className="text-slate-300 italic leading-relaxed">{selectedEvt.findings}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
