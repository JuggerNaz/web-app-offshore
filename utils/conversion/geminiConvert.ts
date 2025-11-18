import * as z from "zod";

const Spec1Schema = z.object({
  PLAT_ID: z.number(),
  TITLE: z.string(),
  PFIELD: z.string(),
  PDESC: z.string(),
  PTYPE: z.string(),
  INST_DATE: z.string(),
  DESG_LIFE: z.number(),
  ST_NORTH: z.string(),
  ST_EAST: z.string(),
  DEPTH: z.number(),
  AN_QTY: z.number(),
  AN_TYPE: z.string(),
  INST_CTR: z.string(),
  WALL_THK: z.number(),
  PROCESS: z.string(),
  PLEGS: z.number(),
  CR_USER: z.string(),
  CR_DATE: z.string(),
  DEF_UNIT: z.string(),
  WORKUNIT: z.string(),
  DLEG: z.number(),
  CONDUCT: z.number(),
  CSLOT: z.number(),
  PILEINT: z.number(),
  PILESKT: z.number(),
  RISER: z.number(),
  FENDER: z.number(),
  SUMP: z.number(),
  CAISSON: z.number(),
  CRANE: z.number(),
  HELIPAD: z.string(),
  MANNED: z.string(),
  LEG_T1: z.string(),
  LEG_T2: z.string(),
  LEG_T3: z.string(),
  LEG_T4: z.string(),
  LEG_T5: z.string(),
  LEG_T6: z.string(),
  LEG_T7: z.number(),
  LEG_T8: z.string(),
  LEG_T9: z.string(),
  LEG_T10: z.number(),
  LEG_T11: z.number(),
  LEG_T12: z.string(),
  LEG_T13: z.string(),
  LEG_T14: z.number(),
  LEG_T15: z.string(),
  LEG_T16: z.number(),
  LEG_T17: z.string(),
  LEG_T18: z.string(),
  LEG_T19: z.string(),
  LEG_T20: z.string(),
  SENT: z.number(),
  MATERIAL: z.number(),
  CP_SYSTEM: z.number(),
  CORR_CTC: z.number(),
  NORTH_ANGLE: z.number(),
  NORTH_SIDE: z.string(),
  NLEG_T1: z.string(),
});

const StrElvSchema = z.object({
  PLAT_ID: z.number(),
  ELV: z.number(),
  ORIENT: z.string(),
  WORKUNIT: z.string(),
  CR_USER: z.string(),
  CR_DATE: z.string(),
});

const StrLevelSchema = z.object({
  PLAT_ID: z.number(),
  LEVEL_NAME: z.string(),
  ELV_FROM: z.number(),
  ELV_TO: z.number(),
  CR_USER: z.string(),
  CR_DATE: z.string(),
  WORKUNIT: z.string(),
});

const StrFacesSchema = z.object({
  PLAT_ID: z.number(),
  FACE: z.string(),
  FACE_DESC: z.string(),
  CR_USER: z.string(),
  CR_DATE: z.string(),
  WORKUNIT: z.string(),
  FACE_FROM: z.string(),
  FACE_TO: z.string(),
});

const Spec2Schema = z.object({
  str_elv: StrElvSchema,
  str_level: StrLevelSchema,
  str_faces: StrFacesSchema,
});

const RootSchema = z.object({
  Spec1: Spec1Schema,
  Spec2: Spec2Schema,
});

// To use the schema:
const jsonData = {
  /* Your JSON data */
};
const parsedData = RootSchema.parse(jsonData);
