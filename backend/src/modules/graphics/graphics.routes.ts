import { Router } from "express";
import * as graphicsController from "./graphics.controller";

const router = Router();

router.get("/", graphicsController.getConfig);

router.get("/screens", graphicsController.getScreenNames);

router.get("/screens/:screenId", graphicsController.getScreenById);

router.delete("/screens/:screenId", graphicsController.deleteScreenById);

router.post("/screens/:screenId", graphicsController.updateScreen);

export default router;
