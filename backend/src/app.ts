import express from "express";
import graphicsRoutes from "./modules/graphics/graphics.routes";
import frameParserRoutes from "./modules/frame-parser/frame-parser.routes";
import dbcRotues from "./modules/dbc/dbc.routes";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("FSAE Driver Display - Web Server");
});

app.use("/api/graphics", graphicsRoutes);
app.use("/api/frame-parser", frameParserRoutes);
app.use("/api/dbc", dbcRotues);

export default app;
