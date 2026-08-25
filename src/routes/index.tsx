import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  askQuestion,
  checkPromise,
  logActivity,
  makePromise,
  type CardRow,
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
    queryFn: async () => {
      const [content, cards] = await Promise.all([
        supabase
          .from("site_content")
          .select("main_heading, footer_tagline, footer_paragraph")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("cards").select("id, kind, value, label, position").order("position"),
      ]);
      return {
        content: (content.data ?? {
          main_heading: "Garden Of Secrets",
          footer_tagline: "",
          footer_paragraph: "",
        }) as SiteContent,
        cards: (cards.data ?? []) as CardRow[],
      };
    },
  });
}

function Main() {
  const [locator, setLocator] = useState("");
  const queryClient = useQueryClient();
  const check = useServerFn(checkPromise);
  const promise = useServerFn(makePromise);
  const log = useServerFn(logActivity);

  useEffect(() => {
    setLocator(readLocator());
  }, []);

  useEffect(() => {
    if (!locator) return;
    void log({ data: { locator, event: "page_open" } }).catch(() => {});
  }, [locator, log]);

  const promiseState = useQuery({
    queryKey: ["promise", locator],
    enabled: Boolean(locator),
    queryFn: () => check({ data: { locator } }),
  });

  const site = useSiteData();
  const promised = promiseState.data?.promised === true;

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-center px-6">
          <span className="font-display text-lg tracking-[0.32em] text-foreground/90 uppercase sm:text-xl">
            Garden Of Secrets
          </span>
        </div>
      </header>

      {promised ? (
        <Content
          content={site.data?.content}
          cards={site.data?.cards ?? []}
          locator={locator}
        />
      ) : (
        <div className="min-h-[60vh]" />
      )}

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

function AskQuestion({ locator }: { locator: string }) {
  const ask = useServerFn(askQuestion);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="rounded-lg border border-border bg-secondary/60 px-5 py-2.5 text-sm text-foreground/85 transition hover:text-foreground"
      >
        Ask a question
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-5 backdrop-blur-md">
          <div className="glass-panel veil-in w-full max-w-md rounded-2xl p-7">
            {sent ? (
              <>
                <p className="text-sm text-foreground/85">Your question is saved.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110"
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
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not send.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <h2 className="text-xl font-light text-foreground">Ask a question</h2>
                <textarea
                  rows={5}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-5 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring"
                />
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    disabled={pending || body.trim().length < 2}
                    className="flex-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                  >
                    Ask
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
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


function Content({ content, cards }: { content: SiteContent | undefined; cards: CardRow[] }) {
  return (
    <main className="swipe-in mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
      <h1 className="text-balance text-4xl font-light leading-tight text-foreground sm:text-5xl">
        {content?.main_heading}
      </h1>

      <div className="mt-12 space-y-5">
        {cards.map((card, index) => (
          <article
            key={card.id}
            className="glass-panel swipe-in rounded-xl p-6 sm:p-7"
            style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
          >
            <CardBody card={card} />
          </article>
        ))}
      </div>

      <footer className="mt-24 border-t border-border/60 pt-8">
        {content?.footer_tagline ? (
          <p className="font-display text-lg text-foreground/85">{content.footer_tagline}</p>
        ) : null}
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {content?.footer_paragraph}
        </p>
      </footer>
    </main>
  );
}

function CardBody({ card }: { card: CardRow }) {
  if (card.kind === "image") {
    return (
      <img
        src={card.value}
        alt={card.label ?? ""}
        loading="lazy"
        className="w-full rounded-lg object-cover"
      />
    );
  }
  if (card.kind === "link") {
    return (
      <a
        href={card.value}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-sm text-primary underline-offset-4 transition-colors hover:underline"
      >
        {card.label || card.value}
      </a>
    );
  }
  if (card.kind === "heading") {
    return <h2 className="text-2xl font-light text-foreground">{card.value}</h2>;
  }
  return (
    <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/80">
      {card.value}
    </p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-5 backdrop-blur-md">
      <div className="glass-panel veil-in w-full max-w-md rounded-2xl p-7 sm:p-9">
        <h2 className="text-balance text-2xl font-light leading-snug text-foreground">
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
