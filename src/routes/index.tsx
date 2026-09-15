import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ProfileCard } from "@/components/ProfileCard";
import {
  askQuestion,
  checkPromise,
  logActivity,
  makePromise,
  myQuestions,
  CARD_FIELDS,
  PROFILE_FIELDS,
  type CardRow,
  type ProfileRow,
  type QuestionRow,
  type SiteContent,
} from "@/lib/garden.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Garden Of Secrets" },
      { name: "description", content: "A quiet place." },
      { property: "og:title", content: "Garden Of Secrets" },
      { property: "og:description", content: "A quiet place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Main,
});

const LOCATOR_STORAGE_KEY = "gos.locator";
const LAST_SEEN_KEY = "gos.lastSeen";

function readLocator() {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(LOCATOR_STORAGE_KEY) ?? "";
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(key)) {
    key = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(LOCATOR_STORAGE_KEY, key);
  }
  return key;
}

function useSiteData() {
  return useQuery({
    queryKey: ["site-data"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [content, cards, profiles] = await Promise.all([
        supabase
          .from("site_content")
          .select("main_heading, footer_tagline, footer_paragraph")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("cards").select(CARD_FIELDS).order("position"),
        supabase.from("profiles").select(PROFILE_FIELDS).order("position"),
      ]);
      return {
        content: (content.data ?? {
          main_heading: "Garden Of Secrets",
          footer_tagline: "",
          footer_paragraph: "",
        }) as SiteContent,
        cards: (cards.data ?? []) as unknown as CardRow[],
        profiles: ((profiles.data ?? []) as unknown as ProfileRow[]).map((profile) => ({
          ...profile,
          list_items: Array.isArray(profile.list_items)
            ? profile.list_items.map((item) => String(item))
            : [],
        })),
      };
    },
  });
}

/** Reveals an element the first time it scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Main() {
  const [locator, setLocator] = useState("");
  const queryClient = useQueryClient();
  const check = useServerFn(checkPromise);
  const promise = useServerFn(makePromise);
  const log = useServerFn(logActivity);
  const [veiled, setVeiled] = useState(false);

  useEffect(() => {
    setLocator(readLocator());
  }, []);

  useEffect(() => {
    if (!locator) return;
    void log({ data: { locator, event: "page_open" } }).catch(() => {});
  }, [locator, log]);

  // Privacy veil: Escape blurs everything instantly.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setVeiled((current) => !current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const promiseState = useQuery({
    queryKey: ["promise", locator],
    enabled: Boolean(locator),
    queryFn: () => check({ data: { locator } }),
  });

  const site = useSiteData();
  const promised = promiseState.data?.promised === true;

  return (
    <div className="relative min-h-screen">
      <ReadingProgress />

      <header className="hairline sticky top-0 z-30 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-4 px-6">
          <span className="w-8" />
          <span className="font-display text-lg tracking-[0.22em] text-foreground/90 sm:text-xl">
            Garden of Secrets
          </span>
          <button
            type="button"
            aria-label={veiled ? "Show page" : "Hide page"}
            title="Hide the page (Esc)"
            onClick={() => setVeiled((current) => !current)}
            className="w-8 text-right text-xs tracking-[0.14em] text-muted-foreground transition-colors duration-300 hover:text-primary"
          >
            {veiled ? "show" : "hide"}
          </button>
        </div>
      </header>

      <div className={veiled ? "veiled" : "transition-[filter] duration-500"}>
        {promised ? (
          <Content
            content={site.data?.content}
            cards={site.data?.cards ?? []}
            profiles={site.data?.profiles ?? []}
            locator={locator}
          />
        ) : (
          <div className="min-h-[60vh]" />
        )}
      </div>

      {veiled ? (
        <button
          type="button"
          onClick={() => setVeiled(false)}
          className="fixed inset-0 z-40 flex items-center justify-center text-xs tracking-[0.3em] text-muted-foreground uppercase"
        >
          tap to reveal
        </button>
      ) : null}

      {locator && promiseState.isSuccess && !promised ? (
        <PromiseModal
          onPromise={async () => {
            await promise({ data: { locator } });
            await queryClient.invalidateQueries({ queryKey: ["promise", locator] });
          }}
        />
      ) : null}
    </div>
  );
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-40 h-px bg-transparent">
      <div
        className="h-px bg-primary/70 transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

const MAIN_TABS = [
  { id: "notifications", label: "Notifications" },
  { id: "questions", label: "Questions & Answers" },
  { id: "profiles", label: "Profiles" },
] as const;
type MainTab = (typeof MAIN_TABS)[number]["id"];

function Content({
  content,
  cards,
  profiles,
  locator,
}: {
  content: SiteContent | undefined;
  cards: CardRow[];
  profiles: ProfileRow[];
  locator: string;
}) {
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [tab, setTab] = useState<MainTab>("notifications");

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(LAST_SEEN_KEY) ?? 0);
    setLastSeen(Number.isFinite(stored) && stored > 0 ? stored : null);
    const timer = setTimeout(
      () => window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now())),
      4000,
    );
    return () => clearTimeout(timer);
  }, []);

  const freshCount = useMemo(() => {
    if (!lastSeen) return 0;
    return cards.filter((card) => card.created_at && Date.parse(card.created_at) > lastSeen).length;
  }, [cards, lastSeen]);

  return (
    <main className="swipe-in mx-auto max-w-2xl px-5 pt-16 pb-28 sm:px-6 sm:pt-28">
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3.5 py-1 text-[11px] tracking-[0.14em] text-muted-foreground">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${freshCount > 0 ? "bg-primary" : "bg-muted-foreground/50"}`}
          />
          {freshCount > 0 ? `${freshCount} new since your last visit` : "Nothing new right now"}
        </p>
        <h1 className="text-balance mx-auto mt-6 max-w-xl text-4xl leading-tight font-bold text-foreground sm:text-5xl">
          {content?.main_heading}
        </h1>
        <div className="gold-rule mx-auto mt-9 w-40" />
      </div>

      <nav className="gos-no-scrollbar mt-12 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="mx-auto flex w-max gap-1 rounded-full border border-border/60 bg-secondary/30 p-1 backdrop-blur-md">
          {MAIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`ask-trigger rounded-full px-5 py-2 text-xs tracking-[0.08em] whitespace-nowrap ${
                tab === item.id
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_var(--color-primary)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "notifications" ? (
        <div key="notifications" className="veil-in mt-10 space-y-6">
          {cards.map((card, index) => (
            <CardBlock
              key={card.id}
              card={card}
              index={index}
              isNew={Boolean(lastSeen && card.created_at && Date.parse(card.created_at) > lastSeen)}
            />
          ))}
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "questions" ? (
        <div key="questions" className="veil-in mt-10">
          {locator ? <AskQuestion locator={locator} /> : null}
          {locator ? <Thread locator={locator} /> : null}
        </div>
      ) : null}

      {tab === "profiles" ? (
        <div key="profiles" className="veil-in mt-10 grid gap-6 sm:grid-cols-1">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles yet.</p>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-24 border-t border-border/50 pt-10 text-center">
        {content?.footer_tagline ? (
          <p className="font-display text-lg font-semibold text-foreground/85">{content.footer_tagline}</p>
        ) : null}
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {content?.footer_paragraph}
        </p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-8 text-[11px] tracking-[0.2em] text-muted-foreground transition-colors duration-300 hover:text-primary"
        >
          Back to top
        </button>
      </footer>
    </main>
  );
}

function CardBlock({ card, index, isNew }: { card: CardRow; index: number; isNew: boolean }) {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <article
      ref={ref}
      data-visible={visible}
      className="reveal glass-panel panel-lift rounded-2xl p-6 sm:p-8"
      style={{ transitionDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {isNew ? (
        <span className="mb-3 inline-block rounded-full border border-primary/40 px-2.5 py-0.5 text-[10px] tracking-[0.22em] text-primary uppercase">
          new
        </span>
      ) : null}

      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.image_alt ?? ""}
          loading="lazy"
          className="mb-5 w-full rounded-lg object-cover"
        />
      ) : null}

      {card.heading ? (
        <h2 className="text-2xl leading-snug font-semibold text-foreground">{card.heading}</h2>
      ) : null}

      {card.body ? (
        <p className="mt-3 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-foreground/80">
          {card.body}
        </p>
      ) : null}

      {card.link_url ? (
        <a
          href={card.link_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-5 inline-block text-sm text-primary underline-offset-4 transition-colors hover:underline"
        >
          {card.link_label || card.link_url}
        </a>
      ) : null}
    </article>
  );
}

function Thread({ locator }: { locator: string }) {
  const mine = useServerFn(myQuestions);
  const thread = useQuery({
    queryKey: ["my-questions", locator],
    queryFn: () => mine({ data: { locator } }),
    refetchInterval: 30000,
  });
  const rows = (thread.data?.questions ?? []) as QuestionRow[];
  if (rows.length === 0) return null;

  return (
    <section className="mt-16">
      <p className="text-center text-[11px] tracking-[0.2em] text-muted-foreground">
        Your thread
      </p>
      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="glass-panel rounded-2xl p-6">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
              {row.body}
            </p>
            {row.answer ? (
              <p className="mt-4 border-l-2 border-primary/50 pl-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/70">
                {row.answer}
              </p>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Waiting for a reply.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AskQuestion({ locator }: { locator: string }) {
  const ask = useServerFn(askQuestion);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="ask-trigger group rounded-lg border border-border bg-secondary/60 px-5 py-2.5 text-sm tracking-wide text-foreground/85 active:scale-[0.97] hover:bg-primary/15 hover:border-primary/50 hover:text-primary"
      >
        Ask a question
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex w-screen flex-col items-center justify-center overflow-y-auto bg-background px-5 py-10 sm:px-6">
          <div className="veil-in mx-auto w-full max-w-xl px-4 sm:px-8">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <span className="text-lg text-primary">✓</span>
                </div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.01em] text-foreground">
                  Question saved
                </h2>
                <p className="mt-3 text-sm leading-[1.8] text-muted-foreground/90">
                  Your question is stored privately against your promise key. Check the Questions &
                  Answers tab for a reply.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="ask-trigger mt-9 w-full rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] hover:bg-secondary hover:text-foreground"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  setError(null);
                  try {
                    await ask({ data: { locator, body } });
                    setBody("");
                    setSent(true);
                    await queryClient.invalidateQueries({ queryKey: ["my-questions", locator] });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not send.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <p className="text-center text-[0.7rem] tracking-[0.22em] text-muted-foreground/70 uppercase">
                  private &amp; anonymous
                </p>
                <h2 className="mt-3 text-center text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-[1.7rem]">
                  Ask a question
                </h2>
                <p className="mt-3 text-center text-sm leading-[1.8] text-muted-foreground/90">
                  Only the keeper of this garden can read it.
                </p>
                <textarea
                  rows={7}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write your question here…"
                  autoFocus
                  className="mt-8 w-full resize-none rounded-2xl border border-border bg-input/40 px-4 py-3.5 text-[0.95rem] leading-[1.7] outline-none transition-colors duration-300 placeholder:text-muted-foreground/50 focus:border-ring"
                />
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={pending || body.trim().length < 2}
                    className="ask-trigger flex-1 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:hover:bg-primary disabled:hover:text-primary-foreground"
                  >
                    {pending ? "Sending…" : "Ask"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="ask-trigger rounded-xl border border-border px-5 py-3.5 text-sm text-muted-foreground active:scale-[0.98] hover:border-primary/50 hover:bg-primary/15 hover:text-primary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PromiseModal({ onPromise }: { onPromise: () => Promise<void> }) {
  const [remaining, setRemaining] = useState(5);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const label = useMemo(
    () => (remaining > 0 ? `I Promise (${remaining})` : "I Promise"),
    [remaining],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/92 px-5 backdrop-blur-lg">
      <div className="glass-panel veil-in w-full max-w-md rounded-3xl px-8 py-10 sm:px-11 sm:py-12">
        <h2 className="text-balance shimmer-text text-[1.55rem] leading-[1.35] font-bold tracking-[-0.01em] sm:text-[1.7rem]">
          Do you want to know about the apple of discord(s)?
        </h2>
        <p className="mt-5 text-[0.95rem] leading-[1.85] text-muted-foreground/90">
          Please don't let anyone know about this web. I will provide more information about 9th if
          you do not tell anyone. so
        </p>
        <button
          type="button"
          disabled={remaining > 0 || pending}
          onClick={async () => {
            setPending(true);
            try {
              await onPromise();
            } finally {
              setPending(false);
            }
          }}
          className="ask-trigger mt-10 w-full rounded-xl bg-primary px-5 py-3.5 text-[0.95rem] font-semibold tracking-[0.02em] text-primary-foreground transition-all duration-500 hover:brightness-115 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground/70 disabled:shadow-none"
        >
          {label}
        </button>
        {remaining > 0 ? (
          <p className="mt-4 text-center text-[0.7rem] tracking-[0.14em] text-muted-foreground/60 uppercase">
            read carefully before you promise
          </p>
        ) : null}
      </div>
    </div>
  );
}
