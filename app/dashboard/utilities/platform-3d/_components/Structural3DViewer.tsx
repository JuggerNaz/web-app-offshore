import * as THREE from 'three';
"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Fender } from "./Fender";
import { RiserGuard } from "./RiserGuard";
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
import { Play, Box, Radio, Compass, RefreshCw, Maximize2, Search, ChevronRight} from "lucide-react";

interface Component3D {
    id: number;
    comp_id?: number;
    q_id: string;
    code: string | null;
    metadata: any;
}

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
}

const ComponentMesh = ({
    component,
    isSelected,
    onClick,
    start,
    end,
    thickness = 0.3,
    showWeldNumbering = true,
    isInspectionMode = false,
    inspectionStatus = "NOT_INSPECTED",
    isStatusChecked = true,
    inspectionColor,
}: {
    component: Component3D;
    isSelected: boolean;
    onClick: () => void;
    start: [number, number, number];
    end: [number, number, number];
    thickness?: number;
    showWeldNumbering?: boolean;
    isInspectionMode?: boolean;
    inspectionStatus?: "NOT_INSPECTED" | "NO_ANOMALY" | "HAS_ANOMALY";
    isStatusChecked?: boolean;
    inspectionColor?: string;
}) => {
    const [hovered, setHovered] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    const code = (component?.code || "").toUpperCase();
    const qIdUpper = (component?.q_id || "").toUpperCase();
    const isNode = code.includes("NODE") || qIdUpper.includes("NODE") || code === "ND";
    const isAnode = code === "AN" || code.includes("ANOD");
    const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
    const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL";
    const isClamp = code === "CL" || code.includes("CLAM") || isRiserSupport;
    const isRiser = !isAnode && !isRiserSupport && (
        code === "RS" || code === "CS" || code === "CD" ||
        code.includes("RISER") || code.includes("RISR") ||
        /^R\d+[-_]/i.test(qIdUpper) ||
        (qIdUpper.startsWith("R") && !qIdUpper.startsWith("RIS-"))
    );
    const isConductor = code === "CD" || code === "CS" || code.includes("COND") || code === "CO" || code === "CA" || code.includes("CAIS");

    const defaultMeshColor = isAnode
        ? "#F8FAFC"
        : isWeld
            ? "#d946ef"
            : isClamp
                ? "#d97706"
                : isRiser
                    ? "#334155"
                    : isConductor
                        ? "#475569"
                        : "#cbd5e1";

    const isInspectionHighlighted = isInspectionMode && isStatusChecked;

    const displayColor = isSelected
        ? "#f97316"
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
        ? "#ea580c"
        : (isInspectionHighlighted && inspectionStatus === "HAS_ANOMALY")
            ? "#ef4444"
            : isWeld
                ? "#a21caf"
                : "#000000";

    const emissiveInt = isSelected
        ? 0.6
        : (isInspectionHighlighted && inspectionStatus === "HAS_ANOMALY")
            ? 0.5
            : isWeld
                ? 0.4
                : 0;

    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    let baseThickness = thickness;
    if (isNaN(baseThickness) || baseThickness === null || baseThickness === undefined) {
        baseThickness = 0.3;
    }

    const length = startVec.distanceTo(endVec);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();

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
        const match =
            component.q_id.match(/WN\s*N?([A-Za-z0-9]+)/i) || component.q_id.match(/N?([A-Za-z0-9]+)/);
        if (match) {
            labelText = match[1];
        }
    }

    const md = component.metadata || {};
    const rawClockPos = md.clk_pos ?? md.clockPosition;
    let clockPos: number;
    if (isAnode && (rawClockPos === undefined || rawClockPos === null || rawClockPos === "" || rawClockPos === "N/A")) {
        clockPos = 12;
    } else {
        clockPos = parseFloat(rawClockPos || "12");
        if (isNaN(clockPos)) clockPos = 12;
    }
    const angle = (clockPos / 12) * Math.PI * 2;
    const memberRadius = baseThickness < 0.2 ? 0.25 : baseThickness;
    const offsetDistance = memberRadius + 0.15;

    let ox = 0;
    let oy = 0;
    let oz = 0;
    let anodeRotY = 0;

    if (isAnode) {
        // Calculate orthogonal basis in global space relative to direction
        const upVec = new THREE.Vector3(0, 1, 0);
        if (Math.abs(direction.y) > 0.99) {
            upVec.set(0, 0, -1);
        }
        upVec.sub(direction.clone().multiplyScalar(upVec.dot(direction))).normalize();
        const rightVec = new THREE.Vector3().crossVectors(upVec, direction).normalize();

        // Calculate global offset vector for the clock position (12 o'clock = UP, 3 o'clock = RIGHT)
        const globalOffset = rightVec
            .clone()
            .multiplyScalar(Math.sin(angle))
            .add(upVec.clone().multiplyScalar(Math.cos(angle)))
            .multiplyScalar(offsetDistance);

        // Convert the global offset back to local coordinates of the parent rotated group
        const localOffset = globalOffset.clone().applyQuaternion(quaternion.clone().invert());
        ox = localOffset.x;
        oy = localOffset.y;
        oz = localOffset.z;

        // Tangent rotation angle for anode group orientation
        anodeRotY = Math.atan2(ox, oz);
    } else if (isRiser || isClamp) {
        // Calculate outward radial vector away from platform center (0, 0, 0)
        const legMid = startVec.clone().add(endVec).multiplyScalar(0.5);
        const outwardDir = new THREE.Vector3(legMid.x, 0, legMid.z).normalize();

        // Enforce exact uniform fixed distance of 0.65m for all Riser components
        const fixedRiserDist = 0.65;
        const globalOffset = outwardDir.multiplyScalar(fixedRiserDist);

        // Convert global offset back to local coordinates of the parent group
        const localOffset = globalOffset.applyQuaternion(quaternion.clone().invert());
        ox = localOffset.x;
        oy = localOffset.y;
        oz = localOffset.z;
    }

    if (isNaN(ox)) ox = 0;
    if (isNaN(oy)) oy = 0;
    if (isNaN(oz)) oz = 0;

    const offsetPos: [number, number, number] = (isAnode || isRiser || isClamp) ? [ox, oy, oz] : [0, 0, 0];

    const riserBendGeometry = useMemo(() => {
        if (!isRiser) return null;

        const isEndLower = endVec.y <= startVec.y;
        const bottomLocalY = isEndLower ? (safeMeshLength / 2) : (-safeMeshLength / 2);
        const bottomYDir = isEndLower ? 1 : -1;

        // Calculate global outward radial vector pointing away from platform center (0, 0, 0)
        const legMid = startVec.clone().add(endVec).multiplyScalar(0.5);
        const globalOutward = new THREE.Vector3(legMid.x, 0, legMid.z).normalize();

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
        return new THREE.TubeGeometry(curve, 24, baseThickness > 0.3 ? 0.25 : baseThickness, 16, false);
    }, [isRiser, startVec, endVec, safeMeshLength, baseThickness, quaternion]);

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

    const isFender = code === "FD";
    if (isFender) {
        const md = component.metadata || {};
        let clockPos = parseFloat(md.clk_pos || "12");
        if (isNaN(clockPos)) clockPos = 12;
        const yawAngle = (clockPos / 12) * Math.PI * 2;

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
                    {isSelected && (
                        <Outlines
                            thickness={0.08}
                            color="#f97316"
                        />
                    )}
                    {hovered && !isSelected && (
                        <Outlines
                            thickness={0.04}
                            color="#38bdf8"
                        />
                    )}
                </mesh>

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, fenderHeight / 2 + 0.5, 0]}
                        center
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-orange-500 text-white border-orange-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(249,115,22,0.4)]"
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
                    {isSelected && (
                        <Outlines
                            thickness={0.08}
                            color="#f97316"
                        />
                    )}
                    {hovered && !isSelected && (
                        <Outlines
                            thickness={0.04}
                            color="#38bdf8"
                        />
                    )}
                </mesh>

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, guardHeight / 2 + 0.5, 0]}
                        center
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-orange-500 text-white border-orange-400 scale-110 opacity-100 font-bold shadow-[0_0_10px_rgba(249,115,22,0.4)]"
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

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            <group
                position={offsetPos as [number, number, number]}
                rotation={isAnode ? [0, anodeRotY, 0] : [0, 0, 0]}
            >
                { }
                <mesh castShadow receiveShadow>
                    {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                        <sphereGeometry args={[Math.max(thickness * 1.5, 0.01), 16, 16]} />
                    ) : isAnode ? (
                        <boxGeometry args={[0.2, safeMeshLength, 0.2]} />
                    ) : isClamp ? (
                        <boxGeometry args={[baseThickness, 0.8, baseThickness]} />
                    ) : isWeld ? (
                        <cylinderGeometry args={[baseThickness, baseThickness, safeMeshLength, 32]} />
                    ) : (
                        <cylinderGeometry args={[baseThickness, baseThickness, safeMeshLength, 6]} />
                    )}
                    <meshStandardMaterial
                        color={displayColor}
                        metalness={isAnode ? 0.85 : isWeld ? 0.2 : isClamp ? 0.8 : isRiser || isConductor ? 0.75 : 0.7}
                        roughness={isAnode ? 0.25 : isWeld ? 0.5 : isClamp ? 0.25 : isRiser || isConductor ? 0.45 : 0.3}
                        emissive={emissiveColor}
                        emissiveIntensity={emissiveInt}
                    />
                    {(!isAnode && !isWeld && !isClamp) && (
                        <Edges
                            threshold={20}
                            color="#0f172a"
                            opacity={0.35}
                            transparent
                        />
                    )}
                    {isSelected && (
                        <Outlines
                            thickness={0.04}
                            color="#f97316"
                        />
                    )}
                    {hovered && !isSelected && (
                        <Outlines
                            thickness={0.02}
                            color="#38bdf8"
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
                            {isSelected && <Outlines thickness={0.04} color="#f97316" />}
                            {hovered && !isSelected && <Outlines thickness={0.02} color="#38bdf8" />}
                        </mesh>
                    )}
                    {isClamp && (
                        <mesh position={[0, 0, 0]} castShadow receiveShadow>
                            <boxGeometry args={[baseThickness + 0.4, 0.6, 0.05]} />
                            <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.25} />
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

                {showLabel && (
                    <Html
                        distanceFactor={15}
                        position={[0, (isAnode || isWeld ? safeMeshLength : length) / 2 + 0.5, 0]}
                        center
                    >
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100"
                                : isWeld
                                    ? "bg-orange-500 text-white border-orange-400 scale-100 opacity-90 font-bold shadow-[0_0_10px_rgba(249,115,22,0.4)]"
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
}: {
    start: [number, number, number];
    end: [number, number, number];
    thickness: number;
    color: string;
    label?: string;
    showLabel?: boolean;
    renderMesh?: boolean;
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

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            {renderMesh && (
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[thickness, thickness, safeLength, 8]} />
                    <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
                </mesh>
            )}
            {showLabel && label && (
                <Html distanceFactor={20} position={[0, safeLength / 2 + 1, 0]} center>
                    <div className="px-3 py-1 bg-white/10 backdrop-blur-md text-[14px] font-black text-slate-900 dark:text-white rounded-full border border-white/20 shadow-2xl pointer-events-none uppercase tracking-[0.2em]">
                        {label}
                    </div>
                </Html>
            )}
        </group>
    );
};

const ElevationMarker = ({ y, label }: { y: number; label: string }) => (
    <group position={[0, y, 0]}>
        <Html position={[-30, 0, 0]} center distanceFactor={20}>
            <div className="flex items-center gap-3">
                <div className="h-[1px] w-12 bg-blue-500/50" />
                <div className="px-2 py-1 bg-blue-600/90 backdrop-blur text-[10px] font-black text-white rounded border border-blue-400/50 shadow-lg whitespace-nowrap">
                    EL {label}
                </div>
            </div>
        </Html>
    </group>
);

// Component to handle auto-framing
function SelectToZoom({ children }: { children: React.ReactNode }) {
    const api = useBounds();
    return (
        <group
            onClick={(e) => (e.stopPropagation(), e.delta <= 2 && api.refresh(e.object).fit())}
        >
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





function CameraRig({ selectedPos, isActivated }: { selectedPos: THREE.Vector3 | null; isActivated: boolean }) {
    const { camera, controls } = useThree();
    
    useEffect(() => {
        if (!isActivated) return;
        if (selectedPos && controls) {
            const target = new THREE.Vector3(selectedPos.x, selectedPos.y, selectedPos.z);
            const offset = new THREE.Vector3(15, 10, 15);
            const cameraPos = target.clone().add(offset);
            
            (controls as any).target.copy(target);
            camera.position.copy(cameraPos);
            if (typeof (controls as any).update === 'function') {
                (controls as any).update();
            }
        }
    }, [selectedPos, camera, controls, isActivated]);

    return null;
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
}: Structural3DViewerProps) {
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
        const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
        return rawComponents.filter((c) => {
            const code = (c.code || "").trim().toUpperCase();
            if (excludeCodes.includes(code)) {
                return false;
            }

            // Exclude intermediate member seam welds (keep only primary junction node welds)
            if (code === "WN" && c.q_id && c.q_id.includes("-")) {
                return false;
            }

            // Exclude fender support components like FEND 1-SUPP-A2 / FEND x-SUPP-xx
            const qIdUpper = (c.q_id || "").toUpperCase();
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

    const [showGrid, setShowGrid] = useState(true);
    const [isInspectionMode, setIsInspectionMode] = useState(false);
    const [resetTrigger, setResetTrigger] = useState(0);
    const [showWater, setShowWater] = useState(true);
    const [showWeldNumbering, setShowWeldNumbering] = useState(true);
    const [isCameraClose, setIsCameraClose] = useState(false);
    const [selectedElevations, setSelectedElevations] = useState<number[]>([]);
    const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<"elevation" | "face" | "display" | "inspection" | null>(null);
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

    const availableElevations = useMemo(() => {
        const values = elevations.map((e) => sanitizeElevation(e.elv));
        return Array.from(new Set(values)).sort((a, b) => b - a);
    }, [elevations]);

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

    
    // USE WEBAPP_3D DATABASE INSTEAD OF FRONTEND PROCEDURAL MATH
    const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {
        if (!webapp3dData) return { componentLayouts: [], foundationMembers: [], elvMarkers: [] };

        const layouts = (webapp3dData.components || []).map((dbItem: any) => {
            const comp: any = rawComponents.find((c: any) => String(c.id) === String(dbItem.component_id)) || dbItem.component || {};
            const code = (comp.code || dbItem.code || "").toUpperCase();
            const q_id = comp.q_id || dbItem.q_id || `COMP-${dbItem.component_id}`;

            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const weldColor = isWeld ? "#d946ef" : null;
            const finalColor = isInspectionMode ? dbItem.inspection_color : (weldColor || dbItem.color_hex || "#64748b");
            
            const startVec = (dbItem.start_x !== undefined && dbItem.start_y !== undefined && dbItem.start_z !== undefined)
                ? [dbItem.start_x, dbItem.start_y, dbItem.start_z]
                : (dbItem.start || [dbItem.pos_x || 0, dbItem.pos_y || 0, dbItem.pos_z || 0]);

            const endVec = (dbItem.end_x !== undefined && dbItem.end_y !== undefined && dbItem.end_z !== undefined)
                ? [dbItem.end_x, dbItem.end_y, dbItem.end_z]
                : (dbItem.end || [dbItem.pos_x || 0, dbItem.pos_y || 0, dbItem.pos_z || 0]);

            const enrichedComp = { ...comp, code, q_id };

            const isInspected = Boolean(dbItem.is_inspected);
            const hasAnomaly = Boolean(dbItem.has_anomaly);
            const inspectionStatus = hasAnomaly
                ? "HAS_ANOMALY"
                : isInspected
                    ? "NO_ANOMALY"
                    : "NOT_INSPECTED";

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
                thickness: dbItem.dimensions?.radius || (isWeld ? 0.25 : 0.5),
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
            <Canvas
                shadows="soft"
                gl={{ antialias: true }}
                dpr={[1, 2]}
                onCreated={({ gl }) => {
                    (window as any).renderer = gl;
                }}
            >
                <color attach="background" args={["#ffffff"]} />
                <fog attach="fog" args={["#ffffff", 40, 220]} />
                <PerspectiveCamera makeDefault position={[45, 45, 45]} fov={45} />
                <CameraRig selectedPos={selectedPos} isActivated={isActivated} />
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
                        {/* Elevation Markers */}
                        {elvMarkers.map((m: any, i: number) => (
                            <ElevationMarker key={i} y={m.y} label={m.label} />
                        ))}

                        {/* Foundation Members (Skeleton) */}
                        {foundationMembers.map((m: any, fIdx: number) => (
                            <FoundationMember
                                key={`fm-${m.id || "item"}-${fIdx}`}
                                start={m.start}
                                end={m.end}
                                thickness={m.thickness}
                                color={m.color}
                                label={m.label}
                                showLabel={m.start[1] !== m.end[1]}
                                renderMesh={m.renderMesh}
                            />
                        ))}

                        {/* Existing Components */}
                        {componentLayouts.map((layout: any, idx: number) => {
                            const comp = layout.component || layout.originalComp || { id: layout.id, q_id: layout.q_id, code: layout.code };
                            const compId = comp?.id || layout.id;
                            const status = layout.inspectionStatus || "NOT_INSPECTED";
                            const isChecked = selectedInspectionFilters.includes(status);

                            return (
                                <ComponentMesh
                                    key={`comp-${layout.id || compId || "item"}-${idx}`}
                                    component={comp}
                                    isSelected={selectedCompId === compId}
                                    onClick={() => onSelectComponent && onSelectComponent(comp)}
                                    start={layout.start || layout.position}
                                    end={layout.end || layout.position}
                                    thickness={layout.thickness}
                                    showWeldNumbering={showWeldNumbering}
                                    isInspectionMode={isInspectionMode}
                                    inspectionStatus={status}
                                    isStatusChecked={isChecked}
                                    inspectionColor={layout.color}
                                />
                            );
                        })}
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
                            <Html position={[35, 1, 0]} center distanceFactor={20}>
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
                            <Html position={[35, 1, 0]} center distanceFactor={20}>
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



            


            {/* Click-outside backdrop */}
            {openDropdown && (
                <div
                    className="absolute inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setOpenDropdown(null)}
                />
            )}

            <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
                {/* Sync Button */}
                {onSync && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onSync}
                        disabled={isSyncing}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 transition-all shadow-sm flex items-center justify-center",
                            isSyncing && "border-blue-200 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                        )}
                        title="Sync Component Data"
                    >
                        <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                    </Button>
                )}

                
                {/* Inspection Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "inspection" ? null : "inspection")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            isInspectionMode
                                ? "border-purple-400 text-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                    >
                        Inspection {isInspectionMode ? `(${selectedInspectionFilters.length}/3)` : "OFF"} ▼
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

                {/* Elevation Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "elevation" ? null : "elevation")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            selectedElevations.length > 0
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                    >
                        Elevation {selectedElevations.length > 0 ? `(${selectedElevations.length})` : ""} ▼
                    </Button>

                    {openDropdown === "elevation" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-56 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Elevation
                                </span>
                                {selectedElevations.length > 0 && (
                                    <button
                                        onClick={() => setSelectedElevations([])}
                                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto py-1">
                                {availableElevations.map((elv) => {
                                    const isChecked = selectedElevations.includes(elv);
                                    return (
                                        <label
                                            key={elv}
                                            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedElevations(selectedElevations.filter((e) => e !== elv));
                                                    } else {
                                                        setSelectedElevations([...selectedElevations, elv]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{elv.toFixed(3)}m</span>
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
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            selectedFaces.length > 0
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                    >
                        Face {selectedFaces.length > 0 ? `(${selectedFaces.length})` : ""} ▼
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
                    className="bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm flex items-center gap-1.5"
                    title="Reset 3D View"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Reset View</span>
                </Button>

                {/* Display options dropdown */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "display" ? null : "display")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            openDropdown === "display"
                                ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                    >
                        Display ▼
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
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border border-blue-100 shadow-lg flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        {components.length} Assets Rendered
                    </span>
                </div>
            </div>
        </div>
    );
}
