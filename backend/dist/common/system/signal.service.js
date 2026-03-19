"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReloadSignal = sendReloadSignal;
const node_child_process_1 = require("node:child_process");
function sendReloadSignal(process) {
    (0, node_child_process_1.execFile)("systemctl", ["kill", "-s", "HUP", process], (err) => {
        if (err) {
            console.error("Failed to send SIGHUP:", err);
            return;
        }
        console.log("Reload signal sent");
    });
}
//# sourceMappingURL=signal.service.js.map