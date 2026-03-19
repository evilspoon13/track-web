"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectPi = disconnectPi;
exports.disconnectClient = disconnectClient;
exports.handlePiMessage = handlePiMessage;
exports.handleClientMessage = handleClientMessage;
const ws_1 = require("ws");
let clientSockets = new Map();
const piSockets = new Map();
const socketToPiId = new Map();
const socketToClientId = new Map();
let currentPi = null;
const PI_DEADLINE_MS = 20_000;
const PI_MONITOR_INTERVAL_MS = 5_000;
setInterval(() => {
    const now = Date.now();
    for (const [piId, connection] of piSockets.entries()) {
        const ageMs = now - connection.lastHeartbeat;
        if (ageMs > PI_DEADLINE_MS) {
            console.log(`[ws] Pi ${piId} stale (${ageMs}ms). dropping`);
            try {
                connection.socket.close(1000, "Pi heartbeat missed");
            }
            catch {
                // ignore close failures
            }
            disconnectPi(piId);
        }
    }
}, PI_MONITOR_INTERVAL_MS);
function normalizePiId(parsed) {
    if (typeof parsed.device_id === "string" && parsed.device_id.trim().length > 0) {
        return parsed.device_id;
    }
    return null;
}
function normalizeClientId(parsed) {
    if (typeof parsed.client_id === "string" && parsed.client_id.trim().length > 0) {
        return parsed.client_id;
    }
    return null;
}
function registerPiById(piId, socket) {
    const existingForSocket = socketToPiId.get(socket);
    if (existingForSocket && existingForSocket !== piId) {
        piSockets.delete(existingForSocket);
    }
    const existing = piSockets.get(piId);
    if (existing) {
        if (existing.socket !== socket) {
            try {
                existing.socket.close(1000, "Pi web socket replaced");
            }
            catch {
                // ignore close failures
            }
        }
        existing.connectedAt = Date.now();
        existing.lastHeartbeat = Date.now();
        existing.socket = socket;
        socketToPiId.set(socket, piId);
        piSockets.set(piId, existing);
        currentPi = socket;
        return existing;
    }
    const connection = {
        socket,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
    };
    piSockets.set(piId, connection);
    socketToPiId.set(socket, piId);
    currentPi = socket;
    return connection;
}
function registerClientById(clientId, socket) {
    const existingForSocket = socketToClientId.get(socket);
    if (existingForSocket && existingForSocket !== clientId) {
        clientSockets.delete(existingForSocket);
    }
    const existing = clientSockets.get(clientId);
    if (existing) {
        if (existing.socket !== socket) {
            try {
                existing.socket.close(1000, "Client web socket replaced");
            }
            catch {
                // ignore close failures
            }
        }
        existing.connectedAt = Date.now();
        existing.lastHeartbeat = Date.now();
        existing.socket = socket;
        socketToClientId.set(socket, clientId);
        clientSockets.set(clientId, existing);
        return existing;
    }
    const connection = {
        socket,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
    };
    clientSockets.set(clientId, connection);
    socketToClientId.set(socket, clientId);
    return connection;
}
function disconnectPi(piId) {
    const connection = piSockets.get(piId);
    if (!connection) {
        return;
    }
    if (currentPi === connection.socket) {
        currentPi = null;
    }
    if (socketToPiId.get(connection.socket) === piId) {
        socketToPiId.delete(connection.socket);
    }
    piSockets.delete(piId);
}
function disconnectClient(id) {
    const connection = clientSockets.get(id);
    if (!connection) {
        return;
    }
    if (socketToClientId.get(connection.socket) === id) {
        socketToClientId.delete(connection.socket);
    }
    clientSockets.delete(id);
}
function handlePiMessage(socket, data, registeredPiId) {
    const message = data.toString();
    let activePiId = registeredPiId;
    // Heartbeat path carries pi identity and should be used for registration
    try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === "object") {
            const obj = parsed;
            if (obj.type === "heartbeat") {
                const nextPiId = normalizePiId(obj);
                if (nextPiId) {
                    const connection = piSockets.get(nextPiId);
                    if (!connection || connection.socket !== socket) {
                        registerPiById(nextPiId, socket);
                    }
                    else {
                        connection.lastHeartbeat = Date.now();
                    }
                    activePiId = nextPiId;
                }
                else if (registeredPiId) {
                    const connection = piSockets.get(registeredPiId);
                    if (connection && connection.socket === socket) {
                        connection.lastHeartbeat = Date.now();
                    }
                }
            }
            else if (obj.type === "telemetry") {
                if (!activePiId) {
                    activePiId = normalizePiId(obj) || activePiId;
                }
                if (activePiId) {
                    const connection = piSockets.get(activePiId);
                    if (connection && connection.socket === socket) {
                        const telemetryPayload = JSON.stringify({
                            type: "Telemetry",
                            device_id: activePiId,
                            payload: obj.payload ?? obj,
                        });
                        for (const clientConnection of clientSockets.values()) {
                            if (clientConnection.socket.readyState === ws_1.WebSocket.OPEN) {
                                clientConnection.socket.send(telemetryPayload);
                            }
                        }
                    }
                }
                return activePiId;
            }
        }
    }
    catch {
        // ignore malformed non-JSON packets
    }
    return activePiId;
}
function handleClientMessage(socket, data, registeredClientId) {
    const message = data.toString();
    let activeClientId = registeredClientId;
    try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === "object") {
            const obj = parsed;
            const nextClientId = normalizeClientId(obj);
            if (nextClientId) {
                const connection = clientSockets.get(nextClientId);
                if (!connection || connection.socket !== socket) {
                    registerClientById(nextClientId, socket);
                }
                else {
                    connection.lastHeartbeat = Date.now();
                }
                activeClientId = nextClientId;
            }
            else if (registeredClientId) {
                const connection = clientSockets.get(registeredClientId);
                if (connection && connection.socket === socket) {
                    connection.lastHeartbeat = Date.now();
                }
            }
        }
    }
    catch {
        // ignore malformed non-JSON packets
    }
    if (activeClientId && currentPi && currentPi.readyState == ws_1.WebSocket.OPEN) {
        currentPi.send(JSON.stringify({ type: "config:update", payload: "New update incoming: " + message }));
    }
    return activeClientId;
}
//# sourceMappingURL=realtime.service.js.map