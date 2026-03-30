import { Router } from "express";

const router = Router();

// Placeholder endpoints: the log terminal feature is currently mocked on the frontend.
// This module exists so the backend can compile and deploy cleanly.

router.get("/history", (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const before = req.query.before ? Number(req.query.before) : undefined;

  res.status(200).json({
    entries: [],
    meta: {
      limit: Number.isFinite(limit) ? limit : 100,
      before: Number.isFinite(before) ? before : undefined,
      implemented: false,
    },
  });
});

router.get("/live", (_req, res) => {
  res.status(426).json({
    message: "WebSocket upgrade required. This endpoint is not implemented yet.",
    implemented: false,
  });
});

export default router;
