"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const decoded = await firebaseAdmin_1.adminAuth.verifyIdToken(header.slice(7));
        req.uid = decoded.uid;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
//# sourceMappingURL=auth.js.map