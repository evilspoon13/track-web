import { Router } from "express";
import { getLogsHandler } from "./logs.controller";

const router = Router();

router.get("/", getLogsHandler);

export default router;
