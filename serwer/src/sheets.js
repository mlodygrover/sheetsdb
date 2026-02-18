import { google } from "googleapis";

const REQUIRED_HEADERS = ["NAME", "LAW FIRM", "E-MAIL", "PHONE", "COUNTRY", "GROUP"];

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) return "";
  return groups.join(", ");
}

function toRowValues(u) {
  return [
    u.name ?? "",
    u.lawFirm ?? "",
    (u.email ?? "").toLowerCase(),
    u.phone ?? "",
    u.country ?? "",
    normalizeGroups(u.groups),
  ];
}

export async function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");

  const credentials = JSON.parse(raw);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function ensureSheetHeader(sheets, sheetId, tabName) {
  const range = `${tabName}!A1:F1`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  const current = res.data.values?.[0] || [];
  const ok = REQUIRED_HEADERS.every((h, i) => (current[i] || "").trim().toUpperCase() === h);

  if (!ok) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [REQUIRED_HEADERS] },
    });
  }
}

export async function buildEmailRowIndex(sheets, sheetId, tabName) {
  // Kolumna C: E-MAIL (od C2 w dół)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!C2:C`,
  });

  const values = res.data.values || [];
  const map = new Map();
  values.forEach((row, i) => {
    const email = (row?.[0] || "").trim().toLowerCase();
    if (email) map.set(email, i + 2); // start od wiersza 2
  });
  return map;
}

export async function upsertUserToSheet(user) {
  const sheetId = process.env.SHEET_ID;
  const tabName = process.env.SHEET_TAB || "Arkusz1";
  if (!sheetId) throw new Error("SHEET_ID is missing");

  const sheets = await getSheetsClient();
  await ensureSheetHeader(sheets, sheetId, tabName);

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) throw new Error("User email missing (cannot sync to sheet)");

  const index = await buildEmailRowIndex(sheets, sheetId, tabName);
  const rowIndex = index.get(email);

  const values = toRowValues(user);

  if (rowIndex) {
    // update A:F w konkretnym wierszu
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A${rowIndex}:F${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  } else {
    // append nowy wiersz
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  }
}
