import express from "express";
import { makeModifyKey } from "./cryptoKey.js";
import { createUserSchema, modifyUserSchema } from "./validators.js";
import {
  getAllUsersFromSheet,
  getAllowedGroupsFromSheet,
  findUserByKeyFromSheet,
  upsertUserToSheet,
} from "./sheets.js";

export const router = express.Router();

/**
 * 1) getModLink
 * body: { email }
 * returns: { link, key }
 */
router.post("/getModLink", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email is required" });

  const key = makeModifyKey(email);

  const base = process.env.PUBLIC_BASE_URL || "";
  const path = process.env.CLIENT_MODIFY_PATH || "/modifyRecord";
  const link = `${base}${path}?key=${encodeURIComponent(key)}`;

  console.log(key, link);
  return res.json({ key, link });
});

/**
 * 2) getGroups
 * returns: { groups: string[] }
 */
router.get("/getGroups", async (_req, res) => {
  try {
    const groups = await getAllowedGroupsFromSheet();
    return res.json({ groups });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * (DODATKOWE - potrzebne do admin/test)
 * GET /users -> lista users
 */
router.get("/users", async (_req, res) => {
  try {
    const usersRaw = await getAllUsersFromSheet();
    const users = usersRaw
      .map(({ _sheetRow, ...u }) => u)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * (DODATKOWE - do wypełnienia formularza po key)
 *  GET /getUserByKey?key=...
 *  returns: { user } lub 404
 */
router.get("/getUserByKey", async (req, res) => {
  const key = String(req.query?.key || "").trim();
  if (!key) return res.status(400).json({ error: "key is required" });

  try {
    const user = await findUserByKeyFromSheet(key, makeModifyKey);
    if (!user) return res.status(404).json({ error: "User not found for this key" });
    return res.json({ user });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * 3) createUser
 * body: { name, lawFirm, email, phone?, country, groups[] }
 * - walidacja: phone opcjonalny, groups min 1
 * - duplikat email -> 409
 * - zapis do Google Sheets
 */
router.post("/createUser", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payload = parsed.data;
  payload.email = String(payload.email || "").trim().toLowerCase();

  try {
    const users = await getAllUsersFromSheet();
    const exists = users.some((u) => (u.email || "") === payload.email);
    if (exists) return res.status(409).json({ error: "Email already exists" });

    await upsertUserToSheet(payload); // dopisze nowy wiersz (insert)
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * 4) modifyUser
 * body: { key, name, lawFirm, email, phone?, country, groups[] }
 * - key determinuje rekord (email nie może się zmienić)
 * - zapis do Google Sheets (update po emailu)
 */
router.post("/modifyUser", async (req, res) => {
  const parsed = modifyUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { key, ...payload } = parsed.data;
  payload.email = String(payload.email || "").trim().toLowerCase();

  try {
    const users = await getAllUsersFromSheet();

    const matched = users.find((u) => u.email && makeModifyKey(u.email) === key);
    if (!matched) return res.status(403).json({ error: "Invalid key" });

    if (payload.email !== matched.email) {
      return res.status(400).json({ error: "Email cannot be changed via modify link" });
    }

    await upsertUserToSheet(payload); // update istniejącego wiersza po emailu
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});
