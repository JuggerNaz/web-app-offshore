"use client";
import * as THREE from 'three';
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from "react";
import { Fender } from "./Fender";
import { RiserGuard } from "./RiserGuard";
import { CaissonSupport } from "./CaissonSupport";
import { RiserClamp } from "./RiserClamp";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    OrbitControls,
    PerspectiveCamera,
    Grid,
    Html,
    ContactShadows,
    Edges,
    Outlines,
    Bounds,
    useBounds,
    Float,
    useHelper,
} from "@react-three/drei";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Box, Radio, Compass, RefreshCw, Maximize2, Search, ChevronRight, Eye, SlidersHorizontal, Layers, Palette, Filter, History } from "lucide-react";
import { getEffectiveClockAngle, computeRiserOffsetEndpoints, generatePlatform3DCoordinates } from "@/utils/platform-3d-math";
import { getMainLegElementSets } from "../platform-legs-recognition";

interface Component3D {
    id: number;
    comp_id?: number;
    q_id: string;
    code: string | null;
    metadata: any;
}

export type VisualizationMode =
    | "DEFAULT"
    | "ANOMALY_PRIORITY"
    | "FINDING_CATEGORY"
    | "PENDING_TASK"
    | "INCOMPLETE_RECORD"
    | "RECTIFIED_ANOMALY"
    | "INSPECTION_TASK_TYPE"
    | "HISTORICAL_COMPARE";

interface Structural3DViewerProps {
    webapp3dData?: any;
    components: Component3D[];
    platformDetails?: any;
    elevations?: any[];
    faces?: any[];
    selectedCompId?: number;
    onSelectComponent: (component: Component3D) => void;
    onSync?: () => void;
    isSyncing?: boolean;
    useWincairsMode?: boolean;
    wincairsParams?: any[];
    onFallbackComponentsChange?: (fallbackComps: Component3D[]) => void;
    compactMode?: boolean;
    isInspectionWorkspace?: boolean;

    currentRecords?: any[];
    historicalRecords?: any[];
    activeColorMode?: VisualizationMode;
    selectedHistoricalCampaignId?: string | number;
}

function parseRiserClampInfo(qId: string) {
    if (!qId) return null;
    const clean = qId.toUpperCase().trim();

    // Matches formats like: RIS-7-SUPP-20M, RIS-X-SUPP 6M, RIS-2-SUPP-+3M
    const match = clean.match(/RIS[-_]?([A-Z0-9]+)[-_]?(?:SUPP|CLP|CLAMP)[-_ ]*(\+|-)?\s*(\d+(?:\.\d+)?)M?/i);
    if (!match) return null;

    const riserNum = match[1];
    const explicitSign = match[2];
    const rawElv = parseFloat(match[3]);

    if (isNaN(rawElv)) return null;

    let targetY = rawElv;
    if (explicitSign === "+") {
        targetY = rawElv;
    } else if (explicitSign === "-") {
        targetY = -rawElv;
    } else {
        const isSpacePositive = /SUPP\s+\d+/i.test(clean) || /CLP\s+\d+/i.test(clean);
        targetY = isSpacePositive ? rawElv : -rawElv;
    }

    return { riserNum, targetY };
}

const ComponentMesh = ({
    component,
    isSelected,
    onClick,
    onDoubleClick,
    start,
    end,
    thickness = 0.3,
    showWeldNumbering = true,
    isInspectionMode = false,
    inspectionStatus = "NOT_INSPECTED",
    isStatusChecked = true,
    inspectionColor,
    allLayouts = [],
}: {
    component: Component3D;
    isSelected: boolean;
    onClick: () => void;
    onDoubleClick?: () => void;
    start: [number, number, number];
    end: [number, number, number];
    thickness?: number;
    showWeldNumbering?: boolean;
    isInspectionMode?: boolean;
    inspectionStatus?: "NOT_INSPECTED" | "NO_ANOMALY" | "HAS_ANOMALY";
    isStatusChecked?: boolean;
    inspectionColor?: string;
    allLayouts?: any[];
}) => {
    const [hovered, setHovered] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const code = (component?.code || "").toUpperCase();
    const qIdUpper = (component?.q_id || "").toUpperCase();
    const isNode = (code.includes("NODE") || qIdUpper.includes("NODE") || code === "ND") && !qIdUpper.includes("SUPP") && !qIdUpper.includes("CLP");
    const isAnode = code === "AN" || code.includes("ANOD");
    const isCaissonSupportComponent = (code === "WP" || code === "CL" || qIdUpper.includes("SUPP") || qIdUpper.includes("CLP")) && (qIdUpper.includes("CS-") || qIdUpper.includes("CAIS"));
    const isRiserSupport = (qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL" || code === "RC" || code.includes("CLAM")) && !isCaissonSupportComponent;
    const isClamp = (code === "CL" || code === "RC" || code.includes("CLAM") || isRiserSupport) && !isCaissonSupportComponent;
    const isWeld = (code === "WN" || (code === "WP" && !isRiserSupport) || code.includes("WELD")) && !isClamp;
    const isCaisson = code === "CS" || code === "CA" || code.includes("CAIS");
    const isRiser = !isAnode && !isRiserSupport && !isCaisson && (
        code === "RS" ||
        code.includes("RISER") || code.includes("RISR") ||
        qIdUpper.includes("RISER") || qIdUpper.includes("RISR") ||
        /^R\d+[-_]/i.test(qIdUpper) ||
        (qIdUpper.startsWith("R") && !qIdUpper.startsWith("RIS-") && !qIdUpper.startsWith("ROW"))
    );
    const isConductor = code === "CD" || isCaisson || code.includes("COND") || code === "CO";

    const defaultMeshColor = isAnode
        ? "#F8FAFC"
        : isWeld
            ? "#cbd5e1"
            : isClamp
                ? "#f97316"
                : isRiser
                    ? "#334155"
                    : isConductor
                        ? "#475569"
                        : "#cbd5e1";

    const isInspectionHighlighted = isInspectionMode && isStatusChecked;

    const displayColor = isSelected
        ? "#2563eb"
        : hovered
            ? "#60a5fa"
            : isInspectionHighlighted
                ? (inspectionStatus === "HAS_ANOMALY"
                    ? "#ef4444"
                    : inspectionStatus === "NO_ANOMALY"
                        ? "#10b981"
                        : "#94a3b8")
                : defaultMeshColor;

    const emissiveColor = isSelected
        ? "#1d4ed8"
        : (isInspectionHighlighted && inspectionStatus === "HAS_ANOMALY")
            ? "#ef4444"
            : isWeld
                ? "#000000"
                : isClamp
                    ? "#ea580c"
                    : "#000000";

    const emissiveInt = isSelected
        ? 0.7
        : (isInspectionHighlighted && inspectionStatus === "HAS_ANOMALY")
            ? 0.5
            : isWeld
                ? 0
                : isClamp
                    ? 0.3
                    : 0;

    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    let baseThickness = thickness;
    if (isNaN(baseThickness) || baseThickness === null || baseThickness === undefined) {
        baseThickness = 0.3;
    }

    let length = startVec.distanceTo(endVec);
    let position = startVec.clone().add(endVec).multiplyScalar(0.5);
    let direction = endVec.clone().sub(startVec).normalize();

    const md = component?.metadata || component || {};
    const compAny = component as any;

    if (isRiser) {
        const { offsetStart, offsetEnd } = computeRiserOffsetEndpoints(startVec, endVec, 0.75, 0.08, md);
        position = offsetStart.clone().add(offsetEnd).multiplyScalar(0.5);
        direction = offsetEnd.clone().sub(offsetStart).normalize();
        length = offsetStart.distanceTo(offsetEnd);
    }
    const sLegStr = (compAny?.s_leg || md.s_leg || "").toString().trim().toUpperCase();
    const fLegStr = (compAny?.f_leg || md.f_leg || "").toString().trim().toUpperCase();
    const isLegComponent = code.includes("LG") || qIdUpper.includes("LEG") || (sLegStr && sLegStr !== "N/A") || (fLegStr && fLegStr !== "N/A");
    const isLegMember = !isAnode && !isWeld && !isClamp && isLegComponent;
    const isMainLegWeld = isWeld && isLegComponent;

    if (isAnode) baseThickness = 0.15;
    else if (isClamp) baseThickness = baseThickness * 1.8;
    else if (isWeld) baseThickness = baseThickness + 0.04;
    const meshLength = isAnode ? 0.8 : isClamp ? 0.8 : isWeld ? 0.55 : length;

    const safeMeshLength = Math.max(meshLength, 0.01);

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    const showLabel = hovered || isSelected || (isWeld && showWeldNumbering);

    let labelText = component.q_id;
    if (isWeld) {
        labelText = component.q_id.replace(/^(?:WN\s*N?|N\s*)/i, "").trim() || component.q_id;
    }

    const rawClockPos = md.clk_pos ?? md.clockPosition;
    let clockPos: number;
    if (isAnode && (rawClockPos === undefined || rawClockPos === null || rawClockPos === "" || rawClockPos === "N/A")) {
        clockPos = 12;
    } else {
        clockPos = parseFloat(rawClockPos || "12");
        if (isNaN(clockPos)) clockPos = 12;
    }
    const angle = getEffectiveClockAngle(clockPos);
    const memberRadius = baseThickness < 0.2 ? 0.25 : baseThickness;
    const offsetDistance = memberRadius + 0.15;

    let ox = 0;
    let oy = 0;
    let oz = 0;
    let anodeRotY = 0;

    if (isAnode) {
        // Calculate compass-style rotation vector around Global Y-axis for horizontal members or member direction for vertical members
        const rotAxis = Math.abs(direction.y) > 0.8 ? direction : new THREE.Vector3(0, 1, 0);
        let refVec = new THREE.Vector3(1, 0, 0);
        if (Math.abs(direction.y) > 0.8) {
            refVec = new THREE.Vector3(0, 0, -1);
            refVec.sub(direction.clone().multiplyScalar(refVec.dot(direction))).normalize();
        }
        
        const globalOffset = refVec
            .clone()
            .applyAxisAngle(rotAxis, -angle)
            .multiplyScalar(offsetDistance);

        // Convert the global offset back to local coordinates of the parent rotated group
        const localOffset = globalOffset.clone().applyQuaternion(quaternion.clone().invert());
        ox = localOffset.x;
        oy = localOffset.y;
        oz = localOffset.z;

        // Tangent rotation angle for anode group orientation
        anodeRotY = Math.atan2(ox, oz);
    } 
    
    let riserThickness = baseThickness;
    if (isClamp) {
        direction = new THREE.Vector3(0, 1, 0);

        const clampInfo = parseRiserClampInfo(component?.q_id || "");
        
        let targetRiser = null;
        if (allLayouts && allLayouts.length > 0) {
            const compAnyObj = component as any;
            const assocIdVal = md?.associated_comp_id || compAnyObj?.associated_component_id || compAnyObj?.associated_id;
            if (assocIdVal) {
                targetRiser = allLayouts.find((l: any) => l.component?.id === assocIdVal || l.id === assocIdVal);
            }
            if (!targetRiser && clampInfo) {
                targetRiser = allLayouts.find((l: any) => {
                    const q = (l.component?.q_id || l.q_id || l.id || "").toString().toUpperCase();
                    const lCode = (l.component?.code || l.code || "").toString().toUpperCase();
                    const isRiserComp = lCode === "RS" || lCode.includes("RISER") || lCode.includes("RISR") || q.includes("RISER") || q.includes("RIS-") || /^R\d+[-_]/i.test(q);
                    if (!isRiserComp) return false;

                    return (
                        q.startsWith(`R${clampInfo.riserNum}-`) ||
                        q.startsWith(`R${clampInfo.riserNum}_`) ||
                        q.includes(`R${clampInfo.riserNum}-`) ||
                        q.includes(`R${clampInfo.riserNum}_`) ||
                        q.includes(`RISER-${clampInfo.riserNum}`) ||
                        q.includes(`RISER ${clampInfo.riserNum}`) ||
                        q.includes(`RIS-${clampInfo.riserNum}`) ||
                        q.includes(`RIS_${clampInfo.riserNum}`) ||
                        q === `R${clampInfo.riserNum}` ||
                        q === `RISER${clampInfo.riserNum}` ||
                        q === `RIS-${clampInfo.riserNum}`
                    );
                });
            }

            if (targetRiser) {
                const rStart = new THREE.Vector3(...(targetRiser.start || targetRiser.position || [0, 0, 0]));
                const rEnd = new THREE.Vector3(...(targetRiser.end || targetRiser.position || rStart));
                const targetMd = targetRiser.component?.metadata || targetRiser.metadata || targetRiser;
                const { offsetStart, offsetEnd } = computeRiserOffsetEndpoints(rStart, rEnd, 0.75, 0.08, targetMd);

                const targetY = clampInfo ? clampInfo.targetY : position.y;
                const t = Math.max(0, Math.min(1, (targetY - offsetStart.y) / (offsetEnd.y - offsetStart.y || 1)));
                position = offsetStart.clone().lerp(offsetEnd, t);
                
                if (offsetEnd.distanceTo(offsetStart) > 0.001) {
                    direction = offsetEnd.clone().sub(offsetStart).normalize();
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
                    euler.setFromQuaternion(quaternion);
                }
                
                riserThickness = targetRiser.thickness || targetRiser.component?.metadata?.thickness || baseThickness;
            }
        }
    }

    if (isNaN(ox)) ox = 0;
    if (isNaN(oy)) oy = 0;
    if (isNaN(oz)) oz = 0;

    const offsetPos: [number, number, number] = (isAnode || isRiser || isClamp) ? [ox, oy, oz] : [0, 0, 0];

    const riserBendGeometry = useMemo(() => {
        if (!isRiser || isCaisson) return null;

        // Bottom of the cylinder in local space (when direction points downward) is at +safeMeshLength / 2 (seabed/mudline)
        const bottomLocalY = safeMeshLength / 2;
        const bottomYDir = 1;

        // Calculate global outward face normal vector
        const { offsetStart, offsetEnd, outwardDir } = computeRiserOffsetEndpoints(startVec, endVec, 0.75, 0.08, md);

        const globalOutward = outwardDir ? outwardDir.clone() : new THREE.Vector3(0, 0, 1);
        if (globalOutward.lengthSq() < 0.001) globalOutward.set(0, 0, 1);

        // Convert global outward direction to local coordinates of the component group
        const localOutward = globalOutward.applyQuaternion(quaternion.clone().invert()).normalize();

        const bendRadius = 0.8;
        const spoolLength = 1.8;

        // Smooth 90-degree protruding J-tube elbow curve extending outward along the seabed
        const p0 = new THREE.Vector3(0, bottomLocalY, 0);
        const p1 = p0.clone().add(new THREE.Vector3(0, bottomYDir * bendRadius * 0.35, 0)).add(localOutward.clone().multiplyScalar(bendRadius * 0.25));
        const p2 = p0.clone().add(new THREE.Vector3(0, bottomYDir * bendRadius * 0.85, 0)).add(localOutward.clone().multiplyScalar(bendRadius * 0.85));
        const p3 = p0.clone().add(new THREE.Vector3(0, bottomYDir * bendRadius, 0)).add(localOutward.clone().multiplyScalar(bendRadius + spoolLength));

        const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
        return new THREE.TubeGeometry(curve, 24, baseThickness / 2, 16, false);
    }, [isRiser, isCaisson, startVec, endVec, safeMeshLength, baseThickness, quaternion]);

    const hasNaN = [
        startVec.x,
        startVec.y,
        startVec.z,
        endVec.x,
        endVec.y,
        endVec.z,
        offsetPos[0],
        offsetPos[1],
        offsetPos[2],
    ].some((v) => !isFinite(v));

    if (hasNaN) return null;

    const isFender =
        code === "FD" ||
        code === "BL" ||
        code === "BLD" ||
        code.includes("FEND") ||
        code.includes("BOAT") ||
        code.includes("LAND") ||
        qIdUpper.includes("BOAT") ||
        qIdUpper.includes("LANDING") ||
        qIdUpper.includes("FEND") ||
        qIdUpper.includes("FENDER") ||
        qIdUpper.startsWith("BL") ||
        qIdUpper.startsWith("BLD");
    if (isFender) {
        const md = component.metadata || {};
        let clockPos = parseFloat(md.clk_pos || "12");
        if (isNaN(clockPos)) clockPos = 12;
        const yawAngle = getEffectiveClockAngle(clockPos);

        const fenderDepth = 1.0;
        // Increase horizontal offset distance by adding a 1.2m buffer (makes default 2.4m)
        const fenderDist = parseFloat(md.dist || "1.2") + 1.2;
        const offsetDistance = fenderDist + fenderDepth / 2;
        const offset = new THREE.Vector3(
            Math.sin(yawAngle) * offsetDistance,
            0,
            Math.cos(yawAngle) * offsetDistance
        );

        const legMidpoint = startVec.clone().add(endVec).multiplyScalar(0.5);

        // Detect if offset vector points inwards (towards the center of the platform at 0,0,0)
        // If so, negate the offset vector and adjust rotation to ensure it renders on the exterior (blue spot)
        const radialVec = new THREE.Vector3(legMidpoint.x, 0, legMidpoint.z);
        let finalOffset = offset.clone();
        let finalGroupRotationAngle = yawAngle; // default: unflipped

        if (offset.dot(radialVec) < 0) {
            finalOffset.negate();
            finalGroupRotationAngle += Math.PI;
        }

        const fenderHeight = Math.abs(endVec.y - startVec.y) > 1.0 ? Math.abs(endVec.y - startVec.y) : 6.0;
        const spanWidth = new THREE.Vector2(startVec.x, startVec.z).distanceTo(new THREE.Vector2(endVec.x, endVec.z));
        const yTop = Math.max(startVec.y, endVec.y);

        // Lower the fender center so that the Upper Platform (H/6) is exactly at yTop
        const fenderCenter = legMidpoint.clone().add(finalOffset);
        fenderCenter.y = yTop - fenderHeight / 6;

        // Compute leg node coordinates in fender local space
        const leg1Top = new THREE.Vector3(startVec.x, yTop, startVec.z);
        const leg2Top = new THREE.Vector3(endVec.x, yTop, endVec.z);

        const loc1Top = leg1Top.clone().sub(fenderCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);
        const loc2Top = leg2Top.clone().sub(fenderCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);

        let localLeftTop: THREE.Vector3;
        let localRightTop: THREE.Vector3;

        if (loc1Top.x < loc2Top.x) {
            localLeftTop = loc1Top;
            localRightTop = loc2Top;
        } else {
            localLeftTop = loc2Top;
            localRightTop = loc1Top;
        }

        const fenderGroup = useMemo(() => {
            return new Fender({
                height: fenderHeight,
                widthBack: spanWidth,
                widthFront: spanWidth * 0.7,
                color: "#DDDADA",
                isSelected,
                isHovered: hovered,
                localLeftTop,
                localRightTop,
            });
        }, [
            fenderHeight,
            spanWidth,
            isSelected,
            hovered,
            localLeftTop.x, localLeftTop.y, localLeftTop.z,
            localRightTop.x, localRightTop.y, localRightTop.z
        ]);

        return (
            <group
                position={[fenderCenter.x, fenderCenter.y, fenderCenter.z]}
                rotation={[0, finalGroupRotationAngle, 0]}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onDoubleClick) onDoubleClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
            >
                <primitive object={fenderGroup} />

                {/* Large click/hover target wrapper for Fender cage */}
                <mesh castShadow={false} receiveShadow={false}>
                    <boxGeometry args={[spanWidth + 0.4, fenderHeight, 1.0]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, fenderHeight / 2 + 0.5, 0]}
                        center
                        zIndexRange={[10, 0]}
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                : "bg-white/90 text-blue-900 border-blue-200"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        );
    }

    const isRiserGuard = code === "RG";
    if (isRiserGuard) {
        const md = component.metadata || {};
        const guardDepth = 0.2;
        // Horizontal offset distance from the leg midpoint (default: 1.8m + depth/2)
        // Add a 1.0m buffer (makes default 2.8m) to push it forward
        const guardDist = parseFloat(md.dist || "1.8") + 2.0;
        const offsetDistance = guardDist + guardDepth / 2;

        const legMidpoint = startVec.clone().add(endVec).multiplyScalar(0.5);

        // 1. Calculate span direction vector horizontally (along XZ plane)
        const spanDir = new THREE.Vector3(
            endVec.x - startVec.x,
            0,
            endVec.z - startVec.z
        ).normalize();

        // 2. Compute the two horizontal normals perpendicular to the span
        const normal1 = new THREE.Vector3(-spanDir.z, 0, spanDir.x);
        const normal2 = new THREE.Vector3(spanDir.z, 0, -spanDir.x);

        // 3. Choose the normal pointing outwards from the platform center (0, 0, 0)
        const radialVec = new THREE.Vector3(legMidpoint.x, 0, legMidpoint.z);
        const outwardNormal = normal1.dot(radialVec) >= 0 ? normal1 : normal2;

        // 4. Calculate offset along this outward normal (so it never goes inside)
        const finalOffset = outwardNormal.clone().multiplyScalar(offsetDistance);

        // 5. The group rotation must align local Z with outwardNormal
        // This ensures the local X axis aligns parallel to the leg span
        const finalGroupRotationAngle = Math.atan2(outwardNormal.x, outwardNormal.z);

        const spanWidth = new THREE.Vector2(startVec.x, startVec.z).distanceTo(new THREE.Vector2(endVec.x, endVec.z));
        // Clamp height between 3.0m and 5.0m based on width to keep proportions realistic
        const guardHeight = Math.max(3.0, Math.min(5.0, spanWidth / 2));
        const yTop = Math.max(startVec.y, endVec.y);

        // Position riser guard center vertically so that the top rail (at H/2) aligns with yTop
        const guardCenter = legMidpoint.clone().add(finalOffset);
        guardCenter.y = yTop - guardHeight / 2;

        // Compute leg coordinates at top and middle elevations
        const leg1Top = new THREE.Vector3(startVec.x, yTop, startVec.z);
        const leg2Top = new THREE.Vector3(endVec.x, yTop, endVec.z);
        const leg1Mid = new THREE.Vector3(startVec.x, guardCenter.y + guardHeight / 6, startVec.z);
        const leg2Mid = new THREE.Vector3(endVec.x, guardCenter.y + guardHeight / 6, endVec.z);

        // Convert coordinates to riser guard local space
        const loc1Top = leg1Top.clone().sub(guardCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);
        const loc2Top = leg2Top.clone().sub(guardCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);
        const loc1Mid = leg1Mid.clone().sub(guardCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);
        const loc2Mid = leg2Mid.clone().sub(guardCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -finalGroupRotationAngle);

        // Determine left vs right legs horizontally in local space
        let localLeftTop: THREE.Vector3;
        let localRightTop: THREE.Vector3;
        let localLeftMid: THREE.Vector3;
        let localRightMid: THREE.Vector3;

        if (loc1Top.x < loc2Top.x) {
            localLeftTop = loc1Top;
            localRightTop = loc2Top;
            localLeftMid = loc1Mid;
            localRightMid = loc2Mid;
        } else {
            localLeftTop = loc2Top;
            localRightTop = loc1Top;
            localLeftMid = loc2Mid;
            localRightMid = loc1Mid;
        }

        const riserGuardGroup = useMemo(() => {
            return new RiserGuard({
                height: guardHeight,
                width: spanWidth,
                color: "#DDDADA",
                isSelected,
                isHovered: hovered,
                localLeftTop,
                localRightTop,
                localLeftMid,
                localRightMid,
            });
        }, [
            guardHeight,
            spanWidth,
            isSelected,
            hovered,
            localLeftTop.x, localLeftTop.y, localLeftTop.z,
            localRightTop.x, localRightTop.y, localRightTop.z,
            localLeftMid.x, localLeftMid.y, localLeftMid.z,
            localRightMid.x, localRightMid.y, localRightMid.z
        ]);

        return (
            <group
                position={[guardCenter.x, guardCenter.y, guardCenter.z]}
                rotation={[0, finalGroupRotationAngle, 0]}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onDoubleClick) onDoubleClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
            >
                <primitive object={riserGuardGroup} />

                {/* Click target wrapper for RiserGuard panel */}
                <mesh castShadow={false} receiveShadow={false}>
                    <boxGeometry args={[spanWidth + 0.4, guardHeight, 0.4]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, guardHeight / 2 + 0.5, 0]}
                        center
                        zIndexRange={[10, 0]}
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                : "bg-white/90 text-blue-900 border-blue-200"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        );
    }

    if (isCaissonSupportComponent) {
        const caissonSupportGroup = useMemo(() => {
            let supportColor = "#facc15";
            if (isInspectionHighlighted) {
                if (inspectionStatus === "HAS_ANOMALY") supportColor = "#ef4444";
                else if (inspectionStatus === "NO_ANOMALY") supportColor = "#10b981";
                else supportColor = "#94a3b8";
            }
            return new CaissonSupport({
                outerRadius: (baseThickness || 0.3) / 2 + 0.04,
                height: 0.35,
                lugProtrusion: 0.16,
                lugWidth: 0.14,
                lugHeight: 0.28,
                color: supportColor,
                isSelected,
                isHovered: hovered,
            });
        }, [baseThickness, isSelected, hovered, isInspectionHighlighted, inspectionStatus]);

        return (
            <group
                position={[position.x + ox, position.y + oy, position.z + oz]}
                rotation={euler}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onDoubleClick) onDoubleClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
            >
                <primitive object={caissonSupportGroup} />

                {/* Click target wrapper */}
                <mesh castShadow={false} receiveShadow={false}>
                    <boxGeometry args={[(baseThickness || 0.3) + 0.8, 0.7, (baseThickness || 0.3) + 0.8]} />
                    <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
                </mesh>

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, 0.6, 0]}
                        center
                        zIndexRange={[10, 0]}
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                : "bg-slate-900/90 text-slate-100 border-slate-700"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        );
    }

    if (isClamp) {
        const riserClampGroup = useMemo(() => {
            let supportColor = "#facc15";
            if (isInspectionHighlighted) {
                if (inspectionStatus === "HAS_ANOMALY") supportColor = "#ef4444";
                else if (inspectionStatus === "NO_ANOMALY") supportColor = "#10b981";
                else supportColor = "#94a3b8";
            }
            return new RiserClamp({
                outerRadius: (riserThickness || 0.3) / 2 + 0.06,
                height: 0.7,
                flangeWidth: 0.22,
                flangeThickness: 0.05,
                color: supportColor,
                isSelected,
                isHovered: hovered,
            });
        }, [riserThickness, isSelected, hovered, isInspectionHighlighted, inspectionStatus]);

        return (
            <group
                position={[position.x + ox, position.y + oy, position.z + oz]}
                rotation={euler}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onDoubleClick) onDoubleClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
            >
                <primitive object={riserClampGroup} />
                
                {/* Click target wrapper */}
                <mesh castShadow={false} receiveShadow={false}>
                    <boxGeometry args={[(baseThickness || 0.3) + 1.0, 1.2, (baseThickness || 0.3) + 1.0]} />
                    <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
                </mesh>

                {showLabel && (
                    <Html distanceFactor={15} position={[0, 0.5, 0]} center zIndexRange={[10, 0]}>
                        <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)]" : "bg-slate-900/90 text-slate-100 border-slate-700"}`}>
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        );
    }

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            <group
                position={offsetPos as [number, number, number]}
                rotation={isAnode ? [0, anodeRotY, 0] : [0, 0, 0]}
            >
                <mesh
                    castShadow
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (onDoubleClick) onDoubleClick();
                    }}
                >
                    {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                        <sphereGeometry args={[Math.max(baseThickness / 2, 0.01), 16, 16]} />
                    ) : isAnode ? (
                        <boxGeometry args={[0.2, safeMeshLength, 0.2]} />
                    ) : isWeld ? (
                        <cylinderGeometry args={[baseThickness / 2, baseThickness / 2, safeMeshLength, 32]} />
                    ) : (
                        <cylinderGeometry args={[baseThickness / 2, baseThickness / 2, safeMeshLength, 16]} />
                    )}
                    <meshStandardMaterial
                        color={displayColor}
                        metalness={isAnode ? 0.85 : isWeld ? 0.2 : isClamp ? 0.8 : isRiser || isConductor ? 0.75 : 0.7}
                        roughness={isAnode ? 0.25 : isWeld ? 0.5 : isClamp ? 0.25 : isRiser || isConductor ? 0.45 : 0.3}
                        emissive={emissiveColor}
                        emissiveIntensity={emissiveInt}
                    />
                    {(!isAnode && !isWeld) && (
                        <Edges
                            threshold={20}
                            color="#0f172a"
                            opacity={0.35}
                            transparent
                        />
                    )}
                    {isRiser && riserBendGeometry && (
                        <mesh geometry={riserBendGeometry} castShadow receiveShadow>
                            <meshStandardMaterial
                                color={displayColor}
                                metalness={0.75}
                                roughness={0.45}
                                emissive={emissiveColor}
                                emissiveIntensity={emissiveInt}
                            />
                        </mesh>
                    )}
                    {isAnode && (
                        <group>
                            { }
                            <mesh position={[0, safeMeshLength / 2 + 0.1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[0.025, 0.025, 0.2, 12]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                            </mesh>
                            <mesh
                                position={[0, safeMeshLength / 2 + 0.18, -offsetDistance / 2]}
                                rotation={[Math.PI / 2, 0, 0]}
                                castShadow
                                receiveShadow
                            >
                                <cylinderGeometry args={[0.025, 0.025, offsetDistance, 12]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                            </mesh>
                            { }
                            <mesh position={[0, -safeMeshLength / 2 - 0.1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[0.025, 0.025, 0.2, 12]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                            </mesh>
                            <mesh
                                position={[0, -safeMeshLength / 2 - 0.18, -offsetDistance / 2]}
                                rotation={[Math.PI / 2, 0, 0]}
                                castShadow
                                receiveShadow
                            >
                                <cylinderGeometry args={[0.025, 0.025, offsetDistance, 12]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                            </mesh>
                        </group>
                    )}
                </mesh>

                { }
                <mesh
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        setHovered(true);
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation();
                        setHovered(false);
                    }}
                >
                    {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                        <sphereGeometry args={[Math.max(thickness * 2, 0.01), 8, 8]} />
                    ) : isAnode ? (
                        <boxGeometry args={[0.5, safeMeshLength + 0.2, 0.5]} />
                    ) : (
                        <cylinderGeometry
                            args={[
                                baseThickness + 0.3,
                                baseThickness + 0.3,
                                Math.max(isWeld ? safeMeshLength + 0.5 : length + 0.5, 0.01),
                                6,
                            ]}
                        />
                    )}
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>

                {showLabel && !isWeld && (
                    <Html
                        distanceFactor={15}
                        position={[0, (isAnode ? safeMeshLength : length) / 2 + 0.5, 0]}
                        center
                        zIndexRange={[10, 0]}
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100"
                                : "bg-white/90 text-blue-900 border-blue-200"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        </group>
    );
};

const FoundationMember = ({
    start,
    end,
    thickness,
    color,
    label,
    showLabel = true,
    renderMesh = true,
    activeElevations = [],
}: {
    start: [number, number, number];
    end: [number, number, number];
    thickness: number;
    color: string;
    label?: string;
    showLabel?: boolean;
    renderMesh?: boolean;
    activeElevations?: number[];
}) => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    // Skip if any coordinate is NaN/Infinite
    const hasNaN = [startVec.x, startVec.y, startVec.z, endVec.x, endVec.y, endVec.z].some(
        (v) => !isFinite(v)
    );
    if (hasNaN) return null;

    const length = startVec.distanceTo(endVec);
    const safeLength = Math.max(length, 0.01);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    // Calculate leg corner node coordinates for ALL active selected elevations
    const tagCornerPositions = useMemo(() => {
        if (!showLabel || !label || activeElevations.length === 0 || Math.abs(endVec.y - startVec.y) <= 0.01) {
            return [];
        }
        return activeElevations.map((elv) => {
            const t = (elv - startVec.y) / (endVec.y - startVec.y);
            const legX = startVec.x + (endVec.x - startVec.x) * t;
            const legZ = startVec.z + (endVec.z - startVec.z) * t;

            // Offset outward from platform center so tag sits cleanly outside the structure
            const outwardDir = new THREE.Vector2(legX, legZ);
            if (outwardDir.lengthSq() > 0.01) {
                outwardDir.normalize().multiplyScalar(3.5);
            }
            const tagX = legX + outwardDir.x;
            const tagZ = legZ + outwardDir.y;

            return { elv, pos: [tagX, elv, tagZ] as [number, number, number] };
        });
    }, [showLabel, label, activeElevations, startVec, endVec]);

    return (
        <group>
            <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
                {renderMesh && (
                    <mesh castShadow receiveShadow>
                        <cylinderGeometry args={[thickness, thickness, safeLength, 8]} />
                        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
                    </mesh>
                )}
                {showLabel && label && tagCornerPositions.length === 0 && (
                    <Html distanceFactor={35} position={[0, safeLength / 2 + 1.5, 0]} center zIndexRange={[10, 0]}>
                        <div
                            className="px-5 py-2 bg-slate-900/25 dark:bg-slate-900/30 text-white text-xl font-black rounded-full border border-white/40 dark:border-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] pointer-events-none uppercase tracking-[0.25em] whitespace-nowrap backdrop-blur-xl transition-all"
                            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                        >
                            {label}
                        </div>
                    </Html>
                )}
            </group>

            {/* Anchor leg tags directly on leg corner nodes for ALL active selected elevations */}
            {tagCornerPositions.map(({ elv, pos }) => (
                <Html key={`tag-${label}-${elv}`} distanceFactor={35} position={pos} center zIndexRange={[10, 0]}>
                    <div
                        className="px-5 py-2 bg-slate-900/25 dark:bg-slate-900/30 text-white text-xl font-black rounded-full border border-white/40 dark:border-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] pointer-events-none uppercase tracking-[0.25em] whitespace-nowrap backdrop-blur-xl transition-all"
                        style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                    >
                        {label}
                    </div>
                </Html>
            ))}
        </group>
    );
};

const ElevationLevelPlane = ({
    y,
    label,
    isSelected,
    onToggleSelect,
}: {
    y: number;
    label: string;
    isSelected: boolean;
    onToggleSelect: () => void;
}) => {
    const formattedElv = y >= 0 ? `+${y.toFixed(2)}m` : `${y.toFixed(2)}m`;

    return (
        <group position={[0, y, 0]}>
            {/* Interactive HTML Badge */}
            <Html position={[32, 0, 0]} center distanceFactor={35} zIndexRange={[10, 0]}>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect();
                    }}
                    className={cn(
                        "flex items-center gap-2 cursor-pointer transition-all duration-300 select-none",
                        isSelected ? "scale-110" : "hover:scale-105 opacity-85 hover:opacity-100"
                    )}
                >
                    <div className={cn("h-[2px] w-12 transition-colors", isSelected ? "bg-amber-400" : "bg-sky-400/60")} />
                    <div
                        className={cn(
                            "px-5 py-2 rounded-full backdrop-blur-xl text-xl font-black tracking-[0.25em] uppercase border shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] flex items-center gap-3 transition-all",
                            isSelected
                                ? "bg-amber-950/90 text-amber-300 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                                : "bg-sky-950/80 text-sky-200 border-sky-500/40 hover:border-sky-400"
                        )}
                        style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                    >
                        <span className={cn("w-3 h-3 rounded-full", isSelected ? "bg-amber-400 animate-pulse" : "bg-sky-400")} />
                        <span>EL {formattedElv}</span>
                    </div>
                </div>
            </Html>
        </group>
    );
};

// Component wrapper for bounds grouping
function SelectToZoom({ children }: { children: React.ReactNode }) {
    return (
        <group>
            {children}
        </group>
    );
}

function CameraDistanceController({ onChange }: { onChange: (isClose: boolean) => void }) {
    const { camera } = useThree();
    const lastIsClose = useRef(false);

    useFrame(() => {
        const dist = camera.position.length();
        const isClose = dist < 45;
        if (isClose !== lastIsClose.current) {
            lastIsClose.current = isClose;
            onChange(isClose);
        }
    });

    return null;
}

function ResetViewHandler({ trigger }: { trigger: number }) {
    const api = useBounds();
    const isFirstRun = React.useRef(true);

    React.useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        api.refresh().fit();
    }, [trigger, api]);

    return null;
}





function CameraRig({
    selectedPos,
    isActivated,
    isDirectClickRef,
    focusTargetPos,
}: {
    selectedPos: THREE.Vector3 | null;
    isActivated: boolean;
    isDirectClickRef: React.MutableRefObject<boolean>;
    focusTargetPos: THREE.Vector3 | null;
}) {
    const { camera, controls } = useThree();
    const animRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isActivated || !controls) return;

        const orbControls = controls as any;
        if (focusTargetPos) {
            const startTarget = orbControls.target.clone();
            const endTarget = focusTargetPos.clone();
            const startCamPos = camera.position.clone();

            const offset = startCamPos.clone().sub(startTarget);
            const dist = offset.length();
            const targetDist = Math.min(Math.max(dist, 5), 18);
            if (dist > 0.001) {
                offset.normalize().multiplyScalar(targetDist);
            } else {
                offset.set(12, 8, 12);
            }
            const endCamPos = endTarget.clone().add(offset);

            let startTime = performance.now();
            const duration = 500;

            const animate = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);

                orbControls.target.lerpVectors(startTarget, endTarget, ease);
                camera.position.lerpVectors(startCamPos, endCamPos, ease);
                orbControls.update();

                if (progress < 1) {
                    animRef.current = requestAnimationFrame(animate);
                }
            };

            if (animRef.current) cancelAnimationFrame(animRef.current);
            animRef.current = requestAnimationFrame(animate);
        }
    }, [focusTargetPos, camera, controls, isActivated]);

    useEffect(() => {
        if (!isActivated) return;
        if (isDirectClickRef.current) {
            isDirectClickRef.current = false;
            return;
        }
        if (selectedPos && controls && !focusTargetPos) {
            const target = new THREE.Vector3(selectedPos.x, selectedPos.y, selectedPos.z);
            const offset = new THREE.Vector3(15, 10, 15);
            const cameraPos = target.clone().add(offset);

            (controls as any).target.copy(target);
            camera.position.copy(cameraPos);
            if (typeof (controls as any).update === 'function') {
                (controls as any).update();
            }
        }
    }, [selectedPos, camera, controls, isActivated, isDirectClickRef, focusTargetPos]);

    return null;
}

function InstancedComponentViewer({
    layouts,
    selectedCompId,
    onSelectComponent,
    onDoubleClickComponent,
    isDirectClickRef,
    showWeldNumbering,
    isInspectionMode,
    selectedInspectionFilters,
    colorMode = "DEFAULT",
    currentRecords = [],
    historicalRecords = [],
    selectedCampaignId = "ALL",
    libraryColors = {},
    selectedPriorityFilter = null,
    inspectionModeFilter = "BOTH",
    priorityScope = "BOTH",
    compareWithCurrent = true,
}: {
    layouts: any[];
    selectedCompId?: number;
    onSelectComponent?: (comp: any) => void;
    onDoubleClickComponent?: (comp: any, pos: THREE.Vector3) => void;
    isDirectClickRef: React.MutableRefObject<boolean>;
    showWeldNumbering?: boolean;
    isInspectionMode?: boolean;
    selectedInspectionFilters: string[];
    colorMode?: VisualizationMode;
    currentRecords?: any[];
    historicalRecords?: any[];
    selectedCampaignId?: string | number;
    libraryColors?: Record<string, string>;
    selectedPriorityFilter?: string | null;
    inspectionModeFilter?: "BOTH" | "ROV" | "DIVING";
    priorityScope?: "BOTH" | "ANOMALY" | "FINDING";
    compareWithCurrent?: boolean;
}) {
    const weldRef = useRef<THREE.InstancedMesh>(null);
    const cylinderRef = useRef<THREE.InstancedMesh>(null);
    const sphereRef = useRef<THREE.InstancedMesh>(null);
    const boxRef = useRef<THREE.InstancedMesh>(null);
    const anodeBoxRef = useRef<THREE.InstancedMesh>(null);
    const anodeStubRef = useRef<THREE.InstancedMesh>(null);
    const anodeElbowRef = useRef<THREE.InstancedMesh>(null);

    const [hoveredComp, setHoveredComp] = useState<any | null>(null);

    const { mainMemberIds, mainNodeIds } = useMemo(() => {
        return getMainLegElementSets(layouts);
    }, [layouts]);

    // Group layouts into cylinders, welds, spheres, boxes, and custom procedural components (Fenders & Riser Guards)
    const { cylinders, welds, spheres, boxes, customLayouts, anodes } = useMemo(() => {
        const cyl: any[] = [];
        const wld: any[] = [];
        const sph: any[] = [];
        const box: any[] = [];
        const custom: any[] = [];
        const ands: any[] = [];

        layouts.forEach((layout) => {
            const comp = layout.component || layout.originalComp || { id: layout.id, q_id: layout.q_id, code: layout.code };
            const code = (comp?.code || "").toUpperCase();
            const qIdUpper = (comp?.q_id || "").toUpperCase();

            const isFender =
                code === "FD" ||
                code === "BL" ||
                code === "BLD" ||
                code.includes("FEND") ||
                code.includes("BOAT") ||
                code.includes("LAND") ||
                qIdUpper.includes("BOAT") ||
                qIdUpper.includes("LANDING") ||
                qIdUpper.includes("FEND") ||
                qIdUpper.includes("FENDER") ||
                qIdUpper.startsWith("BL") ||
                qIdUpper.startsWith("BLD");
            const isRiserGuard = code === "RG" || code.includes("RGUARD") || code.includes("RISG");
            const isCaissonSupport = (code === "WP" || code === "CL" || qIdUpper.includes("SUPP") || qIdUpper.includes("CLP")) && (qIdUpper.includes("CS-") || qIdUpper.includes("CAIS"));
            const isRiserSupport = (qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL" || code === "RC" || code.includes("CLAM")) && !isCaissonSupport;
            const isClamp = (code === "CL" || code === "RC" || code.includes("CLAM") || isRiserSupport) && !isCaissonSupport;

            const isRiser = !isRiserSupport && !isCaissonSupport && !isClamp && (
                code === "RS" ||
                code.includes("RISER") || code.includes("RISR") ||
                qIdUpper.includes("RISER") || qIdUpper.includes("RISR") ||
                /^R\d+[-_]/i.test(qIdUpper) ||
                (qIdUpper.startsWith("R") && !qIdUpper.startsWith("RIS-") && !qIdUpper.startsWith("ROW"))
            );

            if (isFender || isRiserGuard || isRiser || isClamp || isCaissonSupport) {
                custom.push({ ...layout, comp, code });
                return;
            }

            const isWeld = (code === "WN" || (code === "WP" && !isRiserSupport) || code.includes("WELD")) && !isClamp;
            const isNode = (code.includes("NODE") || qIdUpper.includes("NODE") || code === "ND") && !isClamp && !isWeld;
            const isAnode = code === "AN" || code.includes("ANOD") || qIdUpper === "AN" || qIdUpper.includes("ANOD") || qIdUpper.startsWith("BAN");

            const item = { ...layout, comp, code, qIdUpper };

            if (isWeld) {
                wld.push(item);
            } else if (isNode) {
                sph.push(item);
            } else if (isAnode) {
                ands.push(item);
            } else if (isClamp) {
                box.push(item);
            } else {
                cyl.push(item);
            }
        });

        return { cylinders: cyl, welds: wld, spheres: sph, boxes: box, customLayouts: custom, anodes: ands };
    }, [layouts]);

    const toVec3 = (v: any): THREE.Vector3 => {
        if (!v) return new THREE.Vector3(0, 0, 0);
        if (v instanceof THREE.Vector3) return v.clone();
        if (Array.isArray(v)) return new THREE.Vector3(Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0);
        if (typeof v === "object") return new THREE.Vector3(Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0);
        return new THREE.Vector3(0, 0, 0);
    };

    // Apply matrices and colors for Cylinders
    useLayoutEffect(() => {
        if (!cylinderRef.current) return;
        const mesh = cylinderRef.current;
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        cylinders.forEach((item, i) => {
            const start = toVec3(item.start || item.position);
            const end = toVec3(item.end || item.position);
            const rawCode = item.code || item.comp?.code || "";
            const code = String(rawCode).toUpperCase();
            const isRiser = code === "RS" || code.includes("RISER") || code.includes("RISR");

            const originalDistance = start.distanceTo(end);
            let len = Math.max(originalDistance, 0.01);
            let pos = start.clone().add(end).multiplyScalar(0.5);
            
            // If distance is too small, fallback to a vertical direction to prevent NaN normalization
            let dir = originalDistance > 0.001 ? end.clone().sub(start).normalize() : new THREE.Vector3(0, 1, 0);

            if (isRiser) {
                const itemMd = item.comp?.metadata || item.comp || item;
                const { offsetStart, offsetEnd } = computeRiserOffsetEndpoints(start, end, 0.75, 0.08, itemMd);
                pos = offsetStart.clone().add(offsetEnd).multiplyScalar(0.5);
                dir = offsetEnd.clone().sub(offsetStart).normalize();
                len = offsetStart.distanceTo(offsetEnd);
            }

            let thickness = item.thickness || 0.3;

            const compIdStr = String(item.comp?.id || item.id);
            const isMainLeg = mainMemberIds.has(compIdStr);
            if (isMainLeg) {
                thickness *= 2.0;
            }

            const meshLen = len;

            const quat = new THREE.Quaternion();
            if (len > 0.001) {
                quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            }

            matrix.compose(pos, quat, new THREE.Vector3(thickness, meshLen, thickness));
            mesh.setMatrixAt(i, matrix);

            const compId = item.comp?.id || item.id;
            const isSelected = selectedCompId === compId;
            const isConductor = code === "CD" || code === "CS" || code.includes("COND") || code === "CO";
            const isPile = code === "PL" || code === "PILE" || (item.comp?.q_id || "").toUpperCase().includes("PILE");

            const baseColor = isSelected
                ? "#2563eb"
                : isPile
                    ? "#475569"
                    : isRiser
                        ? "#334155"
                        : isConductor
                            ? "#475569"
                            : "#cbd5e1";

            const finalColor = getComponentColorByMode(
                item.comp,
                isSelected,
                colorMode,
                currentRecords,
                historicalRecords,
                selectedCampaignId,
                baseColor,
                libraryColors,
                selectedPriorityFilter,
                inspectionModeFilter,
                priorityScope,
                compareWithCurrent
            );

            color.set(finalColor);
            mesh.setColorAt(i, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [cylinders, selectedCompId, mainMemberIds, colorMode, currentRecords, historicalRecords, selectedCampaignId, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent]);

    // Apply matrices and colors for Welds (Vertical Purple Cylinder Collars - Pic 2)
    useLayoutEffect(() => {
        if (!weldRef.current) return;
        const mesh = weldRef.current;
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        welds.forEach((item, i) => {
            const start = toVec3(item.start || item.position);
            const end = toVec3(item.end || item.position);
            const dir = end.clone().sub(start).normalize();
            const len = start.distanceTo(end);

            const compIdStr = String(item.comp?.id || item.id);
            const isMainLegWeld = mainNodeIds.has(compIdStr);

            // Collar height: 0.5m; Collar radius: leg radius + 0.03m (slightly larger than member radius)
            let collarRadius = (item.thickness || 0.3) + 0.03;
            let collarHeight = 0.5;

            if (isMainLegWeld) {
                collarRadius *= 2.0;
                collarHeight *= 2.0;
            }

            let renderDir = len > 0.001 ? dir : new THREE.Vector3(0, 1, 0);

            if (isMainLegWeld) {
                let closestDist = Infinity;
                cylinders.forEach(cyl => {
                    const cylCompIdStr = String(cyl.comp?.id || cyl.id);
                    if (mainMemberIds.has(cylCompIdStr)) {
                        const cylStart = toVec3(cyl.start || cyl.position);
                        const cylEnd = toVec3(cyl.end || cyl.position);
                        const line = new THREE.Line3(cylStart, cylEnd);
                        const cp = new THREE.Vector3();
                        line.closestPointToPoint(start, true, cp);
                        const dist = start.distanceTo(cp);
                        if (dist < closestDist && dist < 5.0) {
                            closestDist = dist;
                            const d = cylEnd.clone().sub(cylStart);
                            if (d.lengthSq() > 0.0001) {
                                renderDir = d.normalize();
                                if (renderDir.y < 0) renderDir.negate();
                            }
                        }
                    }
                });
            }

            const pos = start.clone().add(end).multiplyScalar(0.5);
            const quat = new THREE.Quaternion();
            quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), renderDir);

            matrix.compose(pos, quat, new THREE.Vector3(collarRadius, collarHeight, collarRadius));
            mesh.setMatrixAt(i, matrix);

            const compId = item.comp?.id || item.id;
            const isSelected = selectedCompId === compId;
            const baseColor = isSelected ? "#2563eb" : "#cbd5e1";
            const finalColor = getComponentColorByMode(item.comp, isSelected, colorMode, currentRecords, historicalRecords, selectedCampaignId, baseColor, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent);
            color.set(finalColor);
            mesh.setColorAt(i, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [welds, selectedCompId, mainNodeIds, colorMode, currentRecords, historicalRecords, selectedCampaignId, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent]);

    // Apply matrices and colors for Spheres (Structural Nodes ND)
    useLayoutEffect(() => {
        if (!sphereRef.current) return;
        const mesh = sphereRef.current;
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        spheres.forEach((item, i) => {
            const start = toVec3(item.start || item.position);
            let thickness = (item.thickness || 0.3) + 0.08;
            const compIdStr = String(item.comp?.id || item.id);
            if (mainNodeIds.has(compIdStr)) {
                thickness *= 2.0;
            }

            matrix.compose(start, new THREE.Quaternion(), new THREE.Vector3(thickness, thickness, thickness));
            mesh.setMatrixAt(i, matrix);

            const compId = item.comp?.id || item.id;
            const isSelected = selectedCompId === compId;
            const baseColor = isSelected ? "#2563eb" : "#94a3b8";
            const finalColor = getComponentColorByMode(item.comp, isSelected, colorMode, currentRecords, historicalRecords, selectedCampaignId, baseColor, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent);
            color.set(finalColor);
            mesh.setColorAt(i, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [spheres, selectedCompId, mainNodeIds, colorMode, currentRecords, historicalRecords, selectedCampaignId, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent]);

    // Apply matrices and colors for Boxes (Clamps)
    useLayoutEffect(() => {
        if (!boxRef.current) return;
        const mesh = boxRef.current;
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        boxes.forEach((item, i) => {
            const start = toVec3(item.start || item.position);
            const thickness = (item.thickness || 0.3) * 1.8;

            matrix.compose(start, new THREE.Quaternion(), new THREE.Vector3(thickness, thickness * 1.5, thickness));
            mesh.setMatrixAt(i, matrix);

            const compId = item.comp?.id || item.id;
            const isSelected = selectedCompId === compId;
            const baseColor = isSelected ? "#2563eb" : "#d97706";
            const finalColor = getComponentColorByMode(item.comp, isSelected, colorMode, currentRecords, historicalRecords, selectedCampaignId, baseColor, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent);
            color.set(finalColor);
            mesh.setColorAt(i, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [boxes, selectedCompId, colorMode, currentRecords, historicalRecords, selectedCampaignId, libraryColors, selectedPriorityFilter, inspectionModeFilter, priorityScope, compareWithCurrent]);

    // Apply matrices and colors for Anodes (Standoff style)
    useLayoutEffect(() => {
        if (!anodeBoxRef.current || !anodeStubRef.current || !anodeElbowRef.current) return;
        const boxMesh = anodeBoxRef.current;
        const stubMesh = anodeStubRef.current;
        const elbowMesh = anodeElbowRef.current;
        
        const boxMatrix = new THREE.Matrix4();
        const stubMatrix = new THREE.Matrix4();
        const color = new THREE.Color();
        
        let stubIndex = 0;
        let elbowIndex = 0;
        
        // Calculate platform geometric center (XZ plane) for vertical member reference (12 o'clock points outward)
        let sumX = 0, sumZ = 0, nodeCount = 0;
        spheres.forEach(sph => {
            const pos = toVec3(sph.start || sph.position);
            sumX += pos.x;
            sumZ += pos.z;
            nodeCount++;
        });
        const platformCenter = nodeCount > 0 ? new THREE.Vector3(sumX / nodeCount, 0, sumZ / nodeCount) : new THREE.Vector3(0, 0, 0);

        anodes.forEach((item, i) => {
            const start = toVec3(item.start || item.position);
            const end = toVec3(item.end || item.position);
            let pos = start.clone().add(end).multiplyScalar(0.5); // Center of the anode
            
            // Find closest member
            let closestDist = Infinity;
            let closestCyl: any = null;
            let closestPoint = new THREE.Vector3();
            let cylDir = new THREE.Vector3(0, 1, 0);
            
            cylinders.forEach(cyl => {
                const cs = toVec3(cyl.start || cyl.position);
                const ce = toVec3(cyl.end || cyl.position);
                
                const line = new THREE.Line3(cs, ce);
                const cp = new THREE.Vector3();
                line.closestPointToPoint(pos, true, cp);
                
                const dist = pos.distanceTo(cp);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestCyl = cyl;
                    closestPoint.copy(cp);
                    let dirLen = ce.clone().sub(cs).length();
                    cylDir = dirLen > 0.001 ? ce.clone().sub(cs).normalize() : new THREE.Vector3(0, 1, 0);
                }
            });
            
            // Get member radius
            let memberRadius = 0.15; // Default (0.3 thickness * 0.5 radius)
            if (closestCyl) {
                let th = closestCyl.thickness || 0.3;
                const compIdStr = String(closestCyl.comp?.id || closestCyl.id);
                if (mainMemberIds.has(compIdStr)) {
                    th *= 2.0;
                }
                memberRadius = th * 0.5;
            }
            
            // Standoff distance (default 0.15 if perfectly on centerline)
            let standoffDist = closestDist > 0.001 ? Math.max(closestDist - memberRadius, 0.1) : 0.15;
            
            // Parse clock position
            const md = item.comp?.metadata || item.comp || item;
            const rawClockPos = md.clock_position ?? md.clk_pos ?? md.clockPosition ?? md.clock;
            let clockPos = 12; // Default to 12 o'clock
            if (rawClockPos !== undefined && rawClockPos !== null && rawClockPos !== "" && String(rawClockPos).toUpperCase() !== "N/A") {
                const str = String(rawClockPos).trim();
                const parts = str.split(':');
                if (parts.length > 0) {
                    const hrs = parseFloat(parts[0]);
                    const mins = parts.length > 1 ? parseFloat(parts[1]) : 0;
                    if (!isNaN(hrs)) {
                        clockPos = hrs + (isNaN(mins) ? 0 : mins / 60);
                        if (clockPos > 12) clockPos = clockPos % 12;
                        if (clockPos === 0) clockPos = 12;
                    }
                }
            }
            
            // Calculate 12 o'clock reference vector
            let refVec = new THREE.Vector3();
            const isVertical = Math.abs(cylDir.y) > 0.8;
            
            refVec.set(closestPoint.x - platformCenter.x, 0, closestPoint.z - platformCenter.z).normalize();
            if (refVec.lengthSq() < 0.001) refVec.set(1, 0, 0);

            // For horizontal members, rotate around Global Y-axis (compass style)
            const rotAxis = isVertical ? cylDir : new THREE.Vector3(0, 1, 0);
            if (isVertical) {
                refVec.sub(cylDir.clone().multiplyScalar(refVec.dot(cylDir))).normalize();
            }

            // Rotate refVec by clock angle clockwise around vertical/member axis
            const clockAngle = (clockPos / 12) * Math.PI * 2;
            let normal = refVec.clone().applyAxisAngle(rotAxis, -clockAngle).normalize();
            
            // Dynamically reposition the anode based on the computed normal and standoff
            pos = closestPoint.clone().add(normal.clone().multiplyScalar(memberRadius + standoffDist));
            closestDist = memberRadius + standoffDist;
            
            // Anode properties
            const anodeLength = 0.8;
            const anodeWidth = 0.15;
            const anodeHeight = 0.15;
            const stubRadius = 0.05;
            const bendRadius = 0.08;
            const penetration = 0.05;
            
            // Render Main Anode Body (Box)
            // BoxGeometry args are [width(x), height(y), depth(z)]. We want length along Y axis to match cylDir.
            const boxQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), cylDir);
            boxMatrix.compose(pos, boxQuat, new THREE.Vector3(anodeWidth, anodeLength, anodeHeight));
            boxMesh.setMatrixAt(i, boxMatrix);
            
            const compId = item.comp?.id || item.id;
            const isSelected = selectedCompId === compId;
            const defaultColor = isSelected ? "#2563eb" : "#e2e8f0"; // light grey/zinc
            color.set(defaultColor);
            boxMesh.setColorAt(i, color);
            
            // End points of the anode body
            const end1 = pos.clone().add(cylDir.clone().multiplyScalar(anodeLength / 2));
            const end2 = pos.clone().sub(cylDir.clone().multiplyScalar(anodeLength / 2));
            
            // Axial stubs extend total 0.1m outward (including bend radius)
            const totalAxialLen = 0.1;
            const axialLen = Math.max(totalAxialLen - bendRadius, 0.01);
            
            const axialStub1Pos = end1.clone().add(cylDir.clone().multiplyScalar(axialLen / 2));
            const axialStub2Pos = end2.clone().sub(cylDir.clone().multiplyScalar(axialLen / 2));
            
            // The outer tips are the theoretical sharp corners
            const outerTip1 = end1.clone().add(cylDir.clone().multiplyScalar(totalAxialLen));
            const outerTip2 = end2.clone().add(cylDir.clone().multiplyScalar(-totalAxialLen));
            
            // Standoff is distance from pos to surface of the member
            const standoff = pos.distanceTo(closestPoint) - memberRadius;
            const totalRadialLen = Math.max(standoff, bendRadius + 0.01) + penetration;
            const radialLen = Math.max(totalRadialLen - bendRadius, 0.01);
            
            // The radial stub starts after the bendRadius drop-off from the outer tip
            const radialStart1 = outerTip1.clone().sub(normal.clone().multiplyScalar(bendRadius));
            const radialStart2 = outerTip2.clone().sub(normal.clone().multiplyScalar(bendRadius));
            
            const radialStub1Pos = radialStart1.clone().sub(normal.clone().multiplyScalar(radialLen / 2));
            const radialStub2Pos = radialStart2.clone().sub(normal.clone().multiplyScalar(radialLen / 2));
            
            // Axial Stub 1 & 2 (parallel to cylinder direction)
            const stubQuatAxial = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), cylDir);
            stubMatrix.compose(axialStub1Pos, stubQuatAxial, new THREE.Vector3(stubRadius, axialLen, stubRadius));
            stubMesh.setMatrixAt(stubIndex++, stubMatrix);
            stubMesh.setColorAt(stubIndex - 1, color);
            
            stubMatrix.compose(axialStub2Pos, stubQuatAxial, new THREE.Vector3(stubRadius, axialLen, stubRadius));
            stubMesh.setMatrixAt(stubIndex++, stubMatrix);
            stubMesh.setColorAt(stubIndex - 1, color);
            
            // Radial Stub 1 & 2 (parallel to normal vector pointing outwards, so we align Y with normal)
            const stubQuatRadial = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            stubMatrix.compose(radialStub1Pos, stubQuatRadial, new THREE.Vector3(stubRadius, radialLen, stubRadius));
            stubMesh.setMatrixAt(stubIndex++, stubMatrix);
            stubMesh.setColorAt(stubIndex - 1, color);
            
            stubMatrix.compose(radialStub2Pos, stubQuatRadial, new THREE.Vector3(stubRadius, radialLen, stubRadius));
            stubMesh.setMatrixAt(stubIndex++, stubMatrix);
            stubMesh.setColorAt(stubIndex - 1, color);
            
            // Elbow 1 & 2 (Torus geometries for smooth corners)
            const elbow1Pos = outerTip1.clone().sub(normal.clone().multiplyScalar(bendRadius)).sub(cylDir.clone().multiplyScalar(bendRadius));
            const elbow2Pos = outerTip2.clone().sub(normal.clone().multiplyScalar(bendRadius)).add(cylDir.clone().multiplyScalar(bendRadius));
            
            const makeElbowMatrix = (p: THREE.Vector3, xAxis: THREE.Vector3, yAxis: THREE.Vector3) => {
                const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
                const m = new THREE.Matrix4();
                m.makeBasis(xAxis, yAxis, zAxis);
                m.setPosition(p);
                return m;
            };
            
            const elbow1Matrix = makeElbowMatrix(elbow1Pos, normal, cylDir);
            elbowMesh.setMatrixAt(elbowIndex++, elbow1Matrix);
            elbowMesh.setColorAt(elbowIndex - 1, color);
            
            const elbow2Matrix = makeElbowMatrix(elbow2Pos, normal, cylDir.clone().negate());
            elbowMesh.setMatrixAt(elbowIndex++, elbow2Matrix);
            elbowMesh.setColorAt(elbowIndex - 1, color);
            
        });
        
        boxMesh.instanceMatrix.needsUpdate = true;
        if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true;
        stubMesh.instanceMatrix.needsUpdate = true;
        if (stubMesh.instanceColor) stubMesh.instanceColor.needsUpdate = true;
        stubMesh.count = stubIndex;
        elbowMesh.instanceMatrix.needsUpdate = true;
        if (elbowMesh.instanceColor) elbowMesh.instanceColor.needsUpdate = true;
        elbowMesh.count = elbowIndex;
    }, [anodes, cylinders, selectedCompId, mainMemberIds]);

    // Find layout of selected component for overlay label and highlight mesh
    const selectedLayout = useMemo(() => {
        if (!selectedCompId) return null;
        return layouts.find((l) => {
            const compId = l.component?.id || l.originalComp?.id || l.id;
            return compId === selectedCompId || String(compId) === String(selectedCompId);
        });
    }, [layouts, selectedCompId]);

    const selectedPos = useMemo(() => {
        if (!selectedLayout) return null;
        const s = toVec3(selectedLayout.start || selectedLayout.position);
        const e = toVec3(selectedLayout.end || selectedLayout.position);
        return [(s.x + e.x) / 2, (s.y + e.y) / 2 + 0.5, (s.z + e.z) / 2] as [number, number, number];
    }, [selectedLayout]);

    return (
        <group>
            {/* Cylinder Instanced Buffer */}
            {cylinders.length > 0 && (
                <instancedMesh
                    ref={cylinderRef}
                    args={[undefined, undefined, cylinders.length]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && cylinders[e.instanceId]) {
                            isDirectClickRef.current = true;
                            if (onSelectComponent) onSelectComponent(cylinders[e.instanceId].comp);
                        }
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && cylinders[e.instanceId]) {
                            isDirectClickRef.current = true;
                            const item = cylinders[e.instanceId];
                            const s = toVec3(item.start || item.position);
                            const end = toVec3(item.end || item.position);
                            const center = new THREE.Vector3((s.x + end.x) / 2, (s.y + end.y) / 2, (s.z + end.z) / 2);
                            if (onDoubleClickComponent) onDoubleClickComponent(item.comp, center);
                        }
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && cylinders[e.instanceId]) {
                            setHoveredComp(cylinders[e.instanceId].comp);
                        }
                    }}
                    onPointerOut={() => setHoveredComp(null)}
                >
                    <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
                    <meshStandardMaterial metalness={0.4} roughness={0.3} />
                </instancedMesh>
            )}

            {/* Anode Box Instanced Buffer */}
            {anodes.length > 0 && (
                <instancedMesh
                    ref={anodeBoxRef}
                    args={[undefined, undefined, anodes.length]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && anodes[e.instanceId]) {
                            isDirectClickRef.current = true;
                            if (onSelectComponent) onSelectComponent(anodes[e.instanceId].comp);
                        }
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && anodes[e.instanceId]) {
                            isDirectClickRef.current = true;
                            const item = anodes[e.instanceId];
                            const s = toVec3(item.start || item.position);
                            const end = toVec3(item.end || item.position);
                            const center = new THREE.Vector3((s.x + end.x) / 2, (s.y + end.y) / 2, (s.z + end.z) / 2);
                            if (onDoubleClickComponent) onDoubleClickComponent(item.comp, center);
                        }
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && anodes[e.instanceId]) {
                            setHoveredComp(anodes[e.instanceId].comp);
                        }
                    }}
                    onPointerOut={() => setHoveredComp(null)}
                >
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial metalness={0.5} roughness={0.5} />
                </instancedMesh>
            )}

            {/* Anode Stub Instanced Buffer */}
            {anodes.length > 0 && (
                <instancedMesh
                    ref={anodeStubRef}
                    args={[undefined, undefined, anodes.length * 4]}
                >
                    <cylinderGeometry args={[1, 1, 1, 12]} />
                    <meshStandardMaterial metalness={0.5} roughness={0.5} />
                </instancedMesh>
            )}

            {/* Anode Elbow Instanced Buffer */}
            {anodes.length > 0 && (
                <instancedMesh
                    ref={anodeElbowRef}
                    args={[undefined, undefined, anodes.length * 2]}
                >
                    <torusGeometry args={[0.08, 0.05, 8, 12, Math.PI / 2]} />
                    <meshStandardMaterial metalness={0.5} roughness={0.5} />
                </instancedMesh>
            )}

            {/* Weld Cylinder Collar Instanced Buffer (Pic 2) */}
            {welds.length > 0 && (
                <instancedMesh
                    ref={weldRef}
                    args={[undefined, undefined, welds.length]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && welds[e.instanceId]) {
                            isDirectClickRef.current = true;
                            if (onSelectComponent) onSelectComponent(welds[e.instanceId].comp);
                        }
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && welds[e.instanceId]) {
                            isDirectClickRef.current = true;
                            const item = welds[e.instanceId];
                            const s = toVec3(item.start || item.position);
                            const end = toVec3(item.end || item.position);
                            const center = new THREE.Vector3((s.x + end.x) / 2, (s.y + end.y) / 2, (s.z + end.z) / 2);
                            if (onDoubleClickComponent) onDoubleClickComponent(item.comp, center);
                        }
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && welds[e.instanceId]) {
                            setHoveredComp(welds[e.instanceId].comp);
                        }
                    }}
                    onPointerOut={() => setHoveredComp(null)}
                >
                    <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
                    <meshStandardMaterial metalness={0.7} roughness={0.3} emissive="#000000" emissiveIntensity={0} />
                </instancedMesh>
            )}

            {/* Always Display Node Weld Numbers (Toggled via Node Numbers checkbox) */}
            {showWeldNumbering && welds.map((w, idx) => {
                const s = toVec3(w.start || w.position);
                const e = toVec3(w.end || w.position);
                const pos = [(s.x + e.x) / 2, (s.y + e.y) / 2 + 1.1, (s.z + e.z) / 2] as [number, number, number];

                const rawLabel = w.comp?.q_id || w.q_id || `WN${idx + 1}`;
                const labelText = rawLabel.replace(/^(?:WN\s*N?|N\s*)/i, "").trim() || rawLabel;

                const compId = w.comp?.id || w.id;
                const isSelected = selectedCompId === compId;

                return (
                    <Html key={`weld-tag-${w.id || idx}`} position={pos} center distanceFactor={18} zIndexRange={[10, 0]}>
                        <div
                            onClick={(evt) => {
                                evt.stopPropagation();
                                isDirectClickRef.current = true;
                                if (onSelectComponent) onSelectComponent(w.comp);
                            }}
                            onDoubleClick={(evt) => {
                                evt.stopPropagation();
                                isDirectClickRef.current = true;
                                const center = new THREE.Vector3(pos[0], pos[1], pos[2]);
                                if (onDoubleClickComponent) onDoubleClickComponent(w.comp, center);
                            }}
                            className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap cursor-pointer select-none transition-all -translate-x-3 -translate-y-2 [-webkit-text-stroke:0.5px_rgba(0,0,0,0.9)] ${isSelected
                                    ? "text-white scale-125 opacity-100 z-20 [-webkit-text-stroke:0.7px_#000] [text-shadow:0_0_8px_rgba(255,255,255,0.9)]"
                                    : "text-white opacity-90 hover:opacity-100 hover:scale-110"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                );
            })}

            {showWeldNumbering && spheres.map((sph, idx) => {
                const s = toVec3(sph.start || sph.position);
                const pos = [s.x, s.y + 1.1, s.z] as [number, number, number];

                const rawLabel = sph.comp?.q_id || sph.q_id || `N${idx + 1}`;
                const labelText = rawLabel.replace(/^(?:WN\s*N?|N\s*)/i, "").trim() || rawLabel;

                const compId = sph.comp?.id || sph.id;
                const isSelected = selectedCompId === compId;

                return (
                    <Html key={`node-tag-${sph.id || idx}`} position={pos} center distanceFactor={18} zIndexRange={[10, 0]}>
                        <div
                            onClick={(evt) => {
                                evt.stopPropagation();
                                isDirectClickRef.current = true;
                                if (onSelectComponent) onSelectComponent(sph.comp);
                            }}
                            onDoubleClick={(evt) => {
                                evt.stopPropagation();
                                isDirectClickRef.current = true;
                                const center = new THREE.Vector3(pos[0], pos[1], pos[2]);
                                if (onDoubleClickComponent) onDoubleClickComponent(sph.comp, center);
                            }}
                            className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap cursor-pointer select-none transition-all -translate-x-3 -translate-y-2 [-webkit-text-stroke:0.5px_rgba(0,0,0,0.9)] ${isSelected
                                    ? "text-white scale-125 opacity-100 z-20 [-webkit-text-stroke:0.7px_#000] [text-shadow:0_0_8px_rgba(255,255,255,0.9)]"
                                    : "text-white opacity-90 hover:opacity-100 hover:scale-110"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                );
            })}

            {/* Sphere Instanced Buffer */}
            {spheres.length > 0 && (
                <instancedMesh
                    ref={sphereRef}
                    args={[undefined, undefined, spheres.length]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && spheres[e.instanceId]) {
                            isDirectClickRef.current = true;
                            if (onSelectComponent) onSelectComponent(spheres[e.instanceId].comp);
                        }
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && spheres[e.instanceId]) {
                            isDirectClickRef.current = true;
                            const item = spheres[e.instanceId];
                            const s = toVec3(item.start || item.position);
                            const center = s.clone();
                            if (onDoubleClickComponent) onDoubleClickComponent(item.comp, center);
                        }
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && spheres[e.instanceId]) {
                            setHoveredComp(spheres[e.instanceId].comp);
                        }
                    }}
                    onPointerOut={() => setHoveredComp(null)}
                >
                    <sphereGeometry args={[0.5, 16, 16]} />
                    <meshStandardMaterial metalness={0.5} roughness={0.2} emissive="#000000" emissiveIntensity={0} />
                </instancedMesh>
            )}

            {/* Box Instanced Buffer */}
            {boxes.length > 0 && (
                <instancedMesh
                    ref={boxRef}
                    args={[undefined, undefined, boxes.length]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && boxes[e.instanceId]) {
                            isDirectClickRef.current = true;
                            if (onSelectComponent) onSelectComponent(boxes[e.instanceId].comp);
                        }
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && boxes[e.instanceId]) {
                            isDirectClickRef.current = true;
                            const item = boxes[e.instanceId];
                            const s = toVec3(item.start || item.position);
                            const center = s.clone();
                            if (onDoubleClickComponent) onDoubleClickComponent(item.comp, center);
                        }
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        if (e.instanceId !== undefined && boxes[e.instanceId]) {
                            setHoveredComp(boxes[e.instanceId].comp);
                        }
                    }}
                    onPointerOut={() => setHoveredComp(null)}
                >
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial metalness={0.3} roughness={0.4} />
                </instancedMesh>
            )}

            {/* Procedural Components (Fenders & Riser Guards) */}
            {customLayouts.map((layout, idx) => (
                <ComponentMesh
                    key={`custom-${layout.id || layout.comp?.id || idx}`}
                    component={layout.comp}
                    isSelected={selectedCompId === (layout.comp?.id || layout.id)}
                    onClick={() => {
                        isDirectClickRef.current = true;
                        if (onSelectComponent) onSelectComponent(layout.comp);
                    }}
                    onDoubleClick={() => {
                        isDirectClickRef.current = true;
                        const s = layout.start || layout.position || [0, 0, 0];
                        const end = layout.end || layout.position || s;
                        const center = new THREE.Vector3((s[0] + end[0]) / 2, (s[1] + end[1]) / 2, (s[2] + end[2]) / 2);
                        if (onDoubleClickComponent) onDoubleClickComponent(layout.comp, center);
                    }}
                    start={layout.start || layout.position}
                    end={layout.end || layout.position}
                    thickness={layout.thickness}
                    showWeldNumbering={showWeldNumbering}
                    isInspectionMode={isInspectionMode}
                    inspectionStatus={layout.inspectionStatus || "NOT_INSPECTED"}
                    isStatusChecked={selectedInspectionFilters.includes(layout.inspectionStatus || "NOT_INSPECTED")}
                    inspectionColor={layout.color}
                    allLayouts={layouts}
                />
            ))}
        </group>
    );
}

function isRecordInInspectionMode(r: any, mode: "BOTH" | "ROV" | "DIVING"): boolean {
    if (!r || mode === "BOTH") return true;

    const rMode = String(r.mode || r.campaign_mode || r.jobpack_mode || r.inspection_mode || "").toUpperCase();
    if (rMode) {
        if (mode === "ROV" && (rMode.includes("ROV") || rMode === "R")) return true;
        if (mode === "DIVING" && (rMode.includes("DIV") || rMode === "D")) return true;
    }

    const code = String(r.inspection_type_code || r.inspection_type?.code || r.task_code || r.spec_code || "").toUpperCase();
    if (code) {
        if (mode === "ROV") {
            if (code.startsWith("R") && code !== "RISER") return true;
            if (code.includes("ROV")) return true;
            if (!code.startsWith("D")) return true;
        } else if (mode === "DIVING") {
            if (code.startsWith("D") && code !== "DEBRIS") return true;
            if (code.includes("DIV")) return true;
            if (!code.startsWith("R") || code === "RISER") return true;
        }
    }

    return false;
}

function getComponentColorByMode(
    comp: any,
    isSelected: boolean,
    mode: VisualizationMode,
    currentRecords: any[],
    historicalRecords: any[],
    selectedCampaignId: string | number | null,
    defaultColor: string,
    libraryColors: Record<string, string> = {},
    selectedPriorityFilter: string | null = null,
    inspectionModeFilter: "BOTH" | "ROV" | "DIVING" = "BOTH",
    priorityScope: "BOTH" | "ANOMALY" | "FINDING" = "BOTH",
    compareWithCurrent: boolean = true
): string {
    if (isSelected) return "#2563eb";
    if (!comp || mode === "DEFAULT") return defaultColor;

    const compIdStr = String(comp.id || comp.comp_id || "");
    const compQIdStr = String(comp.q_id || comp.name || "").toUpperCase();

    const compCurrentRecords = (currentRecords || []).filter((r: any) => {
        const matchesComp = String(r.component_id || r.comp_id) === compIdStr || 
                            ((r.component_qid || r.q_id) && String(r.component_qid || r.q_id).toUpperCase() === compQIdStr);
        if (!matchesComp) return false;
        return isRecordInInspectionMode(r, inspectionModeFilter);
    });

    const compHistRecords = (historicalRecords || []).filter((r: any) => {
        const matchesComp = String(r.component_id || r.comp_id) === compIdStr || 
                            ((r.component_qid || r.q_id) && String(r.component_qid || r.q_id).toUpperCase() === compQIdStr);
        if (!matchesComp) return false;
        if (selectedCampaignId && selectedCampaignId !== "ALL") {
            if (String(r.jobpack_id || r.campaign_id || r.jobpack_no) !== String(selectedCampaignId)) return false;
        }
        return isRecordInInspectionMode(r, inspectionModeFilter);
    });

    switch (mode) {
        case "ANOMALY_PRIORITY": {
            if (compCurrentRecords.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return libraryColors["UNINSPECTED"] || "#64748b";
            }
            let highestSeverity = 0; // 5: Priority 1, 4: Priority 2, 3: Priority 3, 2: Priority 4
            let hasFinding = false;
            let findingSeverity = 0; // 4: Finding P1, 3: Finding P2, 2: Finding P3, 1: Observation
            let findingPriorityCode = "";

            compCurrentRecords.forEach((r: any) => {
                const ft = String(r.finding_type || r.findingType || r.record_category || r.category || "").toUpperCase();
                const isAnomaly = ft === "ANOMALY" || ft.includes("ANOMALY") || Boolean(r.is_anomaly) || Boolean(r.has_anomaly) || Boolean(r.anomaly_class) || Boolean(r.anomaly_id) || Boolean(r.anomaly_ref_no) || Boolean(r.priority || r.priority_code);
                const isFinding = !isAnomaly && (ft === "FINDING" || ft.includes("FINDING") || ft === "OBSERVATION" || ft.includes("OBSERVATION") || Boolean(r.is_finding) || Boolean(r.has_finding));

                const prio = (r.priority || r.priority_code || r.anomaly_class || r.severity || r.anomaly_grade || r.class || "").toString().toUpperCase();

                if (isAnomaly && (priorityScope === "BOTH" || priorityScope === "ANOMALY")) {
                    if (prio.includes("PRIORITY 1") || prio === "P1" || prio.includes("CLASS A") || prio.includes("CRITICAL") || prio === "1") {
                        highestSeverity = Math.max(highestSeverity, 5);
                    } else if (prio.includes("PRIORITY 2") || prio === "P2" || prio.includes("CLASS B") || prio.includes("HIGH") || prio === "2") {
                        highestSeverity = Math.max(highestSeverity, 4);
                    } else if (prio.includes("PRIORITY 3") || prio === "P3" || prio.includes("CLASS C") || prio.includes("MEDIUM") || prio.includes("MED") || prio === "3") {
                        highestSeverity = Math.max(highestSeverity, 3);
                    } else if (prio.includes("PRIORITY 4") || prio === "P4" || prio.includes("LOW") || prio === "4") {
                        highestSeverity = Math.max(highestSeverity, 2);
                    } else {
                        highestSeverity = Math.max(highestSeverity, 4);
                    }
                } else if (isFinding && (priorityScope === "BOTH" || priorityScope === "FINDING")) {
                    hasFinding = true;
                    if (prio.includes("PRIORITY 1") || prio === "P1" || prio.includes("CLASS A") || prio.includes("CRITICAL") || prio.includes("HIGH") || prio === "1") {
                        findingSeverity = Math.max(findingSeverity, 4);
                    } else if (prio.includes("PRIORITY 2") || prio === "P2" || prio.includes("CLASS B") || prio.includes("MODERATE") || prio.includes("MED") || prio === "2") {
                        findingSeverity = Math.max(findingSeverity, 3);
                    } else if (prio.includes("PRIORITY 3") || prio === "P3" || prio.includes("CLASS C") || prio.includes("LOW") || prio.includes("MINOR") || prio === "3") {
                        findingSeverity = Math.max(findingSeverity, 2);
                    } else {
                        findingSeverity = Math.max(findingSeverity, 1);
                    }
                    if (prio) findingPriorityCode = prio;
                }
            });

            let finalCode = "CLEAN";
            let colorHex = libraryColors["CLEAN"] || "#10b981";

            if (highestSeverity === 5) {
                finalCode = "PRIORITY 1";
                colorHex = libraryColors["PRIORITY 1"] || libraryColors["P1"] || "#ef4444";
            } else if (highestSeverity === 4) {
                finalCode = "PRIORITY 2";
                colorHex = libraryColors["PRIORITY 2"] || libraryColors["P2"] || "#f97316";
            } else if (highestSeverity === 3) {
                finalCode = "PRIORITY 3";
                colorHex = libraryColors["PRIORITY 3"] || libraryColors["P3"] || "#eab308";
            } else if (highestSeverity === 2) {
                finalCode = "PRIORITY 4";
                colorHex = libraryColors["PRIORITY 4"] || libraryColors["P4"] || "#84cc16";
            } else if (hasFinding) {
                if (findingSeverity === 4) {
                    finalCode = "FINDING P1";
                    colorHex = libraryColors["FINDING P1"] || libraryColors["FINDING_P1"] || "#ef4444";
                } else if (findingSeverity === 3) {
                    finalCode = "FINDING P2";
                    colorHex = libraryColors["FINDING P2"] || libraryColors["FINDING_P2"] || "#f97316";
                } else if (findingSeverity === 2) {
                    finalCode = "FINDING P3";
                    colorHex = libraryColors["FINDING P3"] || libraryColors["FINDING_P3"] || "#0284c7";
                } else if (findingPriorityCode.includes("OBSERVATION") || findingPriorityCode === "OBS") {
                    finalCode = "OBSERVATION";
                    colorHex = libraryColors["OBSERVATION"] || libraryColors["OBS"] || "#d97706";
                } else {
                    finalCode = "FINDING";
                    colorHex = libraryColors["FINDING"] || libraryColors["OBSERVATION"] || "#0284c7";
                }
            }

            if (selectedPriorityFilter) {
                const selUpper = selectedPriorityFilter.toUpperCase();
                const isMatch = selectedPriorityFilter === finalCode ||
                    (selUpper.includes("P1") && finalCode === "PRIORITY 1") ||
                    (selUpper.includes("P2") && finalCode === "PRIORITY 2") ||
                    (selUpper.includes("P3") && finalCode === "PRIORITY 3") ||
                    (selUpper.includes("P4") && finalCode === "PRIORITY 4") ||
                    (selUpper.includes("OBS") && (finalCode === "OBSERVATION" || finalCode === "FINDING"));

                if (!isMatch) return "#1e293b";
            }

            return colorHex;
        }

        case "FINDING_CATEGORY": {
            if (compCurrentRecords.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return libraryColors["UNINSPECTED"] || "#64748b";
            }
            let categoryType = "";

            compCurrentRecords.forEach((r: any) => {
                const desc = String(r.description || r.finding_description || r.finding_detail || r.finding_type || r.category || "").toUpperCase();
                if (desc.includes("CORROSION") || desc.includes("PIT") || desc.includes("METAL LOSS") || desc.includes("RUST") || desc.includes("WELD")) {
                    categoryType = "CORROSION";
                } else if (desc.includes("MARINE") || desc.includes("GROWTH") || desc.includes("BARNACLE") || desc.includes("BIO") || desc.includes("FOULING")) {
                    if (!categoryType || categoryType === "GENERAL") categoryType = "MARINE_GROWTH";
                } else if (desc.includes("COATING") || desc.includes("PAINT") || desc.includes("DEGRADATION") || desc.includes("BLISTER")) {
                    if (!categoryType || categoryType === "GENERAL") categoryType = "COATING";
                } else if (desc.includes("DEBRIS") || desc.includes("ROPE") || desc.includes("WIRE") || desc.includes("OBJECT") || desc.includes("FOREIGN")) {
                    if (!categoryType || categoryType === "GENERAL") categoryType = "DEBRIS";
                } else if (desc.includes("SCOUR") || desc.includes("SEABED") || desc.includes("BURIAL") || desc.includes("CRATER") || desc.includes("DEPRESSION")) {
                    if (!categoryType || categoryType === "GENERAL") categoryType = "SCOUR";
                } else if (r.finding_type || r.description) {
                    if (!categoryType) categoryType = "GENERAL";
                }
            });

            let finalCode = "CLEAN";
            let colorHex = libraryColors["CLEAN"] || "#10b981";

            if (categoryType === "CORROSION") { finalCode = "CORROSION"; colorHex = libraryColors["CORROSION"] || "#ec4899"; }
            else if (categoryType === "MARINE_GROWTH") { finalCode = "MARINE_GROWTH"; colorHex = libraryColors["MARINE_GROWTH"] || "#06b6d4"; }
            else if (categoryType === "COATING") { finalCode = "COATING"; colorHex = libraryColors["COATING"] || "#a855f7"; }
            else if (categoryType === "DEBRIS") { finalCode = "DEBRIS"; colorHex = libraryColors["DEBRIS"] || "#84cc16"; }
            else if (categoryType === "SCOUR") { finalCode = "SCOUR"; colorHex = libraryColors["SCOUR"] || "#3b82f6"; }
            else if (categoryType === "GENERAL") { finalCode = "GENERAL"; colorHex = libraryColors["GENERAL"] || "#0284c7"; }

            if (selectedPriorityFilter && selectedPriorityFilter !== finalCode) return "#1e293b";

            return colorHex;
        }

        case "PENDING_TASK": {
            const taskStatuses = comp.taskStatuses || comp.tasks || [];
            if (!taskStatuses || taskStatuses.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return "#475569";
            }
            const hasCompleted = taskStatuses.some((t: any) => t.status === "COMPLETED" || t.status === "COMPLETE");
            const hasInProgress = taskStatuses.some((t: any) => t.status === "IN_PROGRESS" || t.status === "STARTED");
            const hasPending = taskStatuses.some((t: any) => !t.status || t.status === "PENDING" || t.status === "NOT_STARTED");

            let finalCode = "PENDING";
            if (hasCompleted && !hasPending && !hasInProgress) finalCode = "COMPLETED";
            else if (hasInProgress) finalCode = "IN_PROGRESS";

            if (selectedPriorityFilter && selectedPriorityFilter !== finalCode) return "#1e293b";

            if (finalCode === "COMPLETED") return "#10b981";
            if (finalCode === "IN_PROGRESS") return "#0284c7";
            return "#f59e0b";
        }

        case "INCOMPLETE_RECORD": {
            if (compCurrentRecords.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return "#475569";
            }
            const hasIncomplete = compCurrentRecords.some((r: any) => String(r.record_status || r.status || "").toUpperCase() === "INCOMPLETE" || r.is_incomplete);
            const finalCode = hasIncomplete ? "INCOMPLETE" : "COMPLETE";

            if (selectedPriorityFilter && selectedPriorityFilter !== finalCode) return "#1e293b";

            if (hasIncomplete) return "#e11d48";
            return "#10b981";
        }

        case "RECTIFIED_ANOMALY": {
            if (compCurrentRecords.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return "#475569";
            }
            const anomalies = compCurrentRecords.filter((r: any) => {
                const ft = String(r.finding_type || r.findingType || r.record_category || r.category || "").toUpperCase();
                return ft === "ANOMALY" || ft.includes("ANOMALY") || Boolean(r.is_anomaly) || Boolean(r.has_anomaly) || Boolean(r.anomaly_class);
            });
            if (anomalies.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "CLEAN") return "#1e293b";
                return "#10b981";
            }
            const allRectified = anomalies.every((r: any) => r.rectified || r.is_rectified || String(r.status || "").toUpperCase() === "RECTIFIED" || r.repaired);
            const finalCode = allRectified ? "RECTIFIED" : "ACTIVE";

            if (selectedPriorityFilter && selectedPriorityFilter !== finalCode) return "#1e293b";

            if (allRectified) return "#06b6d4";
            return "#ef4444";
        }

        case "INSPECTION_TASK_TYPE": {
            const codes: string[] = [];
            if (compCurrentRecords && compCurrentRecords.length > 0) {
                compCurrentRecords.forEach((r: any) => {
                    const c = String(r.inspection_type_code || r.inspection_type?.code || r.task_code || r.spec_code || "").toUpperCase();
                    if (c) codes.push(c);
                });
            }
            if (comp.taskStatuses && comp.taskStatuses.length > 0) {
                comp.taskStatuses.forEach((t: any) => {
                    const c = String(t.code || t.task_code || t.spec_code || "").toUpperCase();
                    if (c) codes.push(c);
                });
            }
            const directCode = String(comp.task_code || comp.type || "").toUpperCase();
            if (directCode) codes.push(directCode);

            if (codes.length === 0) {
                if (selectedPriorityFilter && selectedPriorityFilter !== "UNINSPECTED") return "#1e293b";
                return "#475569";
            }

            let finalCode = "OTHER";
            let colorHex = "#94a3b8";

            for (const c of codes) {
                if (c.includes("RFMD") || c.includes("DFMD") || c === "FMD" || c.includes("FLOOD")) {
                    finalCode = c.includes("RFMD") ? "RFMD" : c.includes("DFMD") ? "DFMD" : "FMD";
                    colorHex = "#06b6d4"; // Cyan
                    break;
                } else if (c.includes("RUTWT") || c.includes("DUTWT") || c.includes("UTWTK") || c === "UT" || c.includes("WTK")) {
                    finalCode = c.includes("RUTWT") ? "RUTWT" : c.includes("DUTWT") ? "DUTWT" : "UTWTK";
                    colorHex = "#f59e0b"; // Amber
                    break;
                } else if (c.includes("RSANI") || c.includes("DSANI") || c.includes("ANODE") || c.includes("PL_AN")) {
                    finalCode = c.includes("RSANI") ? "RSANI" : c.includes("DSANI") ? "DSANI" : "ANODE";
                    colorHex = "#a855f7"; // Purple
                    break;
                } else if (c.includes("RGVIN") || c.includes("DGVIN") || c.includes("GVINS") || c.includes("GVI") || c.includes("VIS")) {
                    finalCode = c.includes("RGVIN") ? "RGVIN" : c.includes("DGVIN") ? "DGVIN" : "GVINS";
                    colorHex = "#3b82f6"; // Blue
                    break;
                } else if (c.includes("RCVIN") || c.includes("DCVIN") || c.includes("CVINS") || c.includes("CVI")) {
                    finalCode = c.includes("RCVIN") ? "RCVIN" : c.includes("DCVIN") ? "DCVIN" : "CVINS";
                    colorHex = "#0284c7"; // Sky Blue
                    break;
                } else if (c.includes("RCPSU") || c.includes("DCPSU") || c.includes("CPSURV") || c === "CP") {
                    finalCode = c.includes("RCPSU") ? "RCPSU" : c.includes("DCPSU") ? "DCPSU" : "CPSURV";
                    colorHex = "#10b981"; // Emerald
                    break;
                } else if (c.includes("RSZCI") || c.includes("DSZCI") || c.includes("SZCI") || c.includes("SZONE")) {
                    finalCode = c.includes("RSZCI") ? "RSZCI" : c.includes("DSZCI") ? "DSZCI" : "SZONE";
                    colorHex = "#f43f5e"; // Rose
                    break;
                } else if (c.includes("RACFM") || c.includes("DACFM") || c.includes("ACFM")) {
                    finalCode = c.includes("RACFM") ? "RACFM" : c.includes("DACFM") ? "DACFM" : "ACFM";
                    colorHex = "#ec4899"; // Pink
                    break;
                } else if (c.includes("DMPIN") || c.includes("MPINS") || c.includes("MPI")) {
                    finalCode = c.includes("DMPIN") ? "DMPIN" : "MPI";
                    colorHex = "#ef4444"; // Red
                    break;
                } else if (c.includes("RMGI") || c.includes("DMGI") || c.includes("MGROW")) {
                    finalCode = c.includes("RMGI") ? "RMGI" : c.includes("DMGI") ? "DMGI" : "MGROW";
                    colorHex = "#84cc16"; // Lime
                    break;
                } else if (c.includes("RSCOR") || c.includes("RSEAB") || c.includes("DSCOU") || c.includes("SCOUR")) {
                    finalCode = c.includes("RSCOR") || c.includes("RSEAB") ? "RSCOR" : c.includes("DSCOU") ? "DSCOU" : "SCOUR";
                    colorHex = "#14b8a6"; // Teal
                    break;
                } else if (c.includes("RRISI") || c.includes("DRRISI") || c.includes("DJTISI") || c.includes("DITISI") || c.includes("RISER")) {
                    finalCode = c.includes("RRISI") ? "RRISI" : c.includes("DRRISI") ? "DRRISI" : "RISER";
                    colorHex = "#ea580c"; // Orange
                    break;
                } else if (c.includes("COR") || c.includes("WELD")) {
                    finalCode = "WELD";
                    colorHex = "#ec4899"; // Pink
                    break;
                }
            }

            if (selectedPriorityFilter) {
                const sel = selectedPriorityFilter.toUpperCase();
                const matchesFilter = 
                    selectedPriorityFilter === finalCode ||
                    (sel === "GVI" && (finalCode === "GVINS" || finalCode === "RGVIN" || finalCode === "DGVIN")) ||
                    (sel === "CVI" && (finalCode === "CVINS" || finalCode === "RCVIN" || finalCode === "DCVIN")) ||
                    (sel === "FMD" && (finalCode === "FMD" || finalCode === "RFMD" || finalCode === "DFMD")) ||
                    (sel === "UT" && (finalCode === "UTWTK" || finalCode === "RUTWT" || finalCode === "DUTWT")) ||
                    (sel === "CP" && (finalCode === "CPSURV" || finalCode === "RCPSU" || finalCode === "DCPSU")) ||
                    (sel === "ANODE" && (finalCode === "ANODE" || finalCode === "RSANI" || finalCode === "DSANI")) ||
                    (sel === "SZONE" && (finalCode === "SZONE" || finalCode === "RSZCI" || finalCode === "DSZCI")) ||
                    (sel === "ACFM" && (finalCode === "ACFM" || finalCode === "RACFM" || finalCode === "DACFM")) ||
                    (sel === "MPI" && (finalCode === "MPI" || finalCode === "DMPIN")) ||
                    (sel === "MGROW" && (finalCode === "MGROW" || finalCode === "RMGI" || finalCode === "DMGI")) ||
                    (sel === "SCOUR" && (finalCode === "SCOUR" || finalCode === "RSCOR" || finalCode === "DSCOU")) ||
                    (sel === "RISER" && (finalCode === "RISER" || finalCode === "RRISI" || finalCode === "DRRISI"));

                if (!matchesFilter) return "#1e293b";
            }

            return colorHex;
        }

        case "HISTORICAL_COMPARE": {
            const checkAnomaly = (r: any) => {
                const ft = String(r.finding_type || r.findingType || r.record_category || r.category || "").toUpperCase();
                return ft === "ANOMALY" || ft.includes("ANOMALY") || Boolean(r.is_anomaly) || Boolean(r.has_anomaly) || Boolean(r.anomaly_class);
            };
            const hasCurrentAnomaly = compCurrentRecords.some(checkAnomaly);
            const hasHistAnomaly = compHistRecords.some(checkAnomaly);

            let finalCode = "UNINS";
            let colorHex = "#64748b";

            if (compareWithCurrent) {
                if (hasCurrentAnomaly && !hasHistAnomaly) {
                    finalCode = "NEW_ANOMALY";
                    colorHex = "#ef4444"; // Red
                } else if (hasCurrentAnomaly && hasHistAnomaly) {
                    finalCode = "PERSISTENT";
                    colorHex = "#eab308"; // Amber
                } else if (!hasCurrentAnomaly && hasHistAnomaly) {
                    finalCode = "RECTIFIED";
                    colorHex = "#06b6d4"; // Cyan
                } else if (compHistRecords.length > 0 || compCurrentRecords.length > 0) {
                    finalCode = "CLEAN";
                    colorHex = "#10b981"; // Emerald
                }
            } else {
                if (hasHistAnomaly) {
                    finalCode = "HIST_ANOMALY";
                    colorHex = "#ef4444";
                } else if (compHistRecords.length > 0) {
                    finalCode = "CLEAN";
                    colorHex = "#10b981";
                }
            }

            if (selectedPriorityFilter) {
                const sel = selectedPriorityFilter.toUpperCase();
                const isMatch = selectedPriorityFilter === finalCode ||
                    (sel.includes("NEW") && finalCode === "NEW_ANOMALY") ||
                    (sel.includes("RECT") && finalCode === "RECTIFIED") ||
                    (sel.includes("PERSIST") && finalCode === "PERSISTENT") ||
                    (sel.includes("HIST") && finalCode === "HIST_ANOMALY") ||
                    (sel.includes("CLEAN") && finalCode === "CLEAN") ||
                    (sel.includes("UNINS") && finalCode === "UNINS");

                if (!isMatch) return "#1e293b";
            }

            return colorHex;
        }

        default:
            return defaultColor;
    }
}

export function Structural3DViewer({
    components: rawComponents,
    platformDetails,
    elevations = [],
    faces = [],
    selectedCompId,
    onSelectComponent,
    onSync,
    isSyncing = false,
    useWincairsMode = false,
    wincairsParams = [],
    onFallbackComponentsChange,
    webapp3dData,
    compactMode = false,
    isInspectionWorkspace = false,
    currentRecords = [],
    historicalRecords = [],
    activeColorMode: externalColorMode = "DEFAULT",
    selectedHistoricalCampaignId: externalCampaignId = "ALL"
}: Structural3DViewerProps) {
    const isWorkspace = Boolean(
        isInspectionWorkspace || 
        compactMode || 
        (currentRecords && currentRecords.length > 0)
    );
    const wincairsParamsMap = useMemo(() => {
        const map = new Map<number, any>();
        if (wincairsParams && Array.isArray(wincairsParams)) {
            wincairsParams.forEach((param: any) => {
                if (param.comp_id) {
                    map.set(Number(param.comp_id), param);
                }
            });
        }
        return map;
    }, [wincairsParams]);

    const components = useMemo(() => {
        const excludeCodes = ["IT", "FV", "HS", "GP", "PG", "PC", "RB", "SD", "FA"];
        return rawComponents.filter((c) => {
            const code = (c.code || "").trim().toUpperCase();
            const qIdUpper = (c.q_id || "").toUpperCase();

            // Whitelist riser supports/clamps — never exclude them
            const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL" || code === "RC" || code.includes("CLAM");

            if ((excludeCodes.includes(code) || code.startsWith("FA") || code.includes("FACE")) && !isRiserSupport) {
                return false;
            }

            // Exclude FACE components like FACE A1-A4
            if (qIdUpper.startsWith("FACE") || /^FACE[\s\-]/i.test(qIdUpper)) {
                return false;
            }

            // Exclude intermediate member seam welds (keep only primary junction node welds)
            if (code === "WN") {
                const md = c.metadata || c;
                const sNode = (md.s_node || "").toString().trim().toUpperCase();
                const fNode = (md.f_node || "").toString().trim().toUpperCase();
                if (sNode && fNode && sNode !== fNode) return false;
            }

            // Exclude fender support components like FEND 1-SUPP-A2 / FEND x-SUPP-xx
            if (/^FEND\s+\d+-SUPP-/i.test(qIdUpper)) {
                return false;
            }
            // Exclude components whose q_id ends with TERM
            if (qIdUpper.endsWith("TERM")) {
                return false;
            }
            return true;
        });
    }, [rawComponents]);

    const isDirectClickRef = useRef(false);
    const [showGrid, setShowGrid] = useState(true);
    const [isInspectionMode, setIsInspectionMode] = useState(false);
    const [resetTrigger, setResetTrigger] = useState(0);
    const [showWater, setShowWater] = useState(true);
    const [showWeldNumbering, setShowWeldNumbering] = useState(true);
    const [showElevations, setShowElevations] = useState(true);
    const [isCameraClose, setIsCameraClose] = useState(false);
    const [selectedElevations, setSelectedElevations] = useState<number[]>([]);
    const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<"elevation" | "face" | "display" | "inspection" | "colormap" | null>(null);
    const [colorMode, setColorMode] = useState<VisualizationMode>(externalColorMode);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | number>(externalCampaignId);
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string | null>(null);
    const [libraryColors, setLibraryColors] = useState<Record<string, string>>({});
    const [libraryPriorityList, setLibraryPriorityList] = useState<Array<{ code: string; label: string; color: string }>>([]);
    const [inspectionModeFilter, setInspectionModeFilter] = useState<"BOTH" | "ROV" | "DIVING">("BOTH");
    const [priorityScope, setPriorityScope] = useState<"BOTH" | "ANOMALY" | "FINDING">("BOTH");
    const [structureJobpacks, setStructureJobpacks] = useState<Array<{ id: string | number; label: string; year?: string; mode?: string }>>([]);
    const [compareWithCurrent, setCompareWithCurrent] = useState(true);

    const updateStructureJobpacksIfChanged = (newList: Array<{ id: string | number; label: string; year?: string; mode?: string }>) => {
        setStructureJobpacks((prev) => {
            if (prev.length === newList.length && prev.every((item, idx) => String(item.id) === String(newList[idx]?.id))) {
                return prev;
            }
            return newList;
        });
    };

    // Fetch and aggregate jobpacks strictly by structure_id registered in the jobpack (Inspection Workspace only)
    useEffect(() => {
        if (!isWorkspace) return;

        let isMounted = true;
        let activeStructureId = "";

        if (platformDetails?.id) activeStructureId = String(platformDetails.id);
        else if (platformDetails?.structure_id) activeStructureId = String(platformDetails.structure_id);
        else if (platformDetails?.platform_id) activeStructureId = String(platformDetails.platform_id);
        else if (webapp3dData?.structure_id) activeStructureId = String(webapp3dData.structure_id);

        if (!activeStructureId && currentRecords && currentRecords.length > 0) {
            const firstRec = currentRecords.find((r: any) => r.structure_id || r.platform_id);
            if (firstRec) {
                activeStructureId = String(firstRec.structure_id || firstRec.platform_id || "");
            }
        }

        const map = new Map<string, { id: string | number; label: string; year?: string; mode?: string }>();

        const formatName = (jp: any): string => {
            const name = (
                jp.jobpack_name || 
                jp.name || 
                jp.title || 
                jp.campaign_name || 
                jp.jobpack_no || 
                jp.description || 
                ""
            ).toString().trim();

            if (name) return name;
            return "Inspection Campaign";
        };

        // Strict matcher: matches strictly by structure_id registered in column or metadata.structures JSON
        const isJobpackForStructureId = (jp: any): boolean => {
            if (!activeStructureId) return false;
            const targetClean = String(activeStructureId).replace(/^(platform|pipeline)-/, "");

            // 1. Direct structure_id or platform_id column
            const jpStructId = String(jp.structure_id || jp.platform_id || "").replace(/^(platform|pipeline)-/, "");
            if (jpStructId && jpStructId !== "0" && jpStructId !== "null") {
                if (jpStructId === targetClean) return true;
            }

            // 2. Structures array inside jobpack metadata (assigned in Jobpack Wizard)
            const structures = (jp.metadata as any)?.structures || jp.structures || [];
            if (Array.isArray(structures) && structures.length > 0) {
                return structures.some((s: any) => {
                    const sid = String(s.id || s.structure_id || s.platform_id || "").replace(/^(platform|pipeline)-/, "");
                    return sid === targetClean;
                });
            }

            return false;
        };

        // Process historical records specific to this active structure ID
        (historicalRecords || []).forEach((r: any) => {
            const rStructId = String(r.structure_id || r.platform_id || "");
            if (activeStructureId && rStructId && rStructId !== activeStructureId) {
                return;
            }

            const id = String(r.jobpack_id || r.campaign_id || r.jobpack_no || r.jobpack_name || "");
            if (id && !map.has(id)) {
                const name = formatName(r);
                const year = r.year || r.year_inspected || "";
                const label = year && !name.includes(String(year)) ? `[${year}] ${name}` : name;
                map.set(id, { id, label, year: String(year), mode: r.mode });
            }
        });

        // Fetch API jobpacks strictly for active structure ID
        if (activeStructureId) {
            fetch(`/api/jobpack?structure_id=${activeStructureId}&limit=1000`)
                .then(res => res.json())
                .then(json => {
                    if (!isMounted) return;
                    const items = json?.data || json?.jobpacks || (Array.isArray(json) ? json : []);
                    if (Array.isArray(items)) {
                        items.forEach((jp: any) => {
                            if (!isJobpackForStructureId(jp)) return;

                            const id = String(jp.id || jp.jobpack_no || jp.jobpack_id || "");
                            if (!id) return;

                            const name = formatName(jp);
                            const year = jp.year || jp.year_inspected || (jp.created_at ? new Date(jp.created_at).getFullYear() : "");
                            const label = year && !name.includes(String(year)) ? `[${year}] ${name}` : name;

                            if (!map.has(id)) {
                                map.set(id, { id, label, year: String(year), mode: jp.mode || jp.campaign_mode });
                            }
                        });
                    }

                    const list = Array.from(map.values());
                    if (isMounted) {
                        updateStructureJobpacksIfChanged(list);
                        if (list.length > 0 && (!selectedCampaignId || selectedCampaignId === "ALL")) {
                            setSelectedCampaignId(list[0].id);
                        }
                    }
                })
                .catch(() => {
                    if (!isMounted) return;
                    const list = Array.from(map.values());
                    updateStructureJobpacksIfChanged(list);
                });
        } else {
            const list = Array.from(map.values());
            if (isMounted) {
                updateStructureJobpacksIfChanged(list);
            }
        }

        return () => {
            isMounted = false;
        };
    }, [isWorkspace, platformDetails, webapp3dData, historicalRecords, currentRecords]);

    // Detect campaign mode (ROV vs DIVING) dynamically from current inspection records
    const campaignTaskMode = useMemo(() => {
        if (!currentRecords || currentRecords.length === 0) return "GENERAL";
        let rovCount = 0;
        let divCount = 0;
        currentRecords.forEach((r: any) => {
            const code = String(r.inspection_type_code || r.inspection_type?.code || r.task_code || "").toUpperCase();
            const rMode = String(r.mode || r.campaign_mode || r.jobpack_mode || r.inspection_mode || "").toUpperCase();
            if (rMode.includes("ROV") || rMode === "R" || (code.startsWith("R") && code !== "RISER") || code.includes("ROV")) rovCount++;
            if (rMode.includes("DIV") || rMode === "D" || (code.startsWith("D") && code !== "DEBRIS") || code.includes("DIV")) divCount++;
        });
        if (rovCount > 0 && divCount === 0) return "ROV";
        if (divCount > 0 && rovCount === 0) return "DIVING";
        if (rovCount > 0 && divCount > 0) return "MIXED";
        return "GENERAL";
    }, [currentRecords]);

    // Automatically set default inspection mode filter to active campaign mode (ROV or DIVING)
    useEffect(() => {
        if (campaignTaskMode === "ROV") {
            setInspectionModeFilter("ROV");
        } else if (campaignTaskMode === "DIVING") {
            setInspectionModeFilter("DIVING");
        } else if (campaignTaskMode === "MIXED" || campaignTaskMode === "GENERAL") {
            setInspectionModeFilter("BOTH");
        }
    }, [campaignTaskMode]);

    // Fetch priority colors directly from library endpoint
    useEffect(() => {
        let isMounted = true;
        fetch('/api/library/combo/ANMLYCLR')
            .then(res => res.json())
            .then(json => {
                if (!isMounted) return;
                if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
                    const map: Record<string, string> = {};
                    const list: Array<{ code: string; label: string; color: string }> = [];
                    const seenCodes = new Set<string>();

                    json.data.forEach((item: any) => {
                        // Skip deleted items
                        if (item.lib_delete === 1 || item.lib_delete === "1" || item.lib_delete === true) return;
                        if (!item.code_1 || !item.code_2) return;

                        let col = String(item.code_2).trim();
                        if (!col || col === "undefined" || col === "null") return;

                        if (col.includes(",")) {
                            const parts = col.split(",").map((n: string) => parseInt(n.trim()));
                            if (parts.length === 3 && !parts.some(isNaN)) {
                                col = `#${parts[0].toString(16).padStart(2, "0")}${parts[1].toString(16).padStart(2, "0")}${parts[2].toString(16).padStart(2, "0")}`;
                            }
                        }
                        if (!col.startsWith("#") && !col.startsWith("rgb")) {
                            col = `#${col}`;
                        }

                        // Validate hex color string format (e.g. #ef4444 or rgb(...))
                        if (!/^#([0-9A-F]{3}){1,2}$/i.test(col) && !col.startsWith("rgb")) return;

                        const rawCode = String(item.code_1).trim();
                        const codeUpper = rawCode.toUpperCase();
                        map[codeUpper] = col;

                        // Deduplicate by priority code so each priority appears ONCE
                        if (!seenCodes.has(codeUpper)) {
                            seenCodes.add(codeUpper);
                            const label = item.name_1 || item.code_1_desc || item.description || rawCode;
                            list.push({
                                code: codeUpper,
                                label: label,
                                color: col
                            });
                        }
                    });

                    if (isMounted) {
                        setLibraryColors(map);
                        if (list.length > 0) {
                            setLibraryPriorityList(list);
                        }
                    }
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, []);

    // Reset single priority filter whenever visualization mode changes
    useEffect(() => {
        setSelectedPriorityFilter(null);
    }, [colorMode]);

    // Sync external props if changed
    useEffect(() => {
        if (externalColorMode) setColorMode(externalColorMode);
    }, [externalColorMode]);

    useEffect(() => {
        if (externalCampaignId) setSelectedCampaignId(externalCampaignId);
    }, [externalCampaignId]);
    const [isActivated, setIsActivated] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    const [selectedInspectionFilters, setSelectedInspectionFilters] = useState<Array<"NOT_INSPECTED" | "NO_ANOMALY" | "HAS_ANOMALY">>([
        "NOT_INSPECTED",
        "NO_ANOMALY",
        "HAS_ANOMALY"
    ]);

    const handleActivate = () => {
        setIsActivating(true);
        setTimeout(() => {
            setIsActivated(true);
            setIsActivating(false);
        }, 1200);
    };

    // Helper to sanitize elevation typos
    const sanitizeElevation = (elvVal: any): number => {
        if (elvVal === undefined || elvVal === null) return 0;
        let val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
        if (isNaN(val)) return 0;
        if (val === 50.772) return -50.772; // Fix 50m spike typo
        if (val < -1000) return val / 1000; // Fix -21424m typo
        return val;
    };



    // Derived level markers from real elevation data
    const { seabedY, waterSurfaceY, waterDepth } = useMemo(() => {
        const elvValues = elevations.map((e) => sanitizeElevation(e.elv));
        // Lowest elevation minus a 5m buffer = seabed
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;
        const seabedY = minElv - 5;
        // Water surface is always MSL = 0
        const waterSurfaceY = 0;
        // Water column depth from surface to seabed
        const waterDepth = Math.abs(waterSurfaceY - seabedY);
        return { seabedY, waterSurfaceY, waterDepth };
    }, [elevations]);

    const availableFaces = useMemo(() => {
        return Array.from(new Set(faces.map((f) => f.face).filter(Boolean)));
    }, [faces]);


    // USE WEBAPP_3D DATABASE OR FALLBACK TO FRONTEND PROCEDURAL MATH
    const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {
        if (!webapp3dData) {
            if (!platformDetails || !elevations || !faces || !components) return { componentLayouts: [], foundationMembers: [], elvMarkers: [] };
            
            // Fallback to frontend procedural math
            return generatePlatform3DCoordinates(platformDetails, elevations, faces, components);
        }

        const layouts = (webapp3dData.components || []).map((dbItem: any) => {
            const dbCompRaw = dbItem.component || dbItem.structure_components || dbItem.originalComp || {};
            const dbCompQId = dbCompRaw.q_id || dbCompRaw.name || dbItem.q_id;
            const dbQIdUpper = String(dbCompQId || "").toUpperCase().trim();
            const dbCode = String(dbItem.code || dbCompRaw.code || "").toUpperCase().trim();
            const dbCompIdStr = String(dbItem.component_id || dbItem.comp_id || dbCompRaw.id || dbItem.id || "").trim();
            
            let comp: any = null;

            // 1. If dbCompRaw already has a valid QID, match directly by ID or exact QID in rawComponents
            if (dbCompQId && !String(dbCompQId).startsWith("COMP-")) {
                comp = rawComponents.find((c: any) => {
                    const cId = c.id || c.comp_id;
                    const dbId = dbCompRaw.id || dbCompRaw.comp_id || dbItem.component_id || dbItem.comp_id;
                    if (cId && dbId && String(cId) === String(dbId)) return true;
                    const cQId = String(c.q_id || c.name || "").toUpperCase().trim();
                    if (cQId && dbQIdUpper && cQId === dbQIdUpper) return true;
                    return false;
                }) || dbCompRaw;
            }

            // 2. Otherwise fallback to direct ID or exact QID match
            if (!comp) {
                comp = rawComponents.find((c: any) => {
                    const cRaw = c.raw || c;
                    const cIdStr = String(c.id || c.comp_id || cRaw.id || cRaw.comp_id || "").trim();
                    const cQIdUpper = String(c.q_id || c.name || cRaw.q_id || cRaw.name || "").toUpperCase().trim();

                    if (cIdStr && dbCompIdStr && cIdStr === dbCompIdStr) return true;
                    if (cQIdUpper && dbQIdUpper && dbQIdUpper !== dbCode && cQIdUpper === dbQIdUpper) return true;

                    return false;
                }) || dbCompRaw || dbItem;
            }

            const q_id = comp.q_id || dbItem.q_id || dbItem.structure_components?.q_id || `COMP-${dbItem.component_id}`;
            const code = (comp.code || dbItem.code || dbItem.structure_components?.code || "").toUpperCase();
            const qIdUpper = q_id.toUpperCase();

            const isPile = code === "PL" || code === "PILE" || code === "P" || qIdUpper.includes("PILE") || dbQIdUpper.includes("PILE");
            const isCaissonSupport = (code === "WP" || code === "CL" || qIdUpper.includes("SUPP") || qIdUpper.includes("CLP")) && (qIdUpper.includes("CS-") || qIdUpper.includes("CAIS"));
            const isRiserSupport = (qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL" || code === "RC" || code.includes("CLAM")) && !isCaissonSupport;
            const isClamp = (code === "CL" || code === "RC" || code.includes("CLAM") || isRiserSupport) && !isCaissonSupport;
            const isWeld = (code === "WN" || (code === "WP" && !isRiserSupport && !isClamp) || code.includes("WELD")) && !isClamp;

            const compMd = comp.metadata || dbItem.metadata || {};
            const sLegStr = (comp.s_leg || compMd.s_leg || dbItem.s_leg || "").toString().trim().toUpperCase();
            const fLegStr = (comp.f_leg || compMd.f_leg || dbItem.f_leg || "").toString().trim().toUpperCase();
            const isLegComponent = code.includes("LG") || qIdUpper.includes("LEG") || dbQIdUpper.includes("LEG") || (sLegStr && sLegStr !== "N/A") || (fLegStr && fLegStr !== "N/A");
            const isMainLegWeld = isWeld && isLegComponent;

            const weldColor = isWeld ? "#cbd5e1" : null;
            const clampColor = isClamp ? "#facc15" : null;
            const finalColor = isInspectionMode ? dbItem.inspection_color : (clampColor || weldColor || dbItem.color_hex || "#64748b");

            let startVec = (dbItem.start_x !== undefined && dbItem.start_y !== undefined && dbItem.start_z !== undefined)
                ? [Number(dbItem.start_x), Number(dbItem.start_y), Number(dbItem.start_z)]
                : (dbItem.start || [Number(dbItem.pos_x || 0), Number(dbItem.pos_y || 0), Number(dbItem.pos_z || 0)]);

            let endVec = (dbItem.end_x !== undefined && dbItem.end_y !== undefined && dbItem.end_z !== undefined)
                ? [Number(dbItem.end_x), Number(dbItem.end_y), Number(dbItem.end_z)]
                : (dbItem.end || [Number(dbItem.pos_x || 0), Number(dbItem.pos_y || 0), Number(dbItem.pos_z || 0)]);

            if (isPile && Math.abs(startVec[1] - endVec[1]) < 0.1) {
                endVec = [startVec[0], startVec[1] - 2.0, startVec[2]];
            }

            const enrichedComp = { ...dbItem, ...comp, code, q_id };

            const isInspected = Boolean(dbItem.is_inspected);
            const hasAnomaly = Boolean(dbItem.has_anomaly);
            const inspectionStatus = hasAnomaly
                ? "HAS_ANOMALY"
                : isInspected
                    ? "NO_ANOMALY"
                    : "NOT_INSPECTED";

            // Clamps get riser-sized thickness so ComponentMesh renders them properly
            const clampThickness = isClamp ? 0.3 : null;
            const defaultThickness = isWeld ? 0.25 : isPile ? 0.2 : 0.5;

            return {
                id: dbItem.component_id,
                q_id: q_id,
                type: dbItem.shape_type,
                code: code,
                start: startVec,
                end: endVec,
                position: [dbItem.pos_x || 0, dbItem.pos_y || 0, dbItem.pos_z || 0],
                rotation: [dbItem.rot_x || 0, dbItem.rot_y || 0, dbItem.rot_z || 0],
                scale: [dbItem.scale_x || 1, dbItem.scale_y || 1, dbItem.scale_z || 1],
                color: finalColor,
                thickness: clampThickness || dbItem.thickness || dbItem.dimensions?.radius || defaultThickness,
                length: dbItem.dimensions?.length || 1,
                offsetDistance: dbItem.dimensions?.offset || 0,
                shape: dbItem.shape_type,
                renderMesh: dbItem.visibility_flag,
                hasGeometryIssue: dbItem.has_geometry_issue,
                is_inspected: isInspected,
                has_anomaly: hasAnomaly,
                inspectionStatus: inspectionStatus,
                originalComp: enrichedComp,
                component: enrichedComp
            };
        });

        return {
            componentLayouts: layouts,
            foundationMembers: webapp3dData.foundationMembers || [],
            elvMarkers: webapp3dData.elvMarkers || []
        };
    }, [webapp3dData, rawComponents, isInspectionMode]);

    const availableElevations = useMemo(() => {
        const values = elevations.map((e) => sanitizeElevation(e.elv));
        if (values.length === 0 && componentLayouts.length > 0) {
            componentLayouts.forEach((l: any) => {
                const y1 = l.start ? l.start[1] : (l.position ? l.position[1] : null);
                const y2 = l.end ? l.end[1] : (l.position ? l.position[1] : null);
                if (y1 !== null && y2 !== null && Math.abs(y1 - y2) < 0.1) {
                    values.push(Number(y1.toFixed(2)));
                }
            });
        }
        return Array.from(new Set(values.map(v => Number(v.toFixed(2))))).sort((a, b) => b - a);
    }, [elevations, componentLayouts]);

    const getLegEndpoints = (layout: any) => {
        const compObj = layout.component || layout.originalComp || layout.structure_components || {};
        const md = compObj.metadata || layout.metadata || compObj || {};

        let sLeg = (md.s_leg || compObj.s_leg || layout.s_leg || md.leg || compObj.leg || "").toString().toUpperCase().trim();
        let fLeg = (md.f_leg || compObj.f_leg || layout.f_leg || "").toString().toUpperCase().trim();

        // If sLeg/fLeg are missing, check s_node / f_node for leg patterns (e.g. "A1-N42" or "A1")
        if (!sLeg) {
            const sNode = (md.s_node || compObj.s_node || "").toString().toUpperCase().trim();
            const m = sNode.match(/([A-Z]+\d+)/);
            if (m) sLeg = m[1];
        }
        if (!fLeg) {
            const fNode = (md.f_node || compObj.f_node || "").toString().toUpperCase().trim();
            const m = fNode.match(/([A-Z]+\d+)/);
            if (m) fLeg = m[1];
        }

        // Fallback: search q_id for leg tokens (e.g. A1, A2, B1, B2)
        const qId = (layout.q_id || compObj.q_id || md.q_id || layout.id || "").toString().toUpperCase().trim();
        if (!sLeg || !fLeg) {
            const legsInQId = qId.match(/\b([A-Z]+\d+)\b/g);
            if (legsInQId && legsInQId.length >= 1) {
                if (!sLeg) sLeg = legsInQId[0];
                if (!fLeg && legsInQId.length >= 2) fLeg = legsInQId[1];
            }
        }

        const compFace = (md.face || compObj.face || layout.face || "").toString().toUpperCase().trim();

        return { sLeg, fLeg, compFace, qId, compObj, md };
    };

    const isComponentOnFace = (layout: any, faceName: string) => {
        const fUpper = faceName.toUpperCase().trim();
        const cleanFace = fUpper.replace(/^ROW\s*|^FACE\s*/i, "").trim();

        const { sLeg, fLeg, compFace, qId } = getLegEndpoints(layout);

        // 1. Explicit Component Specifications FACE Field Check (if specified)
        if (compFace) {
            const compFacesArray = compFace.split(',').map((f: string) => f.trim()).filter(Boolean);
            
            const isMatch = compFacesArray.some((cf: string) => {
                const cleanCompFace = cf.replace(/^ROW\s*|^FACE\s*/i, "").trim();
                return cf === fUpper || cleanCompFace === cleanFace || cf.includes(cleanFace) || fUpper.includes(cleanCompFace);
            });

            if (isMatch) {
                return true;
            } else {
                // Explicitly assigned to a different face -> hide component
                return false;
            }
        }

        // 2. Strict Row Letter match (e.g. "ROW A", "FACE A", "A") for unassigned components
        const rowMatch = fUpper.match(/^(?:ROW|FACE)\s*([A-Z]+)$/i) || fUpper.match(/^([A-Z]+)$/i);
        if (rowMatch) {
            const rowLetter = rowMatch[1].toUpperCase();

            if (sLeg && fLeg && sLeg !== fLeg) {
                if (sLeg.startsWith(rowLetter) && fLeg.startsWith(rowLetter)) return true;
                if (sLeg.startsWith(rowLetter) || fLeg.startsWith(rowLetter)) return false;
            } else if (sLeg || fLeg) {
                const singleLeg = sLeg || fLeg;
                if (singleLeg.startsWith(rowLetter)) return true;
            }
        }

        // 3. Strict Column Number match (e.g. "ROW 1", "FACE 1", "1") for unassigned components
        const colMatch = fUpper.match(/^(?:ROW|FACE)\s*(\d+)$/i) || fUpper.match(/^(\d+)$/i);
        if (colMatch) {
            const colNum = colMatch[1].toUpperCase();

            if (sLeg && fLeg && sLeg !== fLeg) {
                if (sLeg.endsWith(colNum) && fLeg.endsWith(colNum)) return true;
                if (sLeg.endsWith(colNum) || fLeg.endsWith(colNum)) return false;
            } else if (sLeg || fLeg) {
                const singleLeg = sLeg || fLeg;
                if (singleLeg.endsWith(colNum)) return true;
            }
        }

        // 4. Check str_faces object definition from DB
        const faceObj = faces.find(
            (f) => (f.face || "").toUpperCase().trim() === fUpper || (f.face || "").toUpperCase().trim() === cleanFace
        );
        if (faceObj) {
            const fromLeg = (faceObj.face_from || "").toUpperCase().trim();
            const toLeg = (faceObj.face_to || "").toUpperCase().trim();

            if (fromLeg && toLeg) {
                const sMatch = sLeg === fromLeg || sLeg === toLeg;
                const fMatch = fLeg === fromLeg || fLeg === toLeg;

                if (sLeg && fLeg && sLeg !== fLeg) {
                    if (sMatch && fMatch) return true;
                } else {
                    if (sMatch || fMatch) return true;
                }
            }
        }

        // 5. Composite leg pair face (e.g., "A1A3", "A1-A3", "A2B2")
        const pairTokens = fUpper.split(/[\s\-]/).filter(Boolean);
        if (pairTokens.length >= 2) {
            if (sLeg && fLeg && sLeg !== fLeg) {
                if (pairTokens.includes(sLeg) && pairTokens.includes(fLeg)) return true;
            } else {
                if (pairTokens.includes(sLeg) || pairTokens.includes(fLeg)) return true;
            }
        }

        // 6. Foundation member label check (e.g. leg-A1, face-ROW A-0)
        const labelUpper = (layout.label || layout.id || "").toUpperCase();
        if (labelUpper.startsWith("LEG-")) {
            const legName = labelUpper.replace("LEG-", "");
            if (rowMatch && legName.startsWith(rowMatch[1].toUpperCase())) return true;
            if (colMatch && legName.endsWith(colMatch[1].toUpperCase())) return true;
        }

        return false;
    };

    const filteredFoundationMembers = useMemo(() => {
        let members = foundationMembers;

        if (selectedElevations.length > 0) {
            members = members.filter((m: any) => {
                const isLeg = Boolean(m.label) || String(m.id || "").startsWith("leg-");
                if (isLeg) return true; // Leg indicators ALWAYS stay visible for ALL elevations when filtered!

                const y1 = m.start ? m.start[1] : 0;
                const y2 = m.end ? m.end[1] : 0;
                return selectedElevations.some((elv) => Math.abs(y1 - elv) <= 1.2 || Math.abs(y2 - elv) <= 1.2);
            });
        }

        if (selectedFaces.length > 0) {
            members = members.filter((m: any) => {
                const isLeg = Boolean(m.label) || String(m.id || "").startsWith("leg-");
                if (isLeg) return true; // Leg indicators ALWAYS stay visible even when filtering by face!
                return selectedFaces.some((face) => isComponentOnFace(m, face));
            });
        }

        return members;
    }, [foundationMembers, selectedElevations, selectedFaces, faces]);

    const filteredComponentLayouts = useMemo(() => {
        return componentLayouts.filter((layout: any) => {
            // 1. Elevation Filter
            if (selectedElevations.length > 0) {
                const startY = layout.start ? layout.start[1] : (layout.position ? layout.position[1] : 0);
                const endY = layout.end ? layout.end[1] : (layout.position ? layout.position[1] : 0);

                const matchesElev = selectedElevations.some((elv) => {
                    const isHorizontal = Math.abs(startY - endY) < 1.0;
                    const isPointObject = Math.abs(startY - endY) < 0.05;

                    if (isHorizontal && Math.abs(startY - elv) <= 1.2 && Math.abs(endY - elv) <= 1.2) {
                        return true;
                    }
                    if (isPointObject && Math.abs(startY - elv) <= 1.2) {
                        return true;
                    }
                    const code = (layout.code || "").toUpperCase();
                    const qId = (layout.q_id || "").toUpperCase();
                    if (code.includes("NODE") || qId.includes("NODE") || code === "ND") {
                        if (Math.abs(startY - elv) <= 1.2 || Math.abs(endY - elv) <= 1.2) return true;
                    }

                    const compElv = layout.component?.metadata?.elv || layout.originalComp?.metadata?.elv;
                    if (compElv !== undefined && Math.abs(sanitizeElevation(compElv) - elv) < 0.1) return true;

                    return false;
                });

                if (!matchesElev) return false;
            }

            // 2. Face Filter
            if (selectedFaces.length > 0) {
                const matchesFace = selectedFaces.some((face) => isComponentOnFace(layout, face));
                if (!matchesFace) return false;
            }

            return true;
        });
    }, [componentLayouts, selectedElevations, selectedFaces, faces]);

    const fallbackComponents = useMemo(() => {
        if (!useWincairsMode) return [];
        const wincairsRenderedIds = new Set<number>();
        componentLayouts.forEach((l: any) => {
            const comp = l.component || l.originalComp || { id: l.id };
            const compId = comp.id || l.id;
            const param = compId ? wincairsParamsMap.get(comp.comp_id || compId) : undefined;
            if (param && isFinite(Number(param.s_point3d_x))) {
                if (compId) wincairsRenderedIds.add(compId);
            }
        });
        return components.filter((c) => !wincairsRenderedIds.has(c.id));
    }, [components, componentLayouts, useWincairsMode, wincairsParamsMap]);

    const prevFallbackIdsRef = useRef<string>("");

    React.useEffect(() => {
        if (!onFallbackComponentsChange) return;

        const currentIdsStr = fallbackComponents
            .map((c) => c.id)
            .sort((a, b) => a - b)
            .join(",");

        if (prevFallbackIdsRef.current !== currentIdsStr) {
            prevFallbackIdsRef.current = currentIdsStr;
            onFallbackComponentsChange(fallbackComponents);
        }
    }, [fallbackComponents, onFallbackComponentsChange]);

    React.useEffect(() => {
        if (selectedCompId && !isActivated) {
            setIsActivated(true);
        }
    }, [selectedCompId, isActivated]);

    const [focusTargetPos, setFocusTargetPos] = useState<THREE.Vector3 | null>(null);
    const [focusedCompName, setFocusedCompName] = useState<string | null>(null);

    const selectedLayout = useMemo(() => {
        if (!selectedCompId) return null;
        return componentLayouts.find((l: any) =>
            l.id === selectedCompId ||
            l.component_id === selectedCompId ||
            l.component?.id === selectedCompId ||
            l.originalComp?.id === selectedCompId ||
            String(l.id) === String(selectedCompId) ||
            String(l.component?.id) === String(selectedCompId)
        );
    }, [componentLayouts, selectedCompId]);

    const selectedPos = useMemo(() => {
        if (!selectedLayout) return null;
        if (selectedLayout.start && selectedLayout.end) {
            return new THREE.Vector3(
                (selectedLayout.start[0] + selectedLayout.end[0]) / 2,
                (selectedLayout.start[1] + selectedLayout.end[1]) / 2,
                (selectedLayout.start[2] + selectedLayout.end[2]) / 2
            );
        }
        if (selectedLayout.position) {
            return new THREE.Vector3(selectedLayout.position[0], selectedLayout.position[1], selectedLayout.position[2]);
        }
        return null;
    }, [selectedLayout]);

    if (!isActivated) {
        return (
            <div className="w-full h-full min-h-[450px] relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col items-center justify-center p-8 transition-all duration-500">
                <style>{`
                  @keyframes loading-bar {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                `}</style>
                {/* Technical Blueprint Grid Pattern background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40 dark:opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 via-white/90 to-blue-50/40 dark:from-slate-950 dark:via-slate-900/90 dark:to-blue-950/40 pointer-events-none" />

                {isActivating ? (
                    /* SCANNING / TELEMETRY LOADING STATE */
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-md text-center animate-in fade-in zoom-in duration-500">
                        {/* Scanning Hologram Ring */}
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-4 border-indigo-500/10 border-b-indigo-500 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                            <Box className="w-10 h-10 text-blue-400 animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-[0.25em] text-blue-400 animate-pulse flex items-center justify-center gap-2">
                                <Radio className="h-4 w-4 animate-ping text-blue-500" />
                                Connecting Telemetry
                            </h3>
                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse delay-100">
                                    Allocating WebGL Buffer...
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse delay-300">
                                    Parsing {components.length} Structural Nodes...
                                </span>
                            </div>
                        </div>

                        {/* Fake Progress Bar */}
                        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 animate-[loading-bar_1.2s_ease-in-out_infinite]"
                                style={{ width: "60%" }}
                            />
                        </div>
                    </div>
                ) : (
                    /* DEFER ACTIVATION / INITIAL PLACEHOLDER */
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-8 max-w-xl text-center p-4">
                        {/* Top Decorative Tag */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] shadow-sm shadow-blue-500/5 animate-pulse">
                            <Compass className="w-3.5 h-3.5 stroke-[2] text-blue-400 animate-[spin_8s_linear_infinite]" />
                            3D Modeling Utility Ready
                        </div>

                        {/* Title & Info */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
                                {platformDetails?.title || "INTERACTIVE PLATFORM"}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider max-w-md mx-auto">
                                Run diagnostics, view elevations, and inspect structural jacket anodes/welds in
                                interactive 3D.
                            </p>
                        </div>

                        {/* Telemetry Stats Grid */}
                        <div className="grid grid-cols-3 gap-6 w-full max-w-md py-4 px-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 backdrop-blur-sm shadow-inner">
                            <div className="flex flex-col items-center justify-center text-center">
                                <span className="text-xl font-black text-blue-400 leading-none mb-1">
                                    {components.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Assets
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center border-x border-slate-800/80">
                                <span className="text-xl font-black text-indigo-400 leading-none mb-1">
                                    {availableElevations.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Elevations
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center">
                                <span className="text-xl font-black text-emerald-400 leading-none mb-1">
                                    {availableFaces.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Faces
                                </span>
                            </div>
                        </div>

                        {/* Action Trigger Card */}
                        <button
                            onClick={handleActivate}
                            className="group relative flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] border border-blue-400/30 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all duration-300 w-full max-w-sm overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-radial-gradient from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                                <Play className="w-5 h-5 fill-current text-white stroke-[1.5]" />
                            </div>

                            <span className="relative z-10 text-xs font-black uppercase tracking-[0.25em] text-white">
                                Load 3D Platform Model
                            </span>
                            <span className="relative z-10 text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1 opacity-80">
                                Click to initialize GPU rendering
                            </span>
                        </button>
                    </div>
                )}
            </div>
        );
    }



    return (
        <div className="w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 relative rounded-3xl overflow-hidden shadow-2xl">
            <div className="relative z-0 w-full h-full">
                <Canvas
                shadows="soft"
                gl={{ antialias: true }}
                dpr={[1, 2]}
                onPointerMissed={() => {
                    setFocusTargetPos(null);
                    setFocusedCompName(null);
                }}
                onCreated={({ gl }) => {
                    (window as any).renderer = gl;
                }}
            >
                <color attach="background" args={["#ffffff"]} />
                <fog attach="fog" args={["#ffffff", 40, 220]} />
                <PerspectiveCamera makeDefault position={[45, 45, 45]} fov={45} />
                <CameraRig selectedPos={selectedPos} isActivated={isActivated} isDirectClickRef={isDirectClickRef} focusTargetPos={focusTargetPos} />
                <OrbitControls makeDefault minDistance={5} maxDistance={100} maxPolarAngle={Math.PI / 2} />

                <ambientLight intensity={0.35} />
                <hemisphereLight intensity={0.3} color="#bae6fd" groundColor="#0f172a" />
                <directionalLight
                    position={[40, 80, 40]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-bias={-0.0001}
                    shadow-radius={6}
                    shadow-camera-near={1}
                    shadow-camera-far={250}
                    shadow-camera-left={-60}
                    shadow-camera-right={60}
                    shadow-camera-top={60}
                    shadow-camera-bottom={-60}
                />
                <spotLight position={[-40, 60, -40]} angle={0.3} penumbra={1} intensity={0.8} />


                <Bounds fit clip margin={1.0}>
                    <ResetViewHandler trigger={resetTrigger} />
                    <CameraDistanceController onChange={setIsCameraClose} />
                    <SelectToZoom>
                        {/* Elevation Level Planes & Markers */}
                        {showElevations && availableElevations.map((elvNum) => {
                            const isSelected = selectedElevations.includes(elvNum);
                            return (
                                <ElevationLevelPlane
                                    key={`elv-plane-${elvNum}`}
                                    y={elvNum}
                                    label={elvNum >= 0 ? `+${elvNum.toFixed(2)}m` : `${elvNum.toFixed(2)}m`}
                                    isSelected={isSelected}
                                    onToggleSelect={() => {
                                        if (isSelected) {
                                            setSelectedElevations((prev) => prev.filter((e) => e !== elvNum));
                                        } else {
                                            setSelectedElevations((prev) => [...prev, elvNum]);
                                        }
                                    }}
                                />
                            );
                        })}

                        {/* Foundation Members (Skeleton) */}
                        {filteredFoundationMembers.map((m: any, fIdx: number) => (
                            <FoundationMember
                                key={`fm-${m.id || "item"}-${fIdx}`}
                                start={m.start}
                                end={m.end}
                                thickness={m.thickness}
                                color={m.color}
                                label={m.label}
                                showLabel={m.start[1] !== m.end[1]}
                                renderMesh={m.renderMesh}
                                activeElevations={selectedElevations}
                            />
                        ))}

                        {/* High-Performance Instanced GPU Component Renderer */}
                        <InstancedComponentViewer
                            layouts={filteredComponentLayouts}
                            selectedCompId={selectedCompId}
                            onSelectComponent={onSelectComponent}
                            onDoubleClickComponent={(comp, centerPos) => {
                                setFocusTargetPos(centerPos);
                                setFocusedCompName(comp?.q_id || comp?.code || "Component");
                                onSelectComponent(comp);
                            }}
                            isDirectClickRef={isDirectClickRef}
                            showWeldNumbering={showWeldNumbering}
                            isInspectionMode={isInspectionMode}
                            selectedInspectionFilters={selectedInspectionFilters}
                            colorMode={colorMode}
                            currentRecords={currentRecords}
                            historicalRecords={historicalRecords}
                            selectedCampaignId={selectedCampaignId}
                            libraryColors={libraryColors}
                            selectedPriorityFilter={selectedPriorityFilter}
                            inspectionModeFilter={inspectionModeFilter}
                            priorityScope={priorityScope}
                            compareWithCurrent={compareWithCurrent}
                        />
                    </SelectToZoom>
                </Bounds>

                {/* Environment Planes - Outside Bounds to prevent zooming out */}
                {showWater && (
                    <group>
                        {/* Sea Surface plane at MSL (y=0) */}
                        <mesh
                            rotation={[-Math.PI / 2, 0, 0]}
                            position={[0, waterSurfaceY, 0]}
                            receiveShadow={false}
                        >
                            <planeGeometry args={[2000, 2000]} />
                            <meshStandardMaterial
                                color="#38bdf8"
                                transparent
                                opacity={0.35}
                                metalness={0.6}
                                roughness={0.2}
                                depthWrite={false}
                            />
                        </mesh>

                        {/* Seabed floor plane, positioned below lowest elevation */}
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, seabedY, 0]} receiveShadow={false}>
                            <planeGeometry args={[2000, 2000]} />
                            <meshStandardMaterial
                                color="#78350f"
                                transparent
                                opacity={0.85}
                                metalness={0.1}
                                roughness={0.9}
                                depthWrite={false}
                            />
                        </mesh>

                        {/* Seabed label */}
                        <group position={[0, seabedY, 0]}>
                            <Html position={[35, 1, 0]} center distanceFactor={20} zIndexRange={[10, 0]}>
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] w-8 bg-amber-600/60" />
                                    <div className="px-2 py-0.5 bg-amber-900/80 backdrop-blur text-[9px] font-black text-amber-300 rounded border border-amber-600/40 shadow-lg whitespace-nowrap uppercase tracking-widest">
                                        Seabed · {seabedY.toFixed(1)}m
                                    </div>
                                </div>
                            </Html>
                        </group>

                        {/* Water line label at MSL */}
                        <group position={[0, waterSurfaceY, 0]}>
                            <Html position={[35, 1, 0]} center distanceFactor={20} zIndexRange={[10, 0]}>
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] w-8 bg-sky-400/60" />
                                    <div className="px-2 py-0.5 bg-sky-900/80 backdrop-blur text-[9px] font-black text-sky-300 rounded border border-sky-500/40 shadow-lg whitespace-nowrap uppercase tracking-widest">
                                        MSL · 0.0m
                                    </div>
                                </div>
                            </Html>
                        </group>
                    </group>
                )}

                {showGrid && (
                    <Grid
                        infiniteGrid
                        fadeDistance={250}
                        sectionSize={10}
                        sectionColor="#451a03"
                        cellColor="#78350f"
                        cellThickness={0.8}
                        sectionThickness={1.2}
                        position={[0, seabedY + 0.1, 0]}
                    />
                )}

                <ContactShadows
                    resolution={512}
                    scale={150}
                    blur={2.5}
                    opacity={0.5}
                    far={80}
                    color="#0f172a"
                    position={[0, seabedY + 0.05, 0]}
                />
            </Canvas>
            </div>

            {/* Camera Focus Lock Badge Indicator */}
            {focusTargetPos && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 animate-in fade-in zoom-in duration-300 pointer-events-auto">
                    <button
                        onClick={() => {
                            setFocusTargetPos(null);
                            setFocusedCompName(null);
                        }}
                        className="px-4 py-2 rounded-full bg-blue-600/95 hover:bg-blue-700 text-white text-xs font-bold shadow-2xl border border-blue-400 backdrop-blur transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Camera Focused: <strong className="text-blue-100">{focusedCompName || "Component"}</strong></span>
                        <span className="text-[10px] bg-blue-950/80 text-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold border border-blue-400/30">Click to Unlock</span>
                    </button>
                </div>
            )}






            {/* Click-outside backdrop */}
            {openDropdown && (
                <div
                    className="absolute inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setOpenDropdown(null)}
                />
            )}

            <div className={cn("absolute z-50 flex items-center flex-wrap justify-end", compactMode ? "top-2 right-2 gap-1.5 max-w-[95%]" : "top-6 right-6 gap-3")}>
                {/* Sync / Re-sync 3D Cache Button */}
                {onSync && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onSync}
                        disabled={isSyncing}
                        className={cn(
                            "bg-white/90 backdrop-blur-md border border-slate-200 text-slate-500 hover:text-slate-800 transition-all shadow-sm flex items-center justify-center",
                            compactMode ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-xl",
                            isSyncing && "border-blue-200 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                        )}
                        title="Re-sync & Recreate 3D Model Cache"
                    >
                        <RefreshCw className={cn(compactMode ? "h-3.5 w-3.5" : "h-4 w-4", isSyncing && "animate-spin")} />
                    </Button>
                )}

                {/* 3D Color Overlay & Historical Comparison Filter - Inspection Workspace Only */}
                {isWorkspace && (
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpenDropdown(openDropdown === "colormap" ? null : "colormap")}
                            className={cn(
                                "bg-white/90 backdrop-blur-md transition-all font-black uppercase tracking-widest flex items-center gap-1.5",
                                compactMode ? "h-8 px-2.5 rounded-lg text-[9px]" : "h-9 px-4 rounded-xl text-[10px]",
                                colorMode !== "DEFAULT"
                                    ? "border-amber-500 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-amber-50/80"
                                    : "border-slate-200 text-slate-600 hover:text-slate-900"
                            )}
                            title="3D Color Visualization & Historical Compare"
                        >
                            <Palette className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
                            <span>
                                {colorMode === "DEFAULT" && (compactMode ? "3D Color" : "Color Overlay")}
                                {colorMode === "ANOMALY_PRIORITY" && "Anomaly Priority"}
                                {colorMode === "PENDING_TASK" && "Pending Tasks"}
                                {colorMode === "INCOMPLETE_RECORD" && "Incomplete Records"}
                                {colorMode === "RECTIFIED_ANOMALY" && "Rectified"}
                                {colorMode === "INSPECTION_TASK_TYPE" && "Task Type"}
                                {colorMode === "HISTORICAL_COMPARE" && "Historical Compare"}
                            </span>
                        </Button>

                        {openDropdown === "colormap" && (
                            <div className="absolute right-0 mt-2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-700 shadow-2xl p-3.5 w-72 flex flex-col gap-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                                            3D Color Overlay Mode
                                        </span>
                                    </div>
                                    {colorMode !== "DEFAULT" && (
                                        <button
                                            onClick={() => {
                                                setColorMode("DEFAULT");
                                                setOpenDropdown(null);
                                            }}
                                            className="text-[9px] font-black uppercase text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1 text-[10px]">
                                    {[
                                        { mode: "DEFAULT", label: "Standard Metallic 3D", desc: "Default material rendering" },
                                        { mode: "ANOMALY_PRIORITY", label: "🔴 Anomaly Priority & Severity", desc: "Color by Priority 1 / 2 / 3 / 4 & Findings" },
                                        { mode: "FINDING_CATEGORY", label: "🔍 Finding Category", desc: "Color by Corrosion, Marine Growth, Coating, Debris, Scour" },
                                        { mode: "PENDING_TASK", label: "🟡 Pending Tasks Status", desc: "Completed vs In-Progress vs Pending" },
                                        { mode: "INCOMPLETE_RECORD", label: "🟣 Incomplete Records", desc: "Highlight incomplete inspection forms" },
                                        { mode: "RECTIFIED_ANOMALY", label: "🔵 Anomaly Rectified / Repaired", desc: "Rectified vs active open anomalies" },
                                        { mode: "INSPECTION_TASK_TYPE", label: "🎨 Inspection Task Type", desc: "Color code by FMD, UT, Anode, GVINS" },
                                        { mode: "HISTORICAL_COMPARE", label: "📜 Historical Jobpack Compare", desc: "Compare past campaign anomalies vs present" }
                                    ].map(opt => (
                                        <button
                                            key={opt.mode}
                                            onClick={() => {
                                                setColorMode(opt.mode as VisualizationMode);
                                                setOpenDropdown(null);
                                            }}
                                            className={cn(
                                                "w-full text-left p-2 rounded-lg transition-all flex flex-col border cursor-pointer",
                                                colorMode === opt.mode
                                                    ? "bg-blue-600/30 border-blue-500 text-white font-bold"
                                                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                                            )}
                                        >
                                            <span className="font-bold text-xs">{opt.label}</span>
                                            <span className="text-[9px] text-slate-400">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Inspection Mode Scope Filter (BOTH / ROV / DIVING) */}
                                <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                                            Inspection Mode Scope
                                        </span>
                                        <span className="text-[8px] text-amber-300 font-bold">
                                            {inspectionModeFilter === "BOTH" ? "ROV & Diving" : inspectionModeFilter}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[9px] font-black">
                                        <button
                                            onClick={() => setInspectionModeFilter("BOTH")}
                                            className={cn(
                                                "py-1 px-1 rounded transition-all text-center uppercase tracking-tight cursor-pointer",
                                                inspectionModeFilter === "BOTH"
                                                    ? "bg-blue-600 text-white shadow"
                                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                            )}
                                        >
                                            Both
                                        </button>
                                        <button
                                            onClick={() => setInspectionModeFilter("ROV")}
                                            className={cn(
                                                "py-1 px-1 rounded transition-all text-center uppercase tracking-tight cursor-pointer",
                                                inspectionModeFilter === "ROV"
                                                    ? "bg-cyan-600 text-white shadow"
                                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                            )}
                                        >
                                            ROV
                                        </button>
                                        <button
                                            onClick={() => setInspectionModeFilter("DIVING")}
                                            className={cn(
                                                "py-1 px-1 rounded transition-all text-center uppercase tracking-tight cursor-pointer",
                                                inspectionModeFilter === "DIVING"
                                                    ? "bg-purple-600 text-white shadow"
                                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                            )}
                                        >
                                            Diving
                                        </button>
                                    </div>
                                </div>

                                {/* Historical Campaign & Jobpack Compare Controls */}
                                {colorMode === "HISTORICAL_COMPARE" && (
                                    <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                <History className="w-3 h-3 text-cyan-400" /> Structure Historical Jobpack
                                            </span>
                                            <select
                                                value={selectedCampaignId}
                                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                                className="h-7 text-[10px] font-bold bg-slate-950 border border-slate-700 text-cyan-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full"
                                            >
                                                <option value="ALL">All Historical Jobpacks Combined</option>
                                                {structureJobpacks.map((jp) => (
                                                    <option key={jp.id} value={jp.id}>{jp.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                Comparison Scope
                                            </span>
                                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[9px] font-black">
                                                <button
                                                    onClick={() => setCompareWithCurrent(true)}
                                                    className={cn(
                                                        "py-1 px-1 rounded transition-all text-center uppercase tracking-tight cursor-pointer",
                                                        compareWithCurrent
                                                            ? "bg-cyan-600 text-white shadow"
                                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                                    )}
                                                    title="Compare selected historical jobpack against current active jobpack"
                                                >
                                                    vs Current
                                                </button>
                                                <button
                                                    onClick={() => setCompareWithCurrent(false)}
                                                    className={cn(
                                                        "py-1 px-1 rounded transition-all text-center uppercase tracking-tight cursor-pointer",
                                                        !compareWithCurrent
                                                            ? "bg-purple-600 text-white shadow"
                                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                                    )}
                                                    title="View component status as recorded in historical jobpack only"
                                                >
                                                    Historical Only
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Inspection Filter (OFF) - Hidden in Inspection Workspace */}
                {!isWorkspace && (
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpenDropdown(openDropdown === "inspection" ? null : "inspection")}
                            className={cn(
                                "bg-white/90 backdrop-blur-md transition-all font-black uppercase tracking-widest flex items-center gap-1",
                                compactMode ? "h-8 px-2 rounded-lg text-[9px]" : "h-9 px-4 rounded-xl text-[10px]",
                                isInspectionMode
                                    ? "border-purple-400 text-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                    : "border-slate-200 text-slate-500"
                            )}
                            title="Inspection Mode Filter"
                        >
                            <Eye className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
                            <span>{compactMode ? (isInspectionMode ? `(${selectedInspectionFilters.length})` : "OFF") : `Inspection ${isInspectionMode ? `(${selectedInspectionFilters.length}/3)` : "OFF"} ▼`}</span>
                        </Button>

                        {openDropdown === "inspection" && (
                            <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-72 flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Inspection Mode
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {selectedInspectionFilters.length < 3 && (
                                            <button
                                                onClick={() => {
                                                    setSelectedInspectionFilters(["NOT_INSPECTED", "NO_ANOMALY", "HAS_ANOMALY"]);
                                                    setIsInspectionMode(true);
                                                }}
                                                className="text-[9px] font-black uppercase text-purple-600 hover:text-purple-800 transition-colors"
                                            >
                                                Select All
                                            </button>
                                        )}
                                        <label className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isInspectionMode}
                                                    onChange={(e) => {
                                                        const nextState = e.target.checked;
                                                        setIsInspectionMode(nextState);
                                                        if (nextState && selectedInspectionFilters.length === 0) {
                                                            setSelectedInspectionFilters(["NOT_INSPECTED", "NO_ANOMALY", "HAS_ANOMALY"]);
                                                        }
                                                    }}
                                                />
                                                <div className={`block w-8 h-5 rounded-full ${isInspectionMode ? 'bg-purple-500' : 'bg-slate-200'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${isInspectionMode ? 'transform translate-x-3' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5 py-1">
                                    {/* Not Inspected Checkbox */}
                                    <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={selectedInspectionFilters.includes("NOT_INSPECTED")}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (!isInspectionMode) setIsInspectionMode(true);
                                                if (checked) {
                                                    setSelectedInspectionFilters((prev) => [...prev, "NOT_INSPECTED"]);
                                                } else {
                                                    setSelectedInspectionFilters((prev) => prev.filter((f) => f !== "NOT_INSPECTED"));
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-purple-500 accent-slate-600"
                                        />
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500 shrink-0" />
                                        <span className="text-xs font-bold text-slate-700">Not Inspected</span>
                                    </label>

                                    {/* Inspected (No Anomaly) Checkbox */}
                                    <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-emerald-50/60 cursor-pointer transition-colors border border-transparent hover:border-emerald-100">
                                        <input
                                            type="checkbox"
                                            checked={selectedInspectionFilters.includes("NO_ANOMALY")}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (!isInspectionMode) setIsInspectionMode(true);
                                                if (checked) {
                                                    setSelectedInspectionFilters((prev) => [...prev, "NO_ANOMALY"]);
                                                } else {
                                                    setSelectedInspectionFilters((prev) => prev.filter((f) => f !== "NO_ANOMALY"));
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                                        />
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] border border-emerald-600 shrink-0" />
                                        <span className="text-xs font-bold text-emerald-700">Inspected (No Anomaly)</span>
                                    </label>

                                    {/* Inspected (Has Anomaly) Checkbox */}
                                    <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-red-50/80 cursor-pointer transition-colors border border-transparent hover:border-red-100">
                                        <input
                                            type="checkbox"
                                            checked={selectedInspectionFilters.includes("HAS_ANOMALY")}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (!isInspectionMode) setIsInspectionMode(true);
                                                if (checked) {
                                                    setSelectedInspectionFilters((prev) => [...prev, "HAS_ANOMALY"]);
                                                } else {
                                                    setSelectedInspectionFilters((prev) => prev.filter((f) => f !== "HAS_ANOMALY"));
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500 accent-red-600"
                                        />
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] border border-red-600 shrink-0 animate-pulse" />
                                        <span className="text-xs font-bold text-red-700">Inspected (Has Anomaly)</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Elevation Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "elevation" ? null : "elevation")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md transition-all font-black uppercase tracking-widest flex items-center gap-1",
                            compactMode ? "h-8 px-2 rounded-lg text-[9px]" : "h-9 px-4 rounded-xl text-[10px]",
                            selectedElevations.length > 0
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                        title="Filter Elevations"
                    >
                        <Layers className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
                        <span>{compactMode ? (selectedElevations.length > 0 ? `(${selectedElevations.length})` : "Elv") : `Elevation ${selectedElevations.length > 0 ? `(${selectedElevations.length})` : ""} ▼`}</span>
                    </Button>

                    {openDropdown === "elevation" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-60 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Elevations ({selectedElevations.length}/{availableElevations.length})
                                </span>
                                <div className="flex items-center gap-2">
                                    {selectedElevations.length < availableElevations.length && (
                                        <button
                                            onClick={() => setSelectedElevations([...availableElevations])}
                                            className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                        >
                                            Select All
                                        </button>
                                    )}
                                    {selectedElevations.length > 0 && (
                                        <button
                                            onClick={() => setSelectedElevations([])}
                                            className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto py-1">
                                {availableElevations.map((elv) => {
                                    const isChecked = selectedElevations.includes(elv);
                                    const labelText = elv >= 0 ? `+${elv.toFixed(3)}m` : `${elv.toFixed(3)}m`;
                                    return (
                                        <label
                                            key={elv}
                                            className={cn(
                                                "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border",
                                                isChecked
                                                    ? "bg-blue-50/80 border-blue-200 text-blue-900"
                                                    : "hover:bg-slate-50 border-transparent text-slate-700"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedElevations((prev) => prev.filter((e) => e !== elv));
                                                    } else {
                                                        setSelectedElevations((prev) => [...prev, elv]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold font-mono">{labelText}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Face Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "face" ? null : "face")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md transition-all font-black uppercase tracking-widest flex items-center gap-1",
                            compactMode ? "h-8 px-2 rounded-lg text-[9px]" : "h-9 px-4 rounded-xl text-[10px]",
                            selectedFaces.length > 0
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                        title="Filter Structural Faces"
                    >
                        <Compass className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
                        <span>{compactMode ? (selectedFaces.length > 0 ? `(${selectedFaces.length})` : "Face") : `Face ${selectedFaces.length > 0 ? `(${selectedFaces.length})` : ""} ▼`}</span>
                    </Button>

                    {openDropdown === "face" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-48 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Face
                                </span>
                                {selectedFaces.length > 0 && (
                                    <button
                                        onClick={() => setSelectedFaces([])}
                                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto py-1">
                                {availableFaces.map((face) => {
                                    const isChecked = selectedFaces.includes(face);
                                    return (
                                        <label
                                            key={face}
                                            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedFaces(selectedFaces.filter((f) => f !== face));
                                                    } else {
                                                        setSelectedFaces([...selectedFaces, face]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{face}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Reset View Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetTrigger((prev) => prev + 1)}
                    className={cn(
                        "bg-white/90 backdrop-blur-md border border-slate-200 text-slate-500 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all font-black uppercase tracking-widest shadow-sm flex items-center justify-center",
                        compactMode ? "h-8 w-8 rounded-lg px-0" : "h-9 px-4 rounded-xl text-[10px] gap-1.5"
                    )}
                    title="Reset 3D View"
                >
                    <Maximize2 className={compactMode ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
                    {!compactMode && <span>Reset View</span>}
                </Button>

                {/* Display options dropdown */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "display" ? null : "display")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md border transition-all font-black uppercase tracking-widest flex items-center justify-center",
                            compactMode ? "h-8 w-8 rounded-lg px-0" : "h-9 px-4 rounded-xl text-[10px]",
                            openDropdown === "display"
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                        title="Display Settings"
                    >
                        <SlidersHorizontal className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
                        {!compactMode && <span className="ml-1">Display ▼</span>}
                    </Button>

                    {openDropdown === "display" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-48 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Display
                                </span>
                            </div>
                            <div className="flex flex-col gap-2 py-1">
                                <label className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showWater}
                                        onChange={() => setShowWater(!showWater)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Water</span>
                                </label>
                                <label className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showGrid}
                                        onChange={() => setShowGrid(!showGrid)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Grid</span>
                                </label>
                                <label className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showWeldNumbering}
                                        onChange={() => setShowWeldNumbering(!showWeldNumbering)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Node Numbers</span>
                                </label>
                                <label className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showElevations}
                                        onChange={() => setShowElevations(!showElevations)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Elevations</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Assets Rendered Pill */}
                <div
                    className={cn(
                        "bg-white/90 backdrop-blur-md border border-blue-100 shadow-lg flex items-center gap-1.5",
                        compactMode ? "h-8 px-2 rounded-lg text-[9px]" : "h-9 px-4 rounded-xl text-xs"
                    )}
                    title={`${components.length} Assets Rendered`}
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                    <span className="font-black text-slate-800 uppercase tracking-tight">
                        {compactMode ? `${components.length}` : `${components.length} Assets Rendered`}
                    </span>
                </div>
            </div>

            {/* DYNAMIC COLOR LEGEND OVERLAY - Workspace Only */}
            {isWorkspace && colorMode !== "DEFAULT" && (
                <div className="absolute top-12 left-3 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col gap-1.5 text-white max-w-md">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                        <span className="flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                                {colorMode === "ANOMALY_PRIORITY" && "Anomaly Priority & Finding Key"}
                                {colorMode === "FINDING_CATEGORY" && "Finding Category Key"}
                                {colorMode === "PENDING_TASK" && "Pending Tasks Status Key"}
                                {colorMode === "INCOMPLETE_RECORD" && "Incomplete Records Key"}
                                {colorMode === "RECTIFIED_ANOMALY" && "Rectified Anomaly Key"}
                                {colorMode === "INSPECTION_TASK_TYPE" && (
                                    campaignTaskMode === "ROV" ? "Inspection Task Spec Key (ROV Campaign)" :
                                    campaignTaskMode === "DIVING" ? "Inspection Task Spec Key (Diving Campaign)" :
                                    campaignTaskMode === "MIXED" ? "Inspection Task Spec Key (ROV & Diving Tasks)" :
                                    "Inspection Task Spec Key"
                                )}
                                {colorMode === "HISTORICAL_COMPARE" && "Historical Campaign Compare Key"}
                            </span>
                        </span>
                        <div className="flex items-center gap-2">
                            {/* Anomaly vs Finding Priority Scope Switcher */}
                            {colorMode === "ANOMALY_PRIORITY" && (
                                <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[8px] font-black uppercase tracking-wider">
                                    <button
                                        onClick={() => setPriorityScope("BOTH")}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                            priorityScope === "BOTH"
                                                ? "bg-amber-500 text-slate-950 font-black shadow"
                                                : "text-slate-400 hover:text-slate-200"
                                        )}
                                        title="Show combined Anomaly and Finding priorities"
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setPriorityScope("ANOMALY")}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                            priorityScope === "ANOMALY"
                                                ? "bg-rose-600 text-white font-black shadow"
                                                : "text-slate-400 hover:text-slate-200"
                                        )}
                                        title="Filter 3D view to Anomaly Priorities only"
                                    >
                                        Anomaly
                                    </button>
                                    <button
                                        onClick={() => setPriorityScope("FINDING")}
                                        className={cn(
                                            "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                            priorityScope === "FINDING"
                                                ? "bg-cyan-600 text-white font-black shadow"
                                                : "text-slate-400 hover:text-slate-200"
                                        )}
                                        title="Filter 3D view to Finding Priorities only"
                                    >
                                        Finding
                                    </button>
                                </div>
                            )}

                            {/* Inspection Mode Scope Switcher */}
                            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[8px] font-black uppercase tracking-wider">
                                <button
                                    onClick={() => setInspectionModeFilter("BOTH")}
                                    className={cn(
                                        "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                        inspectionModeFilter === "BOTH"
                                            ? "bg-blue-600 text-white font-black shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                    title="Show both ROV and Diving inspection results"
                                >
                                    Both
                                </button>
                                <button
                                    onClick={() => setInspectionModeFilter("ROV")}
                                    className={cn(
                                        "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                        inspectionModeFilter === "ROV"
                                            ? "bg-cyan-600 text-white font-black shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                    title="Filter color map to ROV inspection mode only"
                                >
                                    ROV
                                </button>
                                <button
                                    onClick={() => setInspectionModeFilter("DIVING")}
                                    className={cn(
                                        "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                        inspectionModeFilter === "DIVING"
                                            ? "bg-purple-600 text-white font-black shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                    title="Filter color map to Diving inspection mode only"
                                >
                                    Diving
                                </button>
                            </div>

                            {selectedPriorityFilter && (
                                <button
                                    onClick={() => setSelectedPriorityFilter(null)}
                                    className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded transition-all"
                                >
                                    Show All
                                </button>
                            )}
                            <button onClick={() => setColorMode("DEFAULT")} className="text-[8px] font-bold text-slate-500 hover:text-white uppercase">Hide</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                        {colorMode === "ANOMALY_PRIORITY" && (
                            <>
                                {(() => {
                                    const priorityItems = (
                                        priorityScope === "FINDING" ? [
                                            { code: "OBSERVATION", label: "Observation", color: libraryColors["OBSERVATION"] || libraryColors["OBS"] || "#d97706" },
                                            { code: "FINDING P1", label: "Finding P1", color: libraryColors["FINDING P1"] || "#ef4444" },
                                            { code: "FINDING P2", label: "Finding P2", color: libraryColors["FINDING P2"] || "#f97316" },
                                            { code: "FINDING P3", label: "Finding P3", color: libraryColors["FINDING P3"] || "#0284c7" },
                                            { code: "CLEAN", label: "Clean", color: libraryColors["CLEAN"] || "#10b981" },
                                            { code: "UNINSPECTED", label: "Uninspected", color: libraryColors["UNINSPECTED"] || "#64748b" }
                                        ] : libraryPriorityList.length > 0 ? [
                                            ...libraryPriorityList,
                                            { code: "OBSERVATION", label: "Observation", color: libraryColors["OBSERVATION"] || "#d97706" },
                                            { code: "CLEAN", label: "Clean", color: libraryColors["CLEAN"] || "#10b981" },
                                            { code: "UNINSPECTED", label: "Uninspected", color: libraryColors["UNINSPECTED"] || "#64748b" }
                                        ] : [
                                            { code: "PRIORITY 1", label: "Priority 1", color: "#ef4444" },
                                            { code: "PRIORITY 2", label: "Priority 2", color: "#f97316" },
                                            { code: "PRIORITY 3", label: "Priority 3", color: "#eab308" },
                                            { code: "PRIORITY 4", label: "Priority 4", color: "#84cc16" },
                                            { code: "OBSERVATION", label: "Observation", color: "#d97706" },
                                            { code: "CLEAN", label: "Clean", color: "#10b981" },
                                            { code: "UNINSPECTED", label: "Uninspected", color: "#64748b" },
                                        ]
                                    ).filter(item => {
                                        if (priorityScope === "ANOMALY") {
                                            return item.code !== "FINDING" && item.code !== "OBSERVATION" && !item.code.startsWith("FINDING P");
                                        }
                                        return true;
                                    });

                                    // Deduplicate items by code to ensure unique keys
                                    const uniquePriorityItems = Array.from(
                                        new Map(priorityItems.map(item => [item.code, item])).values()
                                    );

                                    return uniquePriorityItems.map((item) => {
                                        const colorHex = item.color || libraryColors[item.code] || libraryColors[item.code.replace("PRIORITY ", "P")] || "#64748b";
                                        const isSelected = selectedPriorityFilter === item.code;
                                        return (
                                            <button
                                                key={item.code}
                                                onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                    isSelected
                                                        ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                        : selectedPriorityFilter
                                                        ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                        : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                                )}
                                                title={`Click to filter 3D view by ${item.label}`}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colorHex }} />
                                                <span>{item.label}</span>
                                            </button>
                                        );
                                    });
                                })()}
                            </>
                        )}

                        {colorMode === "FINDING_CATEGORY" && (
                            <>
                                {[
                                    { code: "CORROSION", label: "Corrosion / Metal Loss", defaultCol: "#ec4899" },
                                    { code: "MARINE_GROWTH", label: "Marine Growth", defaultCol: "#06b6d4" },
                                    { code: "COATING", label: "Coating Defect", defaultCol: "#a855f7" },
                                    { code: "DEBRIS", label: "Debris / Foreign Object", defaultCol: "#84cc16" },
                                    { code: "SCOUR", label: "Scour / Seabed", defaultCol: "#3b82f6" },
                                    { code: "GENERAL", label: "General Finding", defaultCol: "#0284c7" },
                                    { code: "CLEAN", label: "Clean", defaultCol: "#10b981" },
                                    { code: "UNINSPECTED", label: "Uninspected", defaultCol: "#64748b" },
                                ].map((item) => {
                                    const colorHex = libraryColors[item.code] || item.defaultCol;
                                    const isSelected = selectedPriorityFilter === item.code;
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                isSelected
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                    : selectedPriorityFilter
                                                    ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                            )}
                                            title={`Click to filter 3D view by ${item.label}`}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colorHex }} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {colorMode === "PENDING_TASK" && (
                            <>
                                {[
                                    { code: "COMPLETED", label: "Completed", colorHex: "#10b981" },
                                    { code: "IN_PROGRESS", label: "In Progress", colorHex: "#0284c7" },
                                    { code: "PENDING", label: "Pending", colorHex: "#f59e0b" },
                                ].map((item) => {
                                    const isSelected = selectedPriorityFilter === item.code;
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                isSelected
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                    : selectedPriorityFilter
                                                    ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                            )}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.colorHex }} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {colorMode === "INCOMPLETE_RECORD" && (
                            <>
                                {[
                                    { code: "INCOMPLETE", label: "Incomplete Record", colorHex: "#e11d48" },
                                    { code: "COMPLETE", label: "Complete", colorHex: "#10b981" },
                                    { code: "UNINSPECTED", label: "Uninspected", colorHex: "#64748b" },
                                ].map((item) => {
                                    const isSelected = selectedPriorityFilter === item.code;
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                isSelected
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                    : selectedPriorityFilter
                                                    ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                            )}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.colorHex }} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {colorMode === "RECTIFIED_ANOMALY" && (
                            <>
                                {[
                                    { code: "RECTIFIED", label: "Rectified", colorHex: "#06b6d4" },
                                    { code: "ACTIVE", label: "Active Anomaly", colorHex: "#ef4444" },
                                    { code: "CLEAN", label: "No Anomaly", colorHex: "#10b981" },
                                ].map((item) => {
                                    const isSelected = selectedPriorityFilter === item.code;
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                isSelected
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                    : selectedPriorityFilter
                                                    ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                            )}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.colorHex }} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {colorMode === "INSPECTION_TASK_TYPE" && (
                            <>
                                {(
                                    campaignTaskMode === "ROV" ? [
                                        { code: "RGVIN", label: "RGVIN (ROV GVI)", colorHex: "#3b82f6" },
                                        { code: "RCVIN", label: "RCVIN (ROV CVI)", colorHex: "#0284c7" },
                                        { code: "RFMD", label: "RFMD (ROV FMD)", colorHex: "#06b6d4" },
                                        { code: "RUTWT", label: "RUTWT (ROV UT)", colorHex: "#f59e0b" },
                                        { code: "RCPSU", label: "RCPSU (ROV CP)", colorHex: "#10b981" },
                                        { code: "RSANI", label: "RSANI (ROV Anode)", colorHex: "#a855f7" },
                                        { code: "RSZCI", label: "RSZCI (ROV Splash Zone)", colorHex: "#f43f5e" },
                                        { code: "RMGI", label: "RMGI (ROV Marine Growth)", colorHex: "#84cc16" },
                                        { code: "RSCOR", label: "RSCOR (ROV Seabed)", colorHex: "#14b8a6" },
                                        { code: "RACFM", label: "RACFM (ROV ACFM)", colorHex: "#ec4899" },
                                        { code: "RRISI", label: "RRISI (ROV Riser)", colorHex: "#ea580c" },
                                    ] : campaignTaskMode === "DIVING" ? [
                                        { code: "DGVIN", label: "DGVIN (Diver GVI)", colorHex: "#3b82f6" },
                                        { code: "DCVIN", label: "DCVIN (Diver CVI)", colorHex: "#0284c7" },
                                        { code: "DFMD", label: "DFMD (Diver FMD)", colorHex: "#06b6d4" },
                                        { code: "DUTWT", label: "DUTWT (Diver UT)", colorHex: "#f59e0b" },
                                        { code: "DCPSU", label: "DCPSU (Diver CP)", colorHex: "#10b981" },
                                        { code: "DSANI", label: "DSANI (Diver Anode)", colorHex: "#a855f7" },
                                        { code: "DSZCI", label: "DSZCI (Diver Splash Zone)", colorHex: "#f43f5e" },
                                        { code: "DMGI", label: "DMGI (Diver Marine Growth)", colorHex: "#84cc16" },
                                        { code: "DSCOU", label: "DSCOU (Diver Seabed)", colorHex: "#14b8a6" },
                                        { code: "DACFM", label: "DACFM (Diver ACFM)", colorHex: "#ec4899" },
                                        { code: "DMPIN", label: "DMPIN (Diver MPI)", colorHex: "#ef4444" },
                                        { code: "DRRISI", label: "DRRISI (Diver Riser)", colorHex: "#ea580c" },
                                    ] : [
                                        { code: "GVI", label: "GVI (General Visual)", colorHex: "#3b82f6" },
                                        { code: "CVI", label: "CVI (Close Visual)", colorHex: "#0284c7" },
                                        { code: "FMD", label: "FMD (Flooded Member)", colorHex: "#06b6d4" },
                                        { code: "UT", label: "UT (Wall Thickness)", colorHex: "#f59e0b" },
                                        { code: "CP", label: "CP Potential Survey", colorHex: "#10b981" },
                                        { code: "ANODE", label: "Anode Inspection", colorHex: "#a855f7" },
                                        { code: "MPI", label: "MPI (Magnetic Particle)", colorHex: "#ef4444" },
                                        { code: "ACFM", label: "ACFM NDT", colorHex: "#ec4899" },
                                        { code: "SZONE", label: "Splash Zone", colorHex: "#f43f5e" },
                                        { code: "MGROW", label: "Marine Growth", colorHex: "#84cc16" },
                                        { code: "SCOUR", label: "Scour / Seabed", colorHex: "#14b8a6" },
                                        { code: "RISER", label: "Riser & Clamp", colorHex: "#ea580c" },
                                    ]
                                ).map((item) => {
                                    const isSelected = selectedPriorityFilter === item.code;
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                isSelected
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                    : selectedPriorityFilter
                                                    ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                            )}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.colorHex }} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {colorMode === "HISTORICAL_COMPARE" && (
                            <div className="flex flex-col gap-2 w-full">
                                {/* Jobpack Selection & Comparison Mode Header */}
                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                                    <div className="flex items-center gap-1">
                                        <History className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-[9px] font-black uppercase text-slate-300">Jobpack:</span>
                                        <select
                                            value={selectedCampaignId}
                                            onChange={(e) => setSelectedCampaignId(e.target.value)}
                                            className="h-6 text-[9px] font-bold bg-slate-950 border border-slate-700 text-cyan-300 rounded px-1.5 focus:outline-none cursor-pointer max-w-[180px] truncate"
                                        >
                                            <option value="ALL">All Past Jobpacks Combined</option>
                                            {structureJobpacks.map((jp) => (
                                                <option key={jp.id} value={jp.id}>{jp.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Compare vs Current Switcher */}
                                    <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[8px] font-black uppercase tracking-wider">
                                        <button
                                            onClick={() => setCompareWithCurrent(true)}
                                            className={cn(
                                                "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                                compareWithCurrent
                                                    ? "bg-cyan-600 text-white font-black shadow"
                                                    : "text-slate-400 hover:text-slate-200"
                                            )}
                                            title="Compare selected historical jobpack against current active jobpack"
                                        >
                                            vs Current
                                        </button>
                                        <button
                                            onClick={() => setCompareWithCurrent(false)}
                                            className={cn(
                                                "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                                !compareWithCurrent
                                                    ? "bg-purple-600 text-white font-black shadow"
                                                    : "text-slate-400 hover:text-slate-200"
                                            )}
                                            title="View component status as recorded in historical jobpack only"
                                        >
                                            Historical Only
                                        </button>
                                    </div>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                                    {(compareWithCurrent ? [
                                        { code: "NEW_ANOMALY", label: "New Anomaly in Current", colorHex: "#ef4444" },
                                        { code: "RECTIFIED", label: "Rectified / Fixed", colorHex: "#06b6d4" },
                                        { code: "PERSISTENT", label: "Persistent Anomaly", colorHex: "#eab308" },
                                        { code: "CLEAN", label: "Clean / No Anomaly", colorHex: "#10b981" },
                                        { code: "UNINS", label: "Uninspected", colorHex: "#64748b" }
                                    ] : [
                                        { code: "HIST_ANOMALY", label: "Historical Anomaly", colorHex: "#ef4444" },
                                        { code: "CLEAN", label: "Clean / No Anomaly", colorHex: "#10b981" },
                                        { code: "UNINS", label: "Uninspected", colorHex: "#64748b" }
                                    ]).map((item) => {
                                        const isSelected = selectedPriorityFilter === item.code;
                                        return (
                                            <button
                                                key={item.code}
                                                onClick={() => setSelectedPriorityFilter(isSelected ? null : item.code)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer border select-none text-[9px]",
                                                    isSelected
                                                        ? "bg-amber-400/20 border-amber-400 text-amber-300 font-black shadow-lg scale-105 ring-2 ring-amber-400/50"
                                                        : selectedPriorityFilter
                                                        ? "opacity-40 border-transparent hover:opacity-100 hover:bg-slate-800"
                                                        : "bg-slate-800/40 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:scale-105"
                                                )}
                                                title={`Click to filter 3D view by ${item.label}`}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.colorHex }} />
                                                <span>{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
