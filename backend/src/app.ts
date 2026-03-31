import express, { type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "./middleware/auth";
import { requireDeviceAuth } from "./middleware/deviceAuth";
import { httpLogger } from "./middleware/httpLogger";
import { logger } from "./common/logger";
import graphicsRoutes from "./modules/graphics/graphics.routes";
import dbcRoutes from "./modules/dbc/dbc.routes";
import logsRoutes from "./modules/logs/logs.routes";

const app = express();

app.use(httpLogger);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("FSAE Driver Display - Web Server");
});

// user-authenticated routes (Firebase token)
app.use("/api", requireAuth);

app.use("/api/graphics", graphicsRoutes);
app.use("/api/dbc", dbcRoutes);
app.use("/api/logs", logsRoutes);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? err.stack    : undefined;
  logger.error("http", `Unhandled error: ${message}`, { method: req.method, path: req.path, stack });
  res.status(500).json({ error: "Internal server error" });
});

export default app;
