import { Router } from "express";
import * as devicesController from "./devices.controller";

const router = Router();

router.post("/register", devicesController.registerDevice);

export default router;

