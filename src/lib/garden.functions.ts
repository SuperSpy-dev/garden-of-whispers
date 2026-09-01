import { createServerFn } from "@tanstack/react-start";

export type PromiseRow = { id: string; locator_key: string; created_at: string };
export type CardRow = {
  id: string;
  heading: string | null;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  image_alt: string | null;
  position: number;
  created_at?: string;
};
export const CARD_FIELDS =
  "id, heading, body, link_url, link_label, image_url, image_alt, position, created_at";
export type SiteContent = {
  main_heading: string;
  footer_tagline: string;
  footer_paragraph: string;
};

export const checkPromise = createServerFn({ method: "POST" })
  .inputValidator((data: { locator: string }) => data)
  .handler(async ({ data }) => {
    const { admin, clean } = await import("./garden.server");
    const locator = clean(data.locator, 64);
    if (!locator) return { promised: false };
    const db = await admin();
    const { data: row } = await db
      .from("promises")
      .select("id")
      .eq("locator_key", locator)
      .maybeSingle();
    return { promised: Boolean(row) };
  });

export const makePromise = createServerFn({ method: "POST" })
  .inputValidator((data: { locator: string }) => data)
  .handler(async ({ data }) => {
    const { admin, clean } = await import("./garden.server");
    const locator = clean(data.locator, 64);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(locator)) throw new Error("Invalid locator");
    const db = await admin();
    await db.from("promises").upsert({ locator_key: locator }, { onConflict: "locator_key" });
    await db.from("activity_logs").insert({ locator_key: locator, event: "promise_created" });
    return { promised: true };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { getSession, passcodeMatches } = await import("./garden.server");
    const expected = process.env["ADMIN_PASSCODE"];
    if (!expected) throw new Error("Admin passcode not configured");
    if (typeof data.passcode !== "string" || !passcodeMatches(data.passcode, expected)) {
      await new Promise((r) => setTimeout(r, 400));
      return { ok: false as const };
    }
    const session = await getSession();
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./garden.server");
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});

export const adminStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { isAdmin } = await import("./garden.server");
  return { admin: await isAdmin() };
});

export const listPromises = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, admin } = await import("./garden.server");
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("promises")
    .select("id, locator_key, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { promises: (data ?? []) as PromiseRow[] };
});

export const deletePromise = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, admin } = await import("./garden.server");
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("promises").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveContent = createServerFn({ method: "POST" })
  .inputValidator((data: SiteContent) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, admin, clean } = await import("./garden.server");
    await requireAdmin();
    const db = await admin();
    const payload = {
      id: 1,
      main_heading: clean(data.main_heading, 200) || "Garden Of Secrets",
      footer_tagline: clean(data.footer_tagline, 200),
      footer_paragraph: clean(data.footer_paragraph, 800),
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("site_content").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveCards = createServerFn({ method: "POST" })
  .inputValidator((data: { cards: Array<Omit<CardRow, "id"> & { id?: string }> }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, admin, clean, CARD_KINDS, isSafeUrl } = await import("./garden.server");
    await requireAdmin();
    const incoming = Array.isArray(data.cards) ? data.cards : [];
    if (incoming.length < 1 || incoming.length > 20) {
      throw new Error("Cards must be between 1 and 20");
    }
    const rows = incoming.map((card, index) => {
      if (!CARD_KINDS.includes(card.kind)) throw new Error("Invalid card type");
      const value = clean(card.value, card.kind === "paragraph" ? 4000 : 1000);
      if (!value) throw new Error("Every card needs content");
      if ((card.kind === "image" || card.kind === "link") && !isSafeUrl(value)) {
        throw new Error("Image and link cards need a valid http(s) URL");
      }
      return {
        kind: card.kind,
        value,
        label: clean(card.label ?? "", 200) || null,
        position: index,
      };
    });
    const db = await admin();
    const { error: delError } = await db.from("cards").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delError) throw new Error(delError.message);
    const { error } = await db.from("cards").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type QuestionRow = { id: string; locator_key: string; body: string; created_at: string };
export type ActivityLogRow = {
  id: string;
  locator_key: string | null;
  event: string;
  detail: string | null;
  created_at: string;
};

export const logActivity = createServerFn({ method: "POST" })
  .inputValidator((data: { locator: string; event: string; detail?: string }) => data)
  .handler(async ({ data }) => {
    const { admin, clean } = await import("./garden.server");
    const event = clean(data.event, 40);
    const allowed = ["page_open", "promise_created", "question_asked"];
    if (!allowed.includes(event)) return { ok: false as const };
    const locator = clean(data.locator, 64) || null;
    const db = await admin();
    await db.from("activity_logs").insert({
      locator_key: locator,
      event,
      detail: clean(data.detail ?? "", 300) || null,
    });
    return { ok: true as const };
  });

export const askQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: { locator: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { admin, clean } = await import("./garden.server");
    const locator = clean(data.locator, 64);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(locator)) throw new Error("Invalid locator");
    const body = clean(data.body, 2000);
    if (body.length < 2) throw new Error("Please write your question");
    const db = await admin();
    const { error } = await db.from("questions").insert({ locator_key: locator, body });
    if (error) throw new Error(error.message);
    await db.from("activity_logs").insert({
      locator_key: locator,
      event: "question_asked",
      detail: body.slice(0, 140),
    });
    return { ok: true as const };
  });

export const listQuestions = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, admin } = await import("./garden.server");
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("questions")
    .select("id, locator_key, body, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { questions: (data ?? []) as QuestionRow[] };
});

export const deleteQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, admin } = await import("./garden.server");
    await requireAdmin();
    const ids = (data.ids ?? []).filter((id) => typeof id === "string").slice(0, 500);
    if (ids.length === 0) return { ok: true as const };
    const db = await admin();
    const { error } = await db.from("questions").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listActivity = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, admin } = await import("./garden.server");
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("activity_logs")
    .select("id, locator_key, event, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return { logs: (data ?? []) as ActivityLogRow[] };
});

export const deleteActivity = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, admin } = await import("./garden.server");
    await requireAdmin();
    const ids = (data.ids ?? []).filter((id) => typeof id === "string").slice(0, 1000);
    if (ids.length === 0) return { ok: true as const };
    const db = await admin();
    const { error } = await db.from("activity_logs").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
