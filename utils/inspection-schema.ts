/**
 * Utility to resolve shared field references ($ref) in inspection type definitions.
 * This allows defining common fields once and referencing them across different 
 * inspection types or component overrides.
 */

export function resolveFields(fields: any[], sharedFields: Record<string, any>): any[] {
  if (!fields || !Array.isArray(fields)) return [];
  
  return fields.map(field => {
    if (field && typeof field === 'object' && field.$ref) {
      const shared = sharedFields[field.$ref];
      if (!shared) {
        console.warn(`[SchemaResolver] Reference not found: ${field.$ref}`);
        return field;
      }
      // Merge shared field with local overrides
      const resolved = { ...shared, ...field };
      delete resolved.$ref;
      return resolved;
    }
    return field;
  });
}

export function resolveInspectionType(type: any, sharedFields: Record<string, any>): any {
  if (!type) return type;
  
  const resolved = { ...type };
  
  if (resolved.fields) {
    resolved.fields = resolveFields(resolved.fields, sharedFields);
  }
  
  if (resolved.component_overrides && Array.isArray(resolved.component_overrides)) {
    resolved.component_overrides = resolved.component_overrides.map((ov: any) => ({
      ...ov,
      fields: resolveFields(ov.fields, sharedFields)
    }));
  }
  
  return resolved;
}
