import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp(
    process.env.FIREBASE_CLIENT_EMAIL
      ? {
          credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
        }
      : { projectId: process.env.FIREBASE_PROJECT_ID! }
  );
}

export const adminAuth = getAuth();
export const db        = getFirestore();
