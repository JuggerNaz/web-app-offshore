// @ts-ignore
import oracledb from "oracledb";
import fs from "fs";

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
 * Checks if an error is an Oracle connection loss or disconnect error.
 */
export function isOracleDisconnectError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toUpperCase();
  const code = (err.code || "").toUpperCase();
  
  return (
    msg.includes("ORA-03113") || // end-of-file on communication channel
    msg.includes("ORA-03114") || // not connected to ORACLE
    msg.includes("ORA-03135") || // connection lost contact
    msg.includes("ORA-12541") || // TNS:no listener
    msg.includes("ORA-12543") || // TNS:destination host unreachable
    msg.includes("ORA-12571") || // TNS:packet writer failure
    msg.includes("ORA-01034") || // ORACLE not available
    msg.includes("ORA-01089") || // oracle immediate shutdown in progress
    msg.includes("NJS-500") ||   // connection to the Oracle Database was broken
    msg.includes("NJS-502") ||   // connection was closed
    msg.includes("NJS-503") ||   // connection pool is closed
    msg.includes("NJS-040") ||   // connection pool is closed
    msg.includes("NJS-003") ||   // invalid pool
    msg.includes("CONNECTION WAS BROKEN") ||
    msg.includes("NOT CONNECTED") ||
    msg.includes("END-OF-FILE ON COMMUNICATION CHANNEL") ||
    msg.includes("CONNECTION LOST") ||
    msg.includes("SOCKET CLOSED") ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED"
  );
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
  oracledb.fetchArraySize = 100; // Batch fetching to prevent memory exhaustion and socket timeouts
  
  isInitialized = true;
}

/**
 * Get an Oracle database connection from a managed resilient pool.
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
    pool = null;
  }

  if (!pool) {
    try {
      pool = await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: connectString,
        poolAlias: poolAlias,
        poolMin: 0, // Set to 0 so idle connections are not held indefinitely and don't become stale zombies
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 60, // 60s idle timeout
        poolPingInterval: 1, // Validate connection before checkout from pool
        queueTimeout: 60000 // 60s queue wait
      });
    } catch (createErr: any) {
      console.error("[Oracle Pool Creation Error]:", createErr.message);
      throw createErr;
    }
  }

  try {
    return await pool.getConnection();
  } catch (connErr: any) {
    // If pool is broken or closed, close it and retry once with a fresh pool
    console.warn("[Oracle Pool getConnection Failed]:", connErr.message, "Attempting fresh pool recreation...");
    try {
      await pool.close(0);
    } catch (_) {}

    const freshPool = await oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: connectString,
      poolAlias: poolAlias,
      poolMin: 0,
      poolMax: 10,
      poolIncrement: 1,
      poolTimeout: 60,
      poolPingInterval: 1,
      queueTimeout: 60000
    });

    return await freshPool.getConnection();
  }
}

/**
 * Closes an Oracle connection pool for the given config or poolAlias.
 */
export async function closeOraclePool(config?: OracleConnectionConfig) {
  if (!config) {
    return await closeAllOraclePools();
  }
  let connectString = config.connectString;
  if (!connectString && config.host && config.serviceName) {
    const port = config.port || 1521;
    connectString = `${config.host}:${port}/${config.serviceName}`;
  }
  if (!connectString || !config.user) {
    return await closeAllOraclePools();
  }
  const poolAlias = Buffer.from(`${config.user}@${connectString}`).toString('base64');
  try {
    const pool = oracledb.getPool(poolAlias);
    if (pool) {
      await pool.close(5); // Drain in 5 seconds
      console.log("[Oracle DB] Closed connection pool for alias successfully.");
    }
  } catch (_) {
    // Pool does not exist or already closed
  }
}

/**
 * Closes all active Oracle connection pools.
 */
export async function closeAllOraclePools() {
  try {
    const pools = (oracledb as any).pools;
    if (pools && typeof pools === 'object') {
      const poolKeys = Object.keys(pools);
      for (const key of poolKeys) {
        try {
          const pool = oracledb.getPool(key);
          if (pool) {
            await pool.close(2);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}
