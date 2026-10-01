import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import itemRoutes from "./routes/item.routes.js";
import { metricsMiddleware, metricsEndpoint } from "./middleware/metrics.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(",") }));
app.use(express.json());
app.use(pinoHttp());
app.use(metricsMiddleware);

// Observability endpoints
app.use("/health", healthRoutes);
app.get("/metrics", metricsEndpoint);

// Business routes
app.use("/api/v1/items", itemRoutes);

// Error boundary
app.use(errorHandler);
