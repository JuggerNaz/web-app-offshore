const { getOracleConnection } = require("../utils/oracle-db");
require("dotenv").config({ path: "../.env.local" });

// Since the credentials are usually read from request body, let's look at what's in local files or env.
// Wait, we can load oracle config from a known local source if it's stored.
// Let's print the environment variables to see if there's any oracle credentials.
console.log(process.env);
