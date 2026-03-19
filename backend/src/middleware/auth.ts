import type { Request, Response, NextFunction } from "express";
import { adminAuth } from "../lib/firebaseAdmin";

declare global {
  namespace Express {
    interface Request { uid: string; }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
