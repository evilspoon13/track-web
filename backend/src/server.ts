import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import app from "./app";
import http from "node:http";
import { createRealtimeGateway } from "./modules/realtime/realtime.gateway";

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(app);
createRealtimeGateway(server);

server.listen(PORT, () => {
  console.log(`The application is listening on http://localhost:${PORT}`);
});
