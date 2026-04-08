import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import app from "./app";
import http from "node:http";
import { createRealtimeGateway } from "./modules/realtime/realtime.gateway";
import { logger } from "./common/logger";

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(app);
createRealtimeGateway(server);

server.listen(PORT, () => {
  logger.info("startup", "Server listening", {
    port: PORT,
    env: process.env.NODE_ENV ?? "development",
    firebaseAuthEmulator: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? null,
    firestoreEmulator: process.env.FIRESTORE_EMULATOR_HOST ?? null,
  });
});
