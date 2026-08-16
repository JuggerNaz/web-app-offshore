export interface Node3D {
  id: string;
  name: string; // e.g., 'WN N1'
  x: number;
  y: number;
  z: number;
}

export interface Member3D {
  id: string;
  name: string; // e.g., 'VEM N1-N6'
  startNodeId: string;
  endNodeId: string;
}

export interface PlatformLeg {
  legId: string;
  mainMembers: Member3D[];
  mainNodes: Node3D[];
}

/**
 * Detects main leg members and their associated nodes based on 3D coordinates and connectivity.
 * 
 * Logic based on BEP-A platform examples (e.g., Legs A1 and A2):
 * 1. Identifies vertical/battered members based on their angle to the vertical (Z-axis).
 * 2. Groups these leg-like members into continuous chains (legs).
 * 3. Identifies main nodes as the endpoints of these members.
 * 4. Also detects intermediate nodes (e.g. WN N46 on VEM N34-N56, WN N47 on VEM N40-N71)
 *    that are collinear with the leg members.
 */
export function detectPlatformLegs(nodes: Node3D[], members: Member3D[]): PlatformLeg[] {
  const nodeMap = new Map<string, Node3D>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // 1. Identify potential leg members (steep angle with vertical axis)
  // Assuming Y is up (standard for ThreeJS). Leg members typically have an angle <= 30 degrees from vertical.
  const MAX_LEG_ANGLE_DEG = 30;
  
  const legLikeMembers = members.filter(m => {
    const start = nodeMap.get(m.startNodeId);
    const end = nodeMap.get(m.endNodeId);
    if (!start || !end) return false;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length === 0) return false;

    // Angle with Y axis
    const angleRad = Math.acos(Math.abs(dy) / length);
    const angleDeg = angleRad * (180 / Math.PI);
    
    // Strictly only consider members with "VEM" or "LEG" in their name/qid
    const nameUpper = m.name.toUpperCase();
    const isLegName = nameUpper.includes('VEM') || nameUpper.includes('LEG');
    return angleDeg <= MAX_LEG_ANGLE_DEG && isLegName;
  });

  // 2. Group into continuous chains
  const adjacency = new Map<string, Member3D[]>();
  legLikeMembers.forEach(m => {
    if (!adjacency.has(m.startNodeId)) adjacency.set(m.startNodeId, []);
    if (!adjacency.has(m.endNodeId)) adjacency.set(m.endNodeId, []);
    adjacency.get(m.startNodeId)!.push(m);
    adjacency.get(m.endNodeId)!.push(m);
  });

  const visitedMembers = new Set<string>();
  const allChains: Member3D[][] = [];

  legLikeMembers.forEach(m => {
    if (visitedMembers.has(m.id)) return;

    const chain: Member3D[] = [];
    const queue: Member3D[] = [m];
    visitedMembers.add(m.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      chain.push(current);

      const adjacent1 = adjacency.get(current.startNodeId) || [];
      const adjacent2 = adjacency.get(current.endNodeId) || [];
      
      for (const adj of [...adjacent1, ...adjacent2]) {
        if (!visitedMembers.has(adj.id)) {
          visitedMembers.add(adj.id);
          queue.push(adj);
        }
      }
    }
    allChains.push(chain);
  });

  if (allChains.length === 0) {
    return [];
  }

  // Calculate height span and center of gravity for each chain
  const chainDetails = allChains.map(chainMembers => {
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumZ = 0;
    let count = 0;

    chainMembers.forEach(m => {
      const s = nodeMap.get(m.startNodeId);
      const e = nodeMap.get(m.endNodeId);
      if (s) {
        minY = Math.min(minY, s.y);
        maxY = Math.max(maxY, s.y);
        sumX += s.x;
        sumZ += s.z;
        count++;
      }
      if (e) {
        minY = Math.min(minY, e.y);
        maxY = Math.max(maxY, e.y);
        sumX += e.x;
        sumZ += e.z;
        count++;
      }
    });

    const heightSpan = maxY - minY;
    const avgX = count > 0 ? sumX / count : 0;
    const avgZ = count > 0 ? sumZ / count : 0;

    return { chainMembers, heightSpan, minY, maxY, avgX, avgZ };
  });

  // Filter 1: Exclude short secondary vertical struts (must span at least 45% of maximum leg chain height)
  const maxSpan = Math.max(...chainDetails.map(c => c.heightSpan), 0);
  const majorChains = chainDetails.filter(c => c.heightSpan >= maxSpan * 0.45 && c.heightSpan > 1.0);

  // Filter 2: Distinguish main outer corner legs from mid-face vertical struts based on distance from platform center
  let platformCenterX = 0;
  let platformCenterZ = 0;
  if (majorChains.length > 0) {
    platformCenterX = majorChains.reduce((sum, c) => sum + c.avgX, 0) / majorChains.length;
    platformCenterZ = majorChains.reduce((sum, c) => sum + c.avgZ, 0) / majorChains.length;
  }

  const chainsWithRadius = majorChains.map(c => {
    const dx = c.avgX - platformCenterX;
    const dz = c.avgZ - platformCenterZ;
    const distFromCenter = Math.sqrt(dx * dx + dz * dz);
    return { ...c, distFromCenter };
  });

  // Group chains into 4 spatial quadrants to isolate true corner leg columns
  const quadrants = new Map<number, typeof chainsWithRadius>();
  chainsWithRadius.forEach(c => {
    const qIndex = (c.avgX >= platformCenterX ? 1 : 0) + (c.avgZ >= platformCenterZ ? 2 : 0);
    if (!quadrants.has(qIndex)) quadrants.set(qIndex, []);
    quadrants.get(qIndex)!.push(c);
  });

  const selectedChains: typeof chainsWithRadius = [];
  quadrants.forEach(qChains => {
    qChains.sort((a, b) => b.distFromCenter - a.distFromCenter);
    const maxDistInQuadrant = qChains[0].distFromCenter;

    // Filter out mid-face members (which sit closer to center than outer corner legs)
    qChains.forEach(c => {
      if (c.distFromCenter >= maxDistInQuadrant * 0.85) {
        selectedChains.push(c);
      }
    });
  });

  const finalChains = selectedChains.length > 0 ? selectedChains : majorChains;

  // 3 & 4. Find all nodes for each main leg (endpoints + collinear intermediate nodes)
  const platformLegs: PlatformLeg[] = [];
  
  finalChains.forEach((chainDetail, index) => {
    const chainMembers = chainDetail.chainMembers;
    const legNodesSet = new Set<string>();
    
    // Add all explicit endpoints
    chainMembers.forEach(m => {
      legNodesSet.add(m.startNodeId);
      legNodesSet.add(m.endNodeId);
    });

    // Find collinear intermediate nodes
    nodes.forEach(n => {
      if (legNodesSet.has(n.id)) return;

      for (const m of chainMembers) {
        const start = nodeMap.get(m.startNodeId);
        const end = nodeMap.get(m.endNodeId);
        if (!start || !end) continue;

        if (isPointOnSegment(n, start, end)) {
          legNodesSet.add(n.id);
          break;
        }
      }
    });

    const mainNodes = Array.from(legNodesSet)
      .map(id => nodeMap.get(id)!)
      .sort((a, b) => b.y - a.y); // Sort top to bottom

    const sortedMembers = chainMembers.sort((a, b) => {
      const ay = Math.max(nodeMap.get(a.startNodeId)!.y, nodeMap.get(a.endNodeId)!.y);
      const by = Math.max(nodeMap.get(b.startNodeId)!.y, nodeMap.get(b.endNodeId)!.y);
      return by - ay;
    });

    let legId = `Leg ${index + 1}`;

    platformLegs.push({
      legId,
      mainMembers: sortedMembers,
      mainNodes
    });
  });

  return platformLegs;
}

/**
 * Checks if a point lies on the line segment between A and B with a small tolerance.
 */
function isPointOnSegment(p: Node3D, a: Node3D, b: Node3D, tolerance: number = 0.1): boolean {
  const dX = b.x - a.x;
  const dY = b.y - a.y;
  const dZ = b.z - a.z;
  
  const lenAB = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
  if (lenAB === 0) return false;

  const dXp = p.x - a.x;
  const dYp = p.y - a.y;
  const dZp = p.z - a.z;

  const lenAP = Math.sqrt(dXp * dXp + dYp * dYp + dZp * dZp);
  
  const dXpb = p.x - b.x;
  const dYpb = p.y - b.y;
  const dZpb = p.z - b.z;
  
  const lenPB = Math.sqrt(dXpb * dXpb + dYpb * dYpb + dZpb * dZpb);

  // If the sum of the distances from point to A and point to B is roughly equal to distance A to B,
  // it is collinear and between A and B.
  return Math.abs((lenAP + lenPB) - lenAB) <= tolerance;
}

/**
 * Utility to extract node & member geometry from 3D viewer layouts, run leg detection,
 * and return Sets of main leg member IDs and main leg node weld IDs.
 */
export function getMainLegElementSets(layouts: any[]): {
  mainMemberIds: Set<string>;
  mainNodeIds: Set<string>;
} {
  const mainMemberIds = new Set<string>();
  const mainNodeIds = new Set<string>();

  if (!Array.isArray(layouts) || layouts.length === 0) {
    return { mainMemberIds, mainNodeIds };
  }

  const parseVec3 = (v: any): { x: number; y: number; z: number } | null => {
    if (!v) return null;
    if (Array.isArray(v) && v.length >= 3) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 };
    if (typeof v === "object" && "x" in v && "y" in v && "z" in v) return { x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0 };
    return null;
  };

  const nodes: Node3D[] = [];
  const members: Member3D[] = [];

  layouts.forEach((layout, idx) => {
    const comp = layout.component || layout.originalComp || layout;
    const code = (comp?.code || layout.code || "").toUpperCase();
    const qId = (comp?.q_id || layout.q_id || "").toUpperCase();
    const itemId = String(comp?.id || layout.id || `item_${idx}`);

    const start = parseVec3(layout.start || layout.position);
    const end = parseVec3(layout.end || layout.position);

    // If it has both start & end, it can be a member or node weld
    if (start && end) {
      const isLegMemberName = code.startsWith("VEM") || qId.startsWith("VEM") || code.includes("LEG") || qId.includes("LEG");
      
      // Node IDs based on q_id or position key
      const startNodeId = `pos_${start.x.toFixed(2)}_${start.y.toFixed(2)}_${start.z.toFixed(2)}`;
      const endNodeId = `pos_${end.x.toFixed(2)}_${end.y.toFixed(2)}_${end.z.toFixed(2)}`;

      if (!nodes.some(n => n.id === startNodeId)) {
        nodes.push({ id: startNodeId, name: startNodeId, x: start.x, y: start.y, z: start.z });
      }
      if (!nodes.some(n => n.id === endNodeId)) {
        nodes.push({ id: endNodeId, name: endNodeId, x: end.x, y: end.y, z: end.z });
      }

      members.push({
        id: itemId,
        name: qId || code || itemId,
        startNodeId,
        endNodeId,
      });
    } else if (start) {
      // Standalone node
      nodes.push({
        id: itemId,
        name: qId || code || itemId,
        x: start.x,
        y: start.y,
        z: start.z,
      });
    }
  });

  const detectedLegs = detectPlatformLegs(nodes, members);

  const mainNodePosKeys = new Set<string>();

  detectedLegs.forEach(leg => {
    leg.mainMembers.forEach(m => mainMemberIds.add(m.id));
    leg.mainNodes.forEach(n => mainNodePosKeys.add(n.id));
  });

  // Map the detected position keys back to the actual layout IDs for nodes and welds
  layouts.forEach((layout, idx) => {
    const comp = layout.component || layout.originalComp || layout;
    const itemId = String(comp?.id || layout.id || `item_${idx}`);
    
    const start = parseVec3(layout.start || layout.position);
    const end = parseVec3(layout.end || layout.position);

    if (start) {
      const sKey = `pos_${start.x.toFixed(2)}_${start.y.toFixed(2)}_${start.z.toFixed(2)}`;
      if (mainNodePosKeys.has(sKey) || mainNodePosKeys.has(itemId)) {
        mainNodeIds.add(itemId);
      }
    }
    if (end) {
      const eKey = `pos_${end.x.toFixed(2)}_${end.y.toFixed(2)}_${end.z.toFixed(2)}`;
      if (mainNodePosKeys.has(eKey) || mainNodePosKeys.has(itemId)) {
        mainNodeIds.add(itemId);
      }
    }
  });

  return { mainMemberIds, mainNodeIds };
}
