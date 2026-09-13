/**
 * 3D Environment Session Memory & Cloud State Persistence Utility
 * Manages local caching, debounced updates, and background cloud synchronization
 * for 3D camera positioning, target coordinates, selected components, and filters.
 */

export interface Platform3DSessionState {
  platformId: number | string;
  cameraPosition: [number, number, number];
  controlsTarget: [number, number, number];
  cameraDistance?: number;
  selectedCompId?: number | null;
  isSpecOpen?: boolean;
  selectedElevations?: number[];
  selectedFaces?: string[];
  showWater?: boolean;
  showGrid?: boolean;
  showWeldNumbering?: boolean;
  showElevations?: boolean;
  colorMode?: string;
  focusTargetPos?: [number, number, number] | null;
  focusedCompName?: string | null;
  timestamp?: number;
}

const STORAGE_PREFIX = "platform_3d_state_";
const ACTIVE_PLATFORM_KEY = "platform_3d_active_platform_id";

// Debounce map for server synchronization per platform
const syncTimers: Record<string, NodeJS.Timeout> = {};

/**
 * Get the currently active platform ID from local storage
 */
export function getActivePlatformId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_PLATFORM_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  } catch (e) {
    return null;
  }
}

/**
 * Set the currently active platform ID
 */
export function setActivePlatformId(platformId: number | string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (platformId !== null && platformId !== undefined && platformId !== 0) {
      localStorage.setItem(ACTIVE_PLATFORM_KEY, String(platformId));
    } else {
      localStorage.removeItem(ACTIVE_PLATFORM_KEY);
    }
  } catch (e) {
    console.error("Failed to set active platform ID", e);
  }
}

/**
 * Load 3D session state from local storage (synchronous instant read)
 */
export function loadPlatform3DSession(platformId: number | string): Platform3DSessionState | null {
  if (typeof window === "undefined" || !platformId) return null;
  try {
    const key = `${STORAGE_PREFIX}${platformId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: Platform3DSessionState = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.error(`Failed to load 3D session for platform ${platformId}`, e);
    return null;
  }
}

/**
 * Save 3D session state to local storage immediately,
 * and sync to backend API with debouncing (500ms)
 */
export function savePlatform3DSession(
  platformId: number | string,
  stateUpdate: Partial<Platform3DSessionState>,
  immediateCloudSync: boolean = false
): void {
  if (typeof window === "undefined" || !platformId) return;

  const key = `${STORAGE_PREFIX}${platformId}`;
  let currentState: Platform3DSessionState = {
    platformId,
    cameraPosition: [45, 45, 45],
    controlsTarget: [0, 0, 0],
    ...stateUpdate,
    timestamp: Date.now(),
  };

  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      currentState = {
        ...parsed,
        ...stateUpdate,
        platformId,
        timestamp: Date.now(),
      };
    }
    localStorage.setItem(key, JSON.stringify(currentState));
  } catch (e) {
    console.error(`Failed to write local 3D session for platform ${platformId}`, e);
  }

  // Background cloud sync with debounce
  const syncKey = String(platformId);
  if (syncTimers[syncKey]) {
    clearTimeout(syncTimers[syncKey]);
  }

  const performSync = async () => {
    try {
      await fetch("/api/platform/3d-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentState),
      });
    } catch (err) {
      // Silent catch for offline or non-blocking network sync
    }
  };

  if (immediateCloudSync) {
    performSync();
  } else {
    syncTimers[syncKey] = setTimeout(performSync, 500);
  }
}

/**
 * Clear 3D session state for a platform (e.g. on Reset View)
 */
export function clearPlatform3DSession(platformId: number | string): void {
  if (typeof window === "undefined" || !platformId) return;
  try {
    const key = `${STORAGE_PREFIX}${platformId}`;
    localStorage.removeItem(key);

    // Also notify cloud endpoint
    fetch(`/api/platform/3d-session?platformId=${platformId}`, {
      method: "DELETE",
    }).catch(() => {});
  } catch (e) {
    console.error(`Failed to clear 3D session for platform ${platformId}`, e);
  }
}

/**
 * Fetch 3D session state from cloud backend (asynchronous verification)
 */
export async function fetchCloud3DSession(platformId: number | string): Promise<Platform3DSessionState | null> {
  if (!platformId) return null;
  try {
    const res = await fetch(`/api/platform/3d-session?platformId=${platformId}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.data) {
      // Update local storage cache if newer
      const key = `${STORAGE_PREFIX}${platformId}`;
      localStorage.setItem(key, JSON.stringify(json.data));
      return json.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}
