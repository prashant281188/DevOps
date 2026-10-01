import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";

const server = app.listen(env.PORT, () => {
  console.log(`API Tier listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// Graceful shutdown handling SIGTERM and SIGINT (Required for Kubernetes / ECS container stops)
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Initiating graceful teardown...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await pool.end();
      console.log("PostgreSQL connection pool drained.");
      process.exit(0);
    } catch (err) {
      console.error("Error closing DB pool:", err);
      process.exit(1);
    }
  });

  // Force close if clean teardown hangs
  setTimeout(() => {
    console.error("Forced teardown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
