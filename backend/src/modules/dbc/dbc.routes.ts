import { Router } from "express";
import * as dbcController from "./dbc.controller";

const router = Router();

router.get("/", dbcController.getDbc);

router.post("/", dbcController.updateDbc);

export default router;
