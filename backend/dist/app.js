"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./middleware/auth");
const graphics_routes_1 = __importDefault(require("./modules/graphics/graphics.routes"));
const frame_parser_routes_1 = __importDefault(require("./modules/frame-parser/frame-parser.routes"));
const dbc_routes_1 = __importDefault(require("./modules/dbc/dbc.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.send("FSAE Driver Display - Web Server");
});
app.use("/api", auth_1.requireAuth);
app.use("/api/graphics", graphics_routes_1.default);
app.use("/api/frame-parser", frame_parser_routes_1.default);
app.use("/api/dbc", dbc_routes_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map