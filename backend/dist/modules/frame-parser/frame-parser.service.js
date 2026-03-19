"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfig = readConfig;
exports.updateConfig = updateConfig;
const firebaseAdmin_1 = require("../../lib/firebaseAdmin");
const firestore_1 = require("firebase-admin/firestore");
const col = (uid) => firebaseAdmin_1.db.collection("users").doc(uid).collection("frames");
async function readConfig(uid) {
    const snap = await col(uid).get();
    if (snap.empty)
        return null;
    const frames = {};
    snap.docs.forEach((d) => {
        const data = d.data();
        frames[data.can_id] = {
            can_id_label: data.can_id_label,
            signals: data.signals,
        };
    });
    return { frames };
}
async function updateConfig(uid, can_id, frame) {
    await col(uid).doc(can_id)
        .set({ can_id, ...frame, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    return { msg: "Config Updated" };
}
//# sourceMappingURL=frame-parser.service.js.map