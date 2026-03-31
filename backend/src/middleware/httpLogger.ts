import type { Request, Response, NextFunction } from "express";
import { logger } from "../common/logger";

const REDACT_KEYS = new Set(["token", "password", "secret", "authorization"]);

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const auth = req.headers.authorization ? "present" : "absent";

  res.on("finish", () => {
    const meta: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      auth,
    };

    if (req.method !== "GET" && req.body && Object.keys(req.body as object).length > 0) {
      meta["body"] = redactBody(req.body);
    }

    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http", `${req.method} ${req.path} ${res.statusCode}`, meta);
  });

  next();
}
