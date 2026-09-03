import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  askQuestion,
  checkPromise,
  logActivity,
  makePromise,
  myQuestions,
  CARD_FIELDS,
  type CardRow,
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
      const [content, cards] = await Promise.all([
        supabase
          .from("site_content")
          .select("main_heading, footer_tagline, footer_paragraph")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("cards").select(CARD_FIELDS).order("position"),
      ]);
      return {
        content: (content.data ?? {
          main_heading: "Garden Of Secrets",
          footer_tagline: "",
          footer_paragraph: "",
        }) as SiteContent,
        cards: (cards.data ?? []) as unknown as CardRow[],
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

      <header className="hairline sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-6">
          <span className="w-8" />
          <span className="font-display text-lg tracking-[0.34em] text-foreground/90 uppercase sm:text-xl">
            Garden Of Secrets
          </span>
          <button
            type="button"
            aria-label={veiled ? "Show page" : "Hide page"}
            title="Hide the page (Esc)"
            onClick={() => setVeiled((current) => !current)}
            className="w-8 text-right text-xs tracking-[0.2em] text-muted-foreground uppercase transition hover:text-primary"
          >
            {veiled ? "show" : "hide"}
          </button>
        </div>
      </header>

      <div className={veiled ? "veiled" : "transition-[filter] duration-500"}>
        {promised ? (
          <Content content={site.data?.content} cards={site.data?.cards ?? []} locator={locator} />
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

function Content({
  content,
  cards,
  locator,
}: {
  content: SiteContent | undefined;
  cards: CardRow[];
  locator: string;
}) {
  const [lastSeen, setLastSeen] = useState<number | null>(null);

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
    <main className="swipe-in mx-auto max-w-3xl px-6 pt-16 pb-28 sm:pt-24">
      <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
        {freshCount > 0 ? `${freshCount} new since your last visit` : "nothing new"}
      </p>
      <h1 className="text-balance mt-5 text-4xl leading-tight font-bold text-foreground sm:text-5xl">
        {content?.main_heading}
      </h1>
      <div className="gold-rule mt-8" />

      <div className="mt-12 space-y-6">
        {cards.map((card, index) => (
          <CardBlock
            key={card.id}
            card={card}
            index={index}
            isNew={Boolean(lastSeen && card.created_at && Date.parse(card.created_at) > lastSeen)}
          />
        ))}
      </div>

      <div className="mt-14">{locator ? <AskQuestion locator={locator} /> : null}</div>

      {locator ? <Thread locator={locator} /> : null}

      <footer className="mt-24 border-t border-border/60 pt-8">
        {content?.footer_tagline ? (
          <p className="font-display text-lg font-semibold text-foreground/85">{content.footer_tagline}</p>
        ) : null}
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {content?.footer_paragraph}
        </p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-8 text-[11px] tracking-[0.28em] text-muted-foreground uppercase transition hover:text-primary"
        >
          back to top
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
      className="reveal glass-panel panel-lift rounded-xl p-6 sm:p-7"
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
      <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">your thread</p>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="glass-panel rounded-xl p-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
              {row.body}
            </p>
            {row.answer ? (
              <p className="mt-4 border-l border-primary/40 pl-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/70">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-5 backdrop-blur-md">
          <div className="glass-panel veil-in flex min-h-screen max-h-screen w-full max-w-md flex-col justify-center overflow-y-auto rounded-none p-7 sm:rounded-2xl sm:p-9">
            {sent ? (
              <>
                <p className="text-sm text-foreground/85">Your question is saved.</p>
                <button
                  type="button"
                  onClick={close}
                  className="ask-trigger mt-6 w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground active:scale-[0.97] hover:bg-secondary hover:text-foreground"
                >
                  Close
                </button>
              </>
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
                <h2 className="text-xl font-semibold text-foreground">Ask a question</h2>
                <textarea
                  rows={5}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-5 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none transition-colors duration-300 focus:border-ring"
                />
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    disabled={pending || body.trim().length < 2}
                    className="ask-trigger flex-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 active:scale-[0.97] active:bg-primary/80 disabled:opacity-50"
                  >
                    Ask
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="ask-trigger rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground active:scale-[0.97]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/88 px-5 backdrop-blur-md">
      <div className="glass-panel veil-in w-full max-w-md rounded-2xl p-7 sm:p-9">
        <h2 className="text-balance shimmer-text text-2xl leading-snug font-bold">
          Do you want to know about the apple of discord(s)?
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
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
          className="mt-8 w-full rounded-lg bg-primary px-5 py-3 text-sm font-medium tracking-wide text-primary-foreground transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
