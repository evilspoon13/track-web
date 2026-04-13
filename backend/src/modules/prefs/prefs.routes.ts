import { Router } from "express";
import * as prefsController from "./prefs.controller";

const router = Router();

router.get("/screens", prefsController.getScreenPrefs);
router.put("/screens", prefsController.updateScreenPrefs);

export default router;
