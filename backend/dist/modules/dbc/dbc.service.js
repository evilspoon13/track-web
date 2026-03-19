"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDbc = readDbc;
exports.writeDbc = writeDbc;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const candied_1 = require("candied");
const dbcFile = (0, node_path_1.resolve)(__dirname, "../../../../database/display.dbc");
function getDbcVersion(dbc) {
    return dbc.data.version ?? "1.0";
}
function bumpVersion(version) {
    if (!version) {
        return "1.0.1";
    }
    const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) {
        return `${version}.1`;
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3] ?? 0);
    return `${major}.${minor}.${patch + 1}`;
}
async function readDbc() {
    // Read current DBC
    const dbc = new candied_1.Dbc();
    const fileContent = (0, node_fs_1.readFileSync)(dbcFile, { encoding: "ascii" });
    dbc.load(fileContent);
    const json = JSON.parse(dbc.toJson());
    return { msg: "Read DBC", data: json };
}
async function writeDbc(_newDbc) {
    // Write new dbc to shared memory
    const dbc = new candied_1.Dbc();
    const existingContent = (0, node_fs_1.readFileSync)(dbcFile, { encoding: "ascii" });
    dbc.load(existingContent);
    const frames = Object.values(_newDbc.frames);
    if (!frames.length) {
        return { msg: "Write DBC failed: no frame definitions provided" };
    }
    for (const frame of frames) {
        const messageName = frame.can_id_label;
        const messageId = frame.can_id;
        const messageLength = frame.length;
        let existingMessageName;
        try {
            existingMessageName = dbc.messageIdToName(messageId);
        }
        catch {
            existingMessageName = undefined;
        }
        if (existingMessageName) {
            dbc.removeMessage(existingMessageName);
        }
        const message = dbc.createMessage(messageName, messageId, messageLength);
        message.add().updateDescription(messageName).updateNode("Vector__XXX");
        for (const signal of frame.signals) {
            const signalType = signal.type.toLowerCase();
            message.addSignal(signal.name, signal.start_byte, signal.length, {
                signed: signalType.startsWith("int"),
                isFloat: signalType === "float" || signalType === "double",
                factor: signal.scale,
                offset: signal.offset,
            });
        }
    }
    const nextVersion = bumpVersion(getDbcVersion(dbc));
    dbc.version = nextVersion;
    dbc.description = "DBC file";
    const generatedDbc = dbc.write();
    (0, node_fs_1.writeFileSync)(dbcFile, generatedDbc, { encoding: "ascii" });
    // Signal can-reader to reload
    // sendReloadSignal("fsae-can-reader.service");
    return { msg: "Wrote DBC" };
}
//# sourceMappingURL=dbc.service.js.map