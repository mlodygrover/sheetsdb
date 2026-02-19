import { google } from "googleapis";

// Zakładam układ: A: NAME, B: LAW FIRM, C: E-MAIL, D: PHONE, E: COUNTRY, F: GROUP
// GROUP przechowujesz jako string "A, B, C" (comma-separated)
const REQUIRED_HEADERS = ["NAME", "LAW FIRM", "E-MAIL", "PHONE", "COUNTRY", "GROUP"];

/* ----------------------------- helpers ----------------------------- */

function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
}

function splitGroups(cell) {
    const s = String(cell || "").trim();
    if (!s) return [];
    // obsłuży: "A, B" lub "A; B" lub mieszane
    return s
        .split(/[,;]+/g)
        .map((x) => x.trim())
        .filter(Boolean);
}

function normalizeGroups(groups) {
    if (!Array.isArray(groups)) return "";
    return groups
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(", ");
}

function toRowValues(u) {
    return [
        String(u?.name || "").trim(),
        String(u?.lawFirm || "").trim(),
        normalizeEmail(u?.email),
        String(u?.phone || "").trim(),
        String(u?.country || "").trim(),
        normalizeGroups(u?.groups),
    ];
}

function fromRowValues(row) {
    // row to tablica [A..F]
    return {
        name: String(row?.[0] || "").trim(),
        lawFirm: String(row?.[1] || "").trim(),
        email: normalizeEmail(row?.[2]),
        phone: String(row?.[3] || "").trim(),
        country: String(row?.[4] || "").trim(),
        groups: splitGroups(row?.[5]),
    };
}

/* ----------------------------- auth ----------------------------- */

export async function getSheetsClient() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");

    let credentials;
    try {
        credentials = JSON.parse(raw);
    } catch {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
}

/* ----------------------------- header ----------------------------- */

export async function ensureSheetHeader(sheets, sheetId, tabName) {
    const range = `${tabName}!A1:F1`;
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });

    const current = res.data.values?.[0] || [];
    const ok = REQUIRED_HEADERS.every(
        (h, i) => String(current[i] || "").trim().toUpperCase() === h
    );

    if (!ok) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range,
            valueInputOption: "RAW",
            requestBody: { values: [REQUIRED_HEADERS] },
        });
    }
}

/* ----------------------------- core reads ----------------------------- */

/**
 * Pobiera całą tabelę A2:F (bez nagłówka) i mapuje na obiekty userów.
 * Zwraca też rowIndex (numer wiersza w Google Sheets), żeby ewentualnie aktualizować konkretne wiersze.
 */
export async function getAllUsersFromSheet() {
    const sheetId = process.env.SHEET_ID;
    const tabName = process.env.SHEET_TAB || "Arkusz1";
    if (!sheetId) throw new Error("SHEET_ID is missing");

    const sheets = await getSheetsClient();
    await ensureSheetHeader(sheets, sheetId, tabName);

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tabName}!A2:F`,
    });

    const values = res.data.values || [];
    const users = values.map((row, i) => {
        const u = fromRowValues(row);
        return { ...u, _sheetRow: i + 2 }; // bo zaczynamy od A2
    });

    return users;
}

/**
 * Zwraca unikalne grupy na podstawie wartości w kolumnie GROUP we wszystkich rekordach.
 * (Prosta metoda – nie czyta reguł walidacji dropdowna, tylko dane.)
 */
export async function getAllowedGroupsFromSheet() {
    const users = await getAllUsersFromSheet();
    const set = new Set();
    for (const u of users) {
        for (const g of u.groups || []) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Znajduje usera po key: porównuje makeModifyKey(email) z przekazanym key.
 * makeModifyKey przekazujesz z zewnątrz, żeby ten plik nie importował cryptoKey.js (czystsze).
 */
export async function findUserByKeyFromSheet(key, makeModifyKey) {
    const k = String(key || "").trim();
    if (!k) return null;

    const users = await getAllUsersFromSheet();
    const found = users.find((u) => u.email && makeModifyKey(u.email) === k);
    if (!found) return null;

    // usuń _sheetRow jeśli nie chcesz go ujawniać
    const { _sheetRow, ...clean } = found;
    return clean;
}

/* ----------------------------- upsert ----------------------------- */

export async function buildEmailRowIndex(sheets, sheetId, tabName) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tabName}!C2:C`,
    });

    const values = res.data.values || [];
    const map = new Map();

    values.forEach((row, i) => {
        const email = normalizeEmail(row?.[0]);
        if (!email) return;

        const rowIndex = i + 2; // bo start od 2
        // NIE nadpisuj jeśli już istnieje → zachowaj pierwszy znaleziony
        if (!map.has(email)) map.set(email, rowIndex);
    });

    return map;
}


/**
 * UPSERT po emailu: jak istnieje -> update A:F w tym wierszu, jak nie -> append.
 * Zwraca { mode: "updated" | "inserted" }.
 */
export async function upsertUserToSheet(user) {
    const sheetId = process.env.SHEET_ID;
    const tabName = process.env.SHEET_TAB || "Arkusz1";
    if (!sheetId) throw new Error("SHEET_ID is missing");

    const sheets = await getSheetsClient();
    await ensureSheetHeader(sheets, sheetId, tabName);

    const email = normalizeEmail(user?.email);
    if (!email) throw new Error("User email missing (cannot sync to sheet)");

    const index = await buildEmailRowIndex(sheets, sheetId, tabName);
    const rowIndex = index.get(email);

    const values = toRowValues({ ...user, email });

    if (rowIndex) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${tabName}!A${rowIndex}:F${rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [values] },
        });
        return { mode: "updated" };
    }

    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${tabName}!A:F`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [values] },
    });

    return { mode: "inserted" };
}
