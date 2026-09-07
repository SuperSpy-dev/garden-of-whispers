import { avatarUrl } from "@/lib/avatar";
import type { ProfileRow } from "@/lib/garden.functions";

export function ProfileCard({ profile }: { profile: ProfileRow }) {
  const src =
    profile.image_url ||
    avatarUrl({ name: profile.name, seed: profile.avatar_seed, style: profile.avatar_style });

  return (
    <article className="glass-panel panel-lift group relative overflow-hidden rounded-3xl rounded-tl-[5rem] p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <img
          src={src}
          alt={profile.name}
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-full border border-primary/30 bg-secondary/60 object-cover p-1 shadow-lg transition-transform duration-500 group-hover:scale-105 sm:h-28 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          {profile.rank_title ? (
            <span className="inline-block rounded-full border border-primary/35 px-3 py-0.5 text-[10px] tracking-[0.22em] text-primary uppercase">
              {profile.rank_title}
            </span>
          ) : null}
          <h3 className="mt-3 text-2xl leading-tight font-bold text-foreground">{profile.name}</h3>
          {profile.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{profile.subtitle}</p>
          ) : null}
          {profile.description ? (
            <p className="mt-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-foreground/80">
              {profile.description}
            </p>
          ) : null}
          {profile.list_items.length > 0 ? (
            <ul className="mt-5 space-y-2">
              {profile.list_items.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-2.5 text-sm text-foreground/85"
                >
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}
