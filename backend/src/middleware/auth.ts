import type { Request, Response, NextFunction } from "express";
import { adminAuth, db } from "../lib/firebaseAdmin";

declare global {
  namespace Express {
    interface Request { uid: string; deviceId?: string; }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    if (process.env.AUTH_ENABLED === "false") {
      req.uid = "dev-user";
      const userSnap = await db.collection("users").doc(req.uid).get();
      const did = userSnap.exists ? (userSnap.data()?.device_id as string | undefined) : undefined;
      if (did) req.deviceId = did;
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    req.uid = decoded.uid;

    // If the user hasn't been assigned a device yet, try to auto-link them based on email membership.
    const userRef = db.collection("users").doc(req.uid);
    const userSnap = await userRef.get();
    const existingDeviceId = userSnap.exists ? (userSnap.data()?.device_id as unknown) : undefined;
    if (typeof existingDeviceId === "string" && existingDeviceId.trim().length) {
      req.deviceId = existingDeviceId;
      next();
      return;
    }

    let email: string | undefined;
    if (typeof (decoded as { email?: unknown }).email === "string") {
      email = (decoded as { email: string }).email.trim().toLowerCase();
    }
    if (!email) {
      const userRecord = await adminAuth.getUser(req.uid);
      email = userRecord.email?.trim().toLowerCase();
    }

    if (email) {
      const deviceSnaps = await db.collection("devices")
        .where("teamMembers", "array-contains", email)
        .get();

      let newestDeviceId: string | null = null;
      let newestUpdatedAtMs = -1;

      for (const doc of deviceSnaps.docs) {
        const data = doc.data();
        const updatedAt = data.updatedAt as { toMillis?: () => number } | undefined;
        const updatedAtMs = typeof updatedAt?.toMillis === "function" ? updatedAt.toMillis() : 0;
        if (updatedAtMs > newestUpdatedAtMs) {
          newestUpdatedAtMs = updatedAtMs;
          newestDeviceId = (typeof data.device_id === "string" && data.device_id.trim().length)
            ? (data.device_id as string)
            : doc.id;
        }
      }

      if (newestDeviceId) {
        await userRef.set({ device_id: newestDeviceId }, { merge: true });
        req.deviceId = newestDeviceId;
      }
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
