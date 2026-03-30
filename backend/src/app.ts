import express from "express";
import { requireAuth } from "./middleware/auth";
import { requireDeviceAuth } from "./middleware/deviceAuth";
import graphicsRoutes from "./modules/graphics/graphics.routes";
import dbcRoutes from "./modules/dbc/dbc.routes";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("FSAE Driver Display - Web Server");
});

// user-authenticated routes (Firebase token)
app.use("/api", requireAuth);

app.use("/api/graphics", graphicsRoutes);
app.use("/api/dbc", dbcRoutes);

export default app;
