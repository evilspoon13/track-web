"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRealtimeGateway = createRealtimeGateway;
const ws_1 = require("ws");
const RealtimeService = __importStar(require("./realtime.service"));
function createRealtimeGateway(server) {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (socket, req) => {
        const path = req.url ?? "";
        let activePiId;
        let activeClientId;
        if (path === "/ws/pi") {
            console.log("[ws] Pi connected");
            socket.on("message", (data) => {
                activePiId = RealtimeService.handlePiMessage(socket, data, activePiId);
            });
            socket.on("close", () => {
                console.log("[ws] Pi disconnected");
                if (activePiId) {
                    RealtimeService.disconnectPi(activePiId);
                }
            });
        }
        else if (path === "/ws/client") {
            console.log("[ws] client connected");
            socket.on("message", (data) => {
                activeClientId = RealtimeService.handleClientMessage(socket, data, activeClientId);
            });
            socket.on("close", () => {
                console.log("[ws] client disconnected");
                if (activeClientId) {
                    RealtimeService.disconnectClient(activeClientId);
                }
            });
        }
        else {
            socket.close(1008, "Invalid websocket path");
        }
    });
}
//# sourceMappingURL=realtime.gateway.js.map