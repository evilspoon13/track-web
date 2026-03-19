"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.adminAuth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)(process.env.FIREBASE_CLIENT_EMAIL
        ? {
            credential: (0, app_1.cert)({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
        }
        : { projectId: process.env.FIREBASE_PROJECT_ID });
}
exports.adminAuth = (0, auth_1.getAuth)();
exports.db = (0, firestore_1.getFirestore)();
//# sourceMappingURL=firebaseAdmin.js.map