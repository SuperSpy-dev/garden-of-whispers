export const AVATAR_STYLES = ["lorelei", "notionists"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const DEFAULT_AVATAR_STYLE: AvatarStyle = "lorelei";

export function normalizeAvatarStyle(value: unknown): AvatarStyle {
  return AVATAR_STYLES.includes(value as AvatarStyle) ? (value as AvatarStyle) : DEFAULT_AVATAR_STYLE;
}

/**
 * DiceBear avatar for a profile. The seed defaults to the holder's name, so
 * "John Doe", "John Doe 1", "John Doe 2" each produce a different avatar.
 */
export function avatarUrl(options: {
  name?: string | null;
  seed?: string | null;
  style?: string | null;
}) {
  const style = normalizeAvatarStyle(options.style);
  const seed = (options.seed || options.name || "Garden Of Secrets").trim();
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=gradientLinear&backgroundColor=transparent`;
}

/**
 * "John Doe" -> "John Doe 1" -> "John Doe 2". Each click gives a new avatar.
 */
export function bumpSeed(current: string) {
  const base = (current || "").trim();
  if (!base) return "1";
  const match = base.match(/^(.*?)(\d+)$/);
  if (!match) return `${base} 1`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
