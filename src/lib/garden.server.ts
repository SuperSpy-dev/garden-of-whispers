import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

const sessionConfig = {
  password: process.env["SESSION_SECRET"] ?? "",
  name: "gos-admin",
  maxAge: 60 * 60 * 8,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

type AdminSession = { admin?: boolean };

export async function getSession() {
  return useSession<AdminSession>({ ...sessionConfig, password: process.env["SESSION_SECRET"]! });
}

export function passcodeMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function isAdmin() {
  const session = await getSession();
  return session.data.admin === true;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const CARD_KINDS = ["image", "link", "heading", "paragraph"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export function clean(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
