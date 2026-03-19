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
exports.getScreenNames = getScreenNames;
exports.getScreenById = getScreenById;
exports.deleteScreenById = deleteScreenById;
exports.updateScreen = updateScreen;
const graphicsService = __importStar(require("./graphics.service"));
async function getScreenNames(req, res) {
    try {
        const screens = await graphicsService.getScreenNames(req.uid);
        if (screens === null) {
            res.status(404).json({ msg: "No screens found" });
            return;
        }
        res.status(200).json({ screens });
    }
    catch (error) {
        res.status(500).json({ msg: error });
    }
}
async function getScreenById(req, res) {
    try {
        const screenName = req.params.screenId;
        if (!screenName) {
            res.status(400).json({ msg: "Invalid request" });
            return;
        }
        const screen = await graphicsService.getScreenById(req.uid, screenName);
        if (screen === null) {
            res.status(404).json({ msg: "Screen not found" });
            return;
        }
        res.status(200).json(screen);
    }
    catch (error) {
        res.status(500).json({ msg: error });
    }
}
async function deleteScreenById(req, res) {
    try {
        const screenName = req.params.screenId;
        if (!screenName) {
            res.status(400).json({ msg: "Invalid request" });
            return;
        }
        const response = await graphicsService.deleteScreenById(req.uid, screenName);
        if (response.msg === "fail") {
            res.status(404).json({ success: false });
            return;
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(500).json({ msg: error });
    }
}
async function updateScreen(req, res) {
    try {
        const screenId = req.params.screenId;
        const screen = req.body;
        await graphicsService.saveScreen(req.uid, screenId, screen);
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(500).json({ msg: error });
    }
}
//# sourceMappingURL=graphics.controller.js.map