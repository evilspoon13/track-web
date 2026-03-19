"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.atomicWriteJson = atomicWriteJson;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
async function atomicWriteJson(filePath, value) {
    const dir = node_path_1.default.dirname(filePath);
    const base = node_path_1.default.basename(filePath);
    const tmpPath = node_path_1.default.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
    const payload = JSON.stringify(value, null, 2);
    try {
        await node_fs_1.default.promises.writeFile(tmpPath, payload, { encoding: "utf-8" });
        await node_fs_1.default.promises.rename(tmpPath, filePath);
    }
    catch (err) {
        await node_fs_1.default.promises.unlink(tmpPath).catch(() => { });
        throw err;
    }
}
//# sourceMappingURL=json-helpers.js.map