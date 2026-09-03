import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  answerQuestion,
  deleteActivity,
  deletePromise,
  deleteQuestions,
  listActivity,
  listPromises,
  listQuestions,
  saveCards,
  saveContent,
  CARD_FIELDS,
  type CardRow,
  type QuestionRow,
  type SiteContent,
} from "@/lib/garden.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Garden Of Secrets" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private area." },
      { property: "og:title", content: "Garden Of Secrets" },
      { property: "og:description", content: "Private area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type DraftCard = Omit<CardRow, "id" | "created_at"> & { id?: string; key: string };


function Admin() {
  const status = useServerFn(adminStatus);
  const session = useQuery({ queryKey: ["admin-status"], queryFn: () => status() });

  if (session.isLoading) return <Shell />;
  if (!session.data?.admin) return <Login onDone={() => session.refetch()} />;
  return <Dashboard onSignOut={() => session.refetch()} />;
}

function Shell({ children }: { children?: React.ReactNode }) {
  return <div className="min-h-screen px-5 py-14">{children}</div>;
}

function Login({ onDone }: { onDone: () => void }) {
  const login = useServerFn(adminLogin);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Shell>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(false);
          try {
            const result = await login({ data: { passcode } });
            if (result.ok) onDone();
            else setError(true);
          } finally {
            setPending(false);
          }
        }}
        className="glass-panel veil-in mx-auto mt-16 w-full max-w-sm rounded-2xl p-8"
      >
        <h1 className="text-xl font-semibold">Enter passcode</h1>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          className="mt-6 w-full rounded-lg border border-border bg-input/40 px-4 py-2.5 text-sm outline-none focus:border-ring"
        />
        {error ? <p className="mt-3 text-xs text-destructive">Incorrect passcode.</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          Continue
        </button>
      </form>
    </Shell>
  );
}

const TABS = ["promises", "questions", "activity", "information"] as const;
type Tab = (typeof TABS)[number];

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("promises");
  const logout = useServerFn(adminLogout);

  return (
    <Shell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] transition ${
                  tab === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              await logout();
              onSignOut();
            }}
            className="text-xs text-muted-foreground transition hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <div className="mt-8">
          {tab === "promises" ? <PromisesTab /> : null}
          {tab === "questions" ? <QuestionsTab /> : null}
          {tab === "activity" ? <ActivityTab /> : null}
          {tab === "information" ? <InformationTab /> : null}
        </div>
      </div>
    </Shell>
  );
}

function useSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  return { selected, setSelected, toggle };
}

function stamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function BulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  onDelete,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>
        Selected <span className="text-foreground">{count}</span> of {total}
      </span>
      <button onClick={onSelectAll} className="transition hover:text-foreground">
        Select all
      </button>
      <button onClick={onClear} className="transition hover:text-foreground">
        Clear
      </button>
      <button
        onClick={onDelete}
        disabled={count === 0}
        className="text-destructive transition hover:brightness-125 disabled:opacity-40"
      >
        Delete selected
      </button>
    </div>
  );
}

function QuestionsTab() {
  const list = useServerFn(listQuestions);
  const remove = useServerFn(deleteQuestions);
  const queryClient = useQueryClient();
  const questions = useQuery({ queryKey: ["questions"], queryFn: () => list() });
  const rows = questions.data?.questions ?? [];
  const { selected, setSelected, toggle } = useSelection();

  return (
    <div className="glass-panel veil-in space-y-5 rounded-2xl p-6">
      <BulkBar
        count={selected.length}
        total={rows.length}
        onSelectAll={() => setSelected(rows.map((row) => row.id))}
        onClear={() => setSelected([])}
        onDelete={async () => {
          await remove({ data: { ids: selected } });
          setSelected([]);
          await queryClient.invalidateQueries({ queryKey: ["questions"] });
        }}
      />
      <div className="space-y-2">
        {rows.map((row) => (
          <QuestionRowItem
            key={row.id}
            row={row}
            checked={selected.includes(row.id)}
            onToggle={() => toggle(row.id)}
          />
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No questions yet.</p> : null}
      </div>
    </div>
  );
}

function QuestionRowItem({
  row,
  checked,
  onToggle,
}: {
  row: QuestionRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const reply = useServerFn(answerQuestion);
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState(row.answer ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 accent-[var(--primary)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{row.body}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
            {row.locator_key} · {stamp(row.created_at)}
            {row.answered_at ? ` · replied ${stamp(row.answered_at)}` : ""}
          </p>
          <textarea
            rows={3}
            value={answer}
            placeholder="Write a reply…"
            onChange={(event) => {
              setAnswer(event.target.value);
              setSaved(false);
            }}
            className="mt-3 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await reply({ data: { id: row.id, answer } });
                  setSaved(true);
                  await queryClient.invalidateQueries({ queryKey: ["questions"] });
                } finally {
                  setPending(false);
                }
              }}
              className="rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              Save reply
            </button>
            {saved ? <span className="text-[11px] text-muted-foreground">Saved.</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  page_open: "Opened main page",
  promise_created: "Made a promise",
  question_asked: "Asked a question",
};

function ActivityTab() {
  const list = useServerFn(listActivity);
  const remove = useServerFn(deleteActivity);
  const queryClient = useQueryClient();
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => list() });
  const rows = activity.data?.logs ?? [];
  const { selected, setSelected, toggle } = useSelection();

  return (
    <div className="glass-panel veil-in space-y-5 rounded-2xl p-6">
      <BulkBar
        count={selected.length}
        total={rows.length}
        onSelectAll={() => setSelected(rows.map((row) => row.id))}
        onClear={() => setSelected([])}
        onDelete={async () => {
          await remove({ data: { ids: selected } });
          setSelected([]);
          await queryClient.invalidateQueries({ queryKey: ["activity"] });
        }}
      />
      <div className="space-y-2">
        {rows.map((row) => (
          <label
            key={row.id}
            className="flex cursor-pointer gap-3 rounded-lg border border-border/60 px-4 py-3"
          >
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={() => toggle(row.id)}
              className="mt-1 accent-[var(--primary)]"
            />
            <div className="min-w-0">
              <p className="text-sm text-foreground/90">{EVENT_LABEL[row.event] ?? row.event}</p>
              {row.detail ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">{row.detail}</p>
              ) : null}
              <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                {row.locator_key ?? "unknown"} · {stamp(row.created_at)}
              </p>
            </div>
          </label>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
      </div>
    </div>
  );
}


function PromisesTab() {
  const list = useServerFn(listPromises);
  const remove = useServerFn(deletePromise);
  const queryClient = useQueryClient();
  const promises = useQuery({ queryKey: ["promises"], queryFn: () => list() });
  const rows = promises.data?.promises ?? [];

  return (
    <div className="glass-panel veil-in rounded-2xl p-6">
      <p className="text-sm text-muted-foreground">
        Total promises: <span className="text-foreground">{rows.length}</span>
      </p>
      <div className="mt-5 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-foreground/85">{row.locator_key}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={async () => {
                await remove({ data: { id: row.id } });
                await queryClient.invalidateQueries({ queryKey: ["promises"] });
              }}
              className="shrink-0 text-xs text-destructive transition hover:brightness-125"
            >
              Reset
            </button>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No promises yet.</p> : null}
      </div>
    </div>
  );
}

function InformationTab() {
  const persistContent = useServerFn(saveContent);
  const persistCards = useServerFn(saveCards);
  const [content, setContent] = useState<SiteContent>({
    main_heading: "",
    footer_tagline: "",
    footer_paragraph: "",
  });
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [contentResult, cardsResult] = await Promise.all([
        supabase
          .from("site_content")
          .select("main_heading, footer_tagline, footer_paragraph")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("cards").select(CARD_FIELDS).order("position"),
      ]);
      if (!active) return;
      if (contentResult.data) setContent(contentResult.data as SiteContent);
      setCards(
        ((cardsResult.data ?? []) as unknown as CardRow[]).map((card) => ({
          ...card,
          key: card.id,
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  function move(index: number, delta: number) {
    setCards((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      await persistContent({ data: content });
      await persistCards({
        data: {
          cards: cards.map((card, index) => ({
            heading: card.heading,
            body: card.body,
            link_url: card.link_url,
            link_label: card.link_label,
            image_url: card.image_url,
            image_alt: card.image_alt,
            position: index,
          })),
        },
      });
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="veil-in space-y-6">
      <div className="glass-panel space-y-4 rounded-2xl p-6">
        <Field
          label="Main heading"
          value={content.main_heading}
          onChange={(value) => setContent({ ...content, main_heading: value })}
        />
        <Field
          label="Footer tagline"
          value={content.footer_tagline}
          onChange={(value) => setContent({ ...content, footer_tagline: value })}
        />
        <Field
          label="Footer paragraph"
          textarea
          value={content.footer_paragraph}
          onChange={(value) => setContent({ ...content, footer_paragraph: value })}
        />
      </div>

      <div className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Cards ({cards.length}/20)
          </p>
          <button
            disabled={cards.length >= 20}
            onClick={() =>
              setCards((current) => [
                ...current,
                {
                  key: crypto.randomUUID(),
                  heading: "",
                  body: "",
                  link_url: null,
                  link_label: null,
                  image_url: null,
                  image_alt: null,
                  position: current.length,
                },
              ])
            }
            className="rounded-full bg-secondary px-3 py-1 text-xs transition hover:text-foreground disabled:opacity-40"
          >
            Add card
          </button>
        </div>

        {cards.map((card, index) => {
          const set = (patch: Partial<DraftCard>) =>
            setCards((current) =>
              current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
            );
          return (
            <div key={card.key} className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                  Card {index + 1}
                </span>
                <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
                  <button onClick={() => move(index, -1)} className="hover:text-foreground">
                    Up
                  </button>
                  <button onClick={() => move(index, 1)} className="hover:text-foreground">
                    Down
                  </button>
                  <button
                    onClick={() =>
                      setCards((current) =>
                        current.length > 1 ? current.filter((_, i) => i !== index) : current,
                      )
                    }
                    className="text-destructive hover:brightness-125"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <Field
                label="Heading"
                value={card.heading ?? ""}
                onChange={(value) => set({ heading: value })}
              />
              <Field
                label="Paragraph"
                textarea
                value={card.body ?? ""}
                onChange={(value) => set({ body: value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Link URL"
                  value={card.link_url ?? ""}
                  onChange={(value) => set({ link_url: value })}
                />
                <Field
                  label="Link text"
                  value={card.link_label ?? ""}
                  onChange={(value) => set({ link_label: value })}
                />
                <Field
                  label="Image URL"
                  value={card.image_url ?? ""}
                  onChange={(value) => set({ image_url: value })}
                />
                <Field
                  label="Image alt"
                  value={card.image_alt ?? ""}
                  onChange={(value) => set({ image_alt: value })}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          Save changes
        </button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring";
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}
