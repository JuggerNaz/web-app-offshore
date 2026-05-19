// @ts-ignore
import oracledb from "oracledb";

// Ensure thin mode is explicitly enabled
let isInitialized = false;

export interface OracleConnectionConfig {
  user?: string;
  password?: string;
  connectString?: string;
  host?: string;
  port?: number;
  serviceName?: string;
  useThickMode?: boolean;
  libDir?: string;
}

/**
 * Initialize oracledb. Must be called before setting global properties or connecting.
 */
function initializeOracledb(config: OracleConnectionConfig) {
  if (isInitialized) return;

  // 1. Enable Thick Mode if requested for legacy connections (e.g. Oracle 10g/11g)
  if (config.useThickMode) {
    try {
      const initOpts: any = {};
      if (config.libDir) {
        initOpts.libDir = config.libDir;
      }
      oracledb.initOracleClient(initOpts);
      console.log("[Oracle DB] Successfully initialized in THICK Mode using client libraries from:", config.libDir || "system path");
    } catch (err: any) {
      if (!err.message.includes("already initialized") && !err.message.includes("already active")) {
        console.warn("[Oracle Thick Mode Init Warning]:", err.message);
      }
    }
  } else {
    console.log("[Oracle DB] Initializing in Thin Mode by default");
  }

  // 2. Set global properties ONLY AFTER calling initOracleClient
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER]; // Prevents precision loss on large IDs
  
  isInitialized = true;
}

/**
 * Get an Oracle database connection.
 * @param config Oracle connection settings (either connectString or host/port/serviceName)
 * @returns Oracle Connection
 */
export async function getOracleConnection(config: OracleConnectionConfig) {
  // Always trigger the lazy initializer first
  initializeOracledb(config);

  let connectString = config.connectString;
  
  if (!connectString && config.host && config.serviceName) {
    const port = config.port || 1521;
    connectString = `${config.host}:${port}/${config.serviceName}`;
  }

  if (!connectString || !config.user || !config.password) {
    throw new Error("Missing required Oracle database connection parameters.");
  }

  // Generate a pool alias based on connection string + user to reuse pools if needed
  const poolAlias = Buffer.from(`${config.user}@${connectString}`).toString('base64');
  
  let pool;
  try {
    pool = oracledb.getPool(poolAlias);
  } catch (err) {
    // Pool doesn't exist, create it
    pool = await oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: connectString,
      poolAlias: poolAlias,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1
    });
  }

  return await pool.getConnection();
}
