const IS_PROD = process.env.NODE_ENV === "production";
const USE_JSON = IS_PROD || !process.stdout.isTTY;

type Level = "info" | "warn" | "error" | "debug";

function emit(level: Level, ctx: string, msg: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const out = level === "error" ? process.stderr : process.stdout;
  if (USE_JSON) {
    out.write(JSON.stringify({ level, ts, ctx, msg, ...meta }) + "\n");
  } else {
    const extra = meta ? " " + JSON.stringify(meta) : "";
    const line = `[${level.toUpperCase()}] ${ts} [${ctx}] ${msg}${extra}`;
    level === "error" ? console.error(line) : console.log(line);
  }
}

export const logger = {
  info:  (ctx: string, msg: string, meta?: Record<string, unknown>) => emit("info",  ctx, msg, meta),
  warn:  (ctx: string, msg: string, meta?: Record<string, unknown>) => emit("warn",  ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: Record<string, unknown>) => emit("error", ctx, msg, meta),
  debug: (ctx: string, msg: string, meta?: Record<string, unknown>) => emit("debug", ctx, msg, meta),
};
