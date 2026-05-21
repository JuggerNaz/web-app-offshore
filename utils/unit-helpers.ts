import unitConfig from "./types/units.json";

/**
 * Returns available unit options for a given category and unit system preference.
 */
export const getUnitOptions = (category: string | null, isImperial: boolean) => {
  if (!category) return [];
  const upperCategory = category.toUpperCase().trim();
  const catKey = upperCategory === 'WEIGHT' ? 'MASS' : upperCategory;
  const data = (unitConfig as any)[catKey];
  if (!data) return [];

  if (isImperial) {
    return Array.from(new Set([...data.imperial, ...data.metric]));
  } else {
    return Array.from(new Set([...data.metric, ...data.imperial]));
  }
};

/**
 * Returns the default unit for a given category and unit system preference.
 * Includes legacy overrides for specific component types.
 */
export const getDefaultUnit = (category: string | null, isImperial: boolean, fieldName?: string, componentCode?: string) => {
  const code = componentCode?.toLowerCase() || '';
  const lowerField = fieldName?.toLowerCase() || '';

  // Overrides for specific fields often used for elevations or short distances
  if (category?.toLowerCase() === 'length') {
    if (lowerField.includes('elv') || lowerField.includes('elevation') || lowerField.includes('dist')) {
      return isImperial ? 'ft' : 'm';
    }
  }

  // Legacy overrides
  if (!isImperial && category?.toLowerCase() === 'length' && (code === 'ce' || code === 'gs')) {
    return 'm';
  }

  
  if (!category) return null;
  const upperCategory = category.toUpperCase();
  const catKey = upperCategory === 'WEIGHT' ? 'MASS' : upperCategory;
  const data = (unitConfig as any)[catKey];
  if (!data) return null;

  return isImperial ? data.defaultImperial : data.defaultMetric;
};

