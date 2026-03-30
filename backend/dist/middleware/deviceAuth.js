"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeviceAuth = requireDeviceAuth;
const DEVICE_SECRET = process.env.DEVICE_SECRET ?? "";
function requireDeviceAuth(req, res, next) {
    const id = req.headers["x-device-id"];
    const secret = req.headers["x-device-secret"];
    if (!id || !secret || secret !== DEVICE_SECRET) {
        res.status(401).json({ error: "Invalid device credentials" });
        return;
    }
    next();
}
//# sourceMappingURL=deviceAuth.js.map