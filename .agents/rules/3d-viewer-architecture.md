# 3D Viewer Architecture Rule

## Single Source of Truth

The Inspection Workspace 3D viewer and the Platform 3D module viewer share the **exact same component**: `Structural3DViewer` from `app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx`.

- The Inspection module dynamically imports `Structural3DViewer` via `WorkspaceResources.tsx`.
- The Platform 3D module renders it directly from `platform-3d/page.tsx`.

## Directive: One-Way Propagation

1. **Any 3D rendering, object plotting, component classification, or visual change made in the Platform 3D module MUST automatically apply to the Inspection Workspace 3D viewer.** Since both use the same `Structural3DViewer` component, this happens naturally — do NOT create a separate copy.

2. **Inspection-specific behavior** (e.g. `isInspectionWorkspace`, `compactMode`, inspection record overlays) is controlled via props, NOT via a separate component.

3. **Changes to the Inspection 3D viewer's inspection-specific behavior MUST NOT affect the Platform 3D module.** Use the `isInspectionWorkspace` or `compactMode` prop guards for inspection-only features.

## Component Filter Consistency

The component `excludeCodes` filter exists in THREE places that must stay synchronized:
1. **Backend API route**: `app/api/platform/webapp-3d/[structure_id]/route.ts` (line ~92)
2. **Frontend filter inside Structural3DViewer**: `Structural3DViewer.tsx` (line ~2516)
3. **Frontend procedural math**: `utils/platform-3d-math.ts`

When adding or removing a code from `excludeCodes`, update ALL THREE locations. Riser supports/clamps (`CL`, `RC`, `SUPP`, `CLP`, `CLAM`) must always be whitelisted.

## Custom 3D Object Classification

The classification logic (`isClamp`, `isRiserSupport`, `isFender`, `isRiserGuard`, `isCaissonSupport`) exists in TWO places inside `Structural3DViewer.tsx`:
1. **ComponentMesh** function (~line 130): Individual mesh rendering
2. **InstancedComponentViewer** function (~line 1282): Layout grouping into `customLayouts` vs instanced geometry

Both must use identical classification logic. When updating one, update the other.
