import { z } from "zod";

/**
 * Creates default values for a Zod schema by parsing an empty object.
 * This works by leveraging Zod's built-in optional/nullable/default handling
 * and avoids the compatibility issues with zod-defaults library.
 */
export function getSchemaDefaults<T extends z.ZodTypeAny>(
  schema: T
): z.infer<T> {
  try {
    // Parse an empty object - Zod will apply defaults for optional/nullable fields
    const result = schema.parse({});
    return result;
  } catch (error) {
    // If parsing fails, return an object with undefined values for all fields
    // This handles cases where required fields exist
    return {} as z.infer<T>;
  }
}

/**
 * Alternative approach: Manually create defaults based on schema shape
 * Use this if the simple approach doesn't work for your use case
 */
export function createDefaultValues<T extends z.ZodObject<any>>(
  schema: T
): Partial<z.infer<T>> {
  const shape = schema.shape;
  const defaults: any = {};

  for (const key in shape) {
    const field = shape[key];
    
    // Try to get the default value from the field
    if (field instanceof z.ZodDefault) {
      defaults[key] = field._def.defaultValue();
    } else if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
      // For optional or nullable fields without explicit defaults, set to undefined
      defaults[key] = undefined;
    }
  }

  return defaults;
}
