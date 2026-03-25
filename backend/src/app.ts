import express from "express";
import { requireAuth } from "./middleware/auth";
import { requireDeviceAuth } from "./middleware/deviceAuth";
import graphicsRoutes from "./modules/graphics/graphics.routes";
import frameParserRoutes from "./modules/frame-parser/frame-parser.routes";
import dbcRotues from "./modules/dbc/dbc.routes";
import logsRoutes from "./modules/logs/logs.routes";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("FSAE Driver Display - Web Server");
});

// device-authenticated routes (X-Device-ID + X-Device-Secret)
app.use("/api/logs", requireDeviceAuth, logsRoutes);

// user-authenticated routes (Firebase token)
app.use("/api", requireAuth);

app.use("/api/graphics", graphicsRoutes);
app.use("/api/frame-parser", frameParserRoutes);
app.use("/api/dbc", dbcRotues);

export default app;
