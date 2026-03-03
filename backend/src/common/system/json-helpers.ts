import fs from "node:fs";
import path from "node:path";

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);

  const payload = JSON.stringify(value, null, 2);

  try {
    await fs.promises.writeFile(tmpPath, payload, { encoding: "utf-8" });
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw err;
  }
}