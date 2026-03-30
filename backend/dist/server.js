"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: "../.env" });
const app_1 = __importDefault(require("./app"));
const node_http_1 = __importDefault(require("node:http"));
const realtime_gateway_1 = require("./modules/realtime/realtime.gateway");
const PORT = Number(process.env.PORT) || 3000;
const server = node_http_1.default.createServer(app_1.default);
(0, realtime_gateway_1.createRealtimeGateway)(server);
server.listen(PORT, () => {
    console.log(`The application is listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map