import { Router } from "express";
import { getLogDaysHandler, getLogsHandler } from "./logs.controller";

const router = Router();

router.get("/days", getLogDaysHandler);
router.get("/", getLogsHandler);

export default router;
