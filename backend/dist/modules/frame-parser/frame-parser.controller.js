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
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
const frameParserService = __importStar(require("./frame-parser.service"));
async function getConfig(req, res) {
    try {
        const config = await frameParserService.readConfig(req.uid);
        if (config === null) {
            res.status(404).json({ msg: "Not Found" });
            return;
        }
        res.status(200).json(config);
    }
    catch (error) {
        res.status(500).json({ msg: error });
    }
}
async function updateConfig(req, res) {
    try {
        const { can_id, frameDefinition } = req.body;
        await frameParserService.updateConfig(req.uid, can_id, frameDefinition);
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, msg: error });
    }
}
//# sourceMappingURL=frame-parser.controller.js.map