import express from "express";
import cors from "cors";
import { router } from "./routes.js";
import "dotenv/config";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", router);

const port = process.env.PORT || 5010;
console.log(process.env.MONGO_URI)
app.listen(port, () => console.log(`API listening on :${port}`));
