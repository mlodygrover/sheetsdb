import crypto from "crypto";

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function makeModifyKey(email) {
  const secret = process.env.MOD_LINK_SECRET;
  if (!secret) throw new Error("MOD_LINK_SECRET is missing");

  const normalized = String(email || "").trim().toLowerCase();
  const h = crypto.createHmac("sha256", secret).update(normalized).digest();
  // krótszy klucz (czytelny w URL); możesz zwiększyć długość jeśli chcesz
  return base64url(h).slice(0, 12);
}
