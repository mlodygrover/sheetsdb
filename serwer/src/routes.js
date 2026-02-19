import express from "express";
import { getDb } from "./db.js";
import { makeModifyKey } from "./cryptoKey.js";
import { createUserSchema, modifyUserSchema } from "./validators.js";
import { upsertUserToSheet } from "./sheets.js";
import { ObjectId } from "mongodb";

export const router = express.Router();

/**
 * 1) getModLink
 * body: { email }
 * returns: { link, key }
 */
router.post("/getModLink", async (req, res) => {
    const rawEmail = req.body?.email;
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email is required" });

    // Tymczasowo: log pełnego payloadu z WP
    // (w produkcji usuń lub ogranicz logowanie, bo mogą tam być dane wrażliwe)
    console.log("GET /getModLink payload:", {
        email,
        source: req.body?.source,
        wpUser: req.body?.wpUser,
    });

    const key = makeModifyKey(email);

    const base = process.env.PUBLIC_BASE_URL || "";
    const path = process.env.CLIENT_MODIFY_PATH || "/modifyRecord";
    const link = `${base}${path}?key=${encodeURIComponent(key)}`;

    console.log("Generated:", { email, key, link });

    return res.json({ key, link });
});

/**
 * 2) getGroups
 * returns: { groups: string[] }
 */
router.get("/getGroups", async (_req, res) => {
    const db = await getDb();
    const groups = await db.collection("groups").find({}, { projection: { name: 1 } }).toArray();
    const names = groups.map(g => String(g.name || "").trim()).filter(Boolean).sort();
    return res.json({ groups: names });
});

/**
 * (DODATKOWE - potrzebne do admin/test)
 * GET /users -> lista users
 */
router.get("/users", async (_req, res) => {
    const db = await getDb();
    const users = await db.collection("users")
        .find({}, { projection: { name: 1, lawFirm: 1, email: 1, country: 1, groups: 1, phone: 1 } })
        .sort({ name: 1 })
        .toArray();

    return res.json({ users });
});

/**
 * (DODATKOWE - do wypełnienia formularza po key)
 *  GET /getUserByKey?key=...
 *  returns: { user } lub 404
 */
router.get("/getUserByKey", async (req, res) => {
    const key = String(req.query?.key || "").trim();
    if (!key) return res.status(400).json({ error: "key is required" });

    const db = await getDb();
    const cursor = db.collection("users").find({}, { projection: { name: 1, lawFirm: 1, email: 1, phone: 1, country: 1, groups: 1 } });

    for await (const u of cursor) {
        const email = String(u.email || "").trim().toLowerCase();
        if (!email) continue;
        if (makeModifyKey(email) === key) {
            return res.json({ user: { ...u, email } });
        }
    }

    return res.status(404).json({ error: "User not found for this key" });
});

/**
 * 3) createUser
 * body: { name, lawFirm, email, phone?, country, groups[] }
 * - brak ograniczeń dostępu (testowo)
 * - walidacja: phone opcjonalny, groups min 1
 * - groups muszą istnieć w kolekcji groups
 * - po zapisie sync do Google Sheets
 */
router.post("/createUser", async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const payload = parsed.data;
    payload.email = payload.email.trim().toLowerCase();

    const db = await getDb();

    // weryfikacja grup
    const existing = await db.collection("groups")
        .find({ name: { $in: payload.groups } }, { projection: { name: 1 } })
        .toArray();
    const existingNames = new Set(existing.map(g => g.name));
    const missing = payload.groups.filter(x => !existingNames.has(x));
    if (missing.length) return res.status(400).json({ error: `Unknown groups: ${missing.join(", ")}` });

    // upsert po emailu (unikalność loginu)
    const now = new Date();
    const doc = { ...payload, phone: payload.phone || "", updatedAt: now };
    const exists = await db.collection("users").findOne(
        { email: payload.email },
        { projection: { _id: 1 } }
    );

    if (exists) {
        return res.status(409).json({ error: "Email already exists" });
    }
    await db.collection("users").updateOne(
        { email: doc.email },
        { $set: doc, $setOnInsert: { createdAt: now } },
        { upsert: true }
    );

    // sync do Sheets
    await upsertUserToSheet(doc);

    return res.json({ ok: true });
});

/**
 * 4) modifyUser
 * body: { key, name, lawFirm, email, phone?, country, groups[] }
 * - email w payload jest nadal wymagany (jak przy create),
 *   ale klucz determinuje, który rekord wolno zmodyfikować.
 * - nie trzymamy hashów w DB -> skan emaili i porównanie hashy
 */
router.post("/modifyUser", async (req, res) => {
    const parsed = modifyUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { key, ...payload } = parsed.data;
    payload.email = payload.email.trim().toLowerCase();

    const db = await getDb();

    // znajdź użytkownika po key (skan)
    let matchedEmail = null;

    const cursor = db.collection("users").find({}, { projection: { email: 1 } });

    for await (const u of cursor) {
        const email = String(u.email || "").trim().toLowerCase();
        if (!email) continue;
        if (makeModifyKey(email) === key) {
            matchedEmail = email;
            break;
        }
    }

    if (!matchedEmail) return res.status(403).json({ error: "Invalid key" });

    // ważne: klucz wskazuje rekord; payload.email nie może zmienić tożsamości
    if (payload.email !== matchedEmail) {
        return res.status(400).json({ error: "Email cannot be changed via modify link" });
    }

    // weryfikacja grup
    const existing = await db.collection("groups")
        .find({ name: { $in: payload.groups } }, { projection: { name: 1 } })
        .toArray();
    const existingNames = new Set(existing.map(g => g.name));
    const missing = payload.groups.filter(x => !existingNames.has(x));
    if (missing.length) return res.status(400).json({ error: `Unknown groups: ${missing.join(", ")}` });

    const now = new Date();
    const doc = { ...payload, phone: payload.phone || "", updatedAt: now };

    await db.collection("users").updateOne(
        { email: matchedEmail },
        { $set: doc }
    );

    // sync do Sheets
    await upsertUserToSheet(doc);

    return res.json({ ok: true });
});


/**
 * GET /api/groups
 * Zwraca listę grup (to samo co getGroups, tylko czytelniejsza nazwa dla panelu admina).
 */
router.get("/groups", async (_req, res) => {
    const db = await getDb();
    const groups = await db.collection("groups")
        .find({}, { projection: { name: 1 } })
        .sort({ name: 1 })
        .toArray();

    return res.json({ groups });
});

/**
 * POST /api/groups
 * body: { name }
 */
router.post("/groups", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const db = await getDb();

    try {
        const r = await db.collection("groups").insertOne({ name });
        return res.json({ ok: true, group: { _id: r.insertedId, name } });
    } catch (e) {
        // duplikat przy unikalnym indeksie
        if (e?.code === 11000) return res.status(409).json({ error: "Group already exists" });
        return res.status(500).json({ error: "Unable to create group" });
    }
});

/**
 * PUT /api/groups/:id
 * body: { name }
 */
router.put("/groups/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "invalid id" });
    if (!name) return res.status(400).json({ error: "name is required" });

    const db = await getDb();

    try {
        await db.collection("groups").updateOne(
            { _id: new ObjectId(id) },
            { $set: { name } }
        );

        // UWAGA: jeżeli użytkownicy przechowują grupy jako stringi,
        // trzeba też zaktualizować ich tablice groups (rename group).
        // Najbezpieczniej robić rename przez "oldName" -> "newName".
        // Dlatego lepszy wariant jest poniżej jako osobny endpoint:
        return res.json({ ok: true });
    } catch (e) {
        if (e?.code === 11000) return res.status(409).json({ error: "Group already exists" });
        return res.status(500).json({ error: "Unable to update group" });
    }
});

/**
 * POST /api/groups/rename
 * body: { oldName, newName }
 * To jest właściwa edycja w Twoim modelu (bo users trzymają nazwy grup jako string).
 */
router.post("/groups/rename", async (req, res) => {
    const oldName = String(req.body?.oldName || "").trim();
    const newName = String(req.body?.newName || "").trim();
    if (!oldName || !newName) return res.status(400).json({ error: "oldName and newName are required" });

    const db = await getDb();

    // sprawdź duplikat
    const exists = await db.collection("groups").findOne({ name: newName });
    if (exists) return res.status(409).json({ error: "Group already exists" });

    // zaktualizuj group w kolekcji groups
    await db.collection("groups").updateOne({ name: oldName }, { $set: { name: newName } });

    // oraz podmień w users.groups
    await db.collection("users").updateMany(
        { groups: oldName },
        { $set: { "groups.$[g]": newName } },
        { arrayFilters: [{ g: oldName }] }
    );

    return res.json({ ok: true });
});

/**
 * DELETE /api/groups/:id
 * Ochrona: nie usuwamy grupy, jeśli jest używana przez userów (zwracamy 409).
 */
router.delete("/groups/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "invalid id" });

    const db = await getDb();
    const group = await db.collection("groups").findOne({ _id: new ObjectId(id) });
    if (!group) return res.status(404).json({ error: "group not found" });

    const inUse = await db.collection("users").countDocuments({ groups: group.name });
    if (inUse > 0) {
        return res.status(409).json({ error: `Group is in use by ${inUse} user(s)` });
    }

    await db.collection("groups").deleteOne({ _id: new ObjectId(id) });
    return res.json({ ok: true });
});
