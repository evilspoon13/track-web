"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScreenNames = getScreenNames;
exports.getScreenById = getScreenById;
exports.saveScreen = saveScreen;
exports.deleteScreenById = deleteScreenById;
const firebaseAdmin_1 = require("../../lib/firebaseAdmin");
const firestore_1 = require("firebase-admin/firestore");
const col = (uid) => firebaseAdmin_1.db.collection("users").doc(uid).collection("screens");
async function getScreenNames(uid) {
    const snap = await col(uid).select("name").get();
    if (snap.empty)
        return null;
    return snap.docs.map((d) => d.data().name);
}
async function getScreenById(uid, name) {
    const snap = await col(uid).where("name", "==", name).limit(1).get();
    if (snap.empty)
        return null;
    return snap.docs[0].data();
}
async function saveScreen(uid, screenId, screen) {
    await col(uid).doc(encodeURIComponent(screenId))
        .set({ ...screen, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    return { msg: "Config Updated" };
}
async function deleteScreenById(uid, name) {
    const snap = await col(uid).where("name", "==", name).limit(1).get();
    if (snap.empty)
        return { msg: "fail" };
    await snap.docs[0].ref.delete();
    return { msg: "Screen Deleted" };
}
//# sourceMappingURL=graphics.service.js.map