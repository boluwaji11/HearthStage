/**
 * STG-13, ST17.4, ST21.9. Every word Stage puts on a screen.
 *
 * This is not a translation feature. It is the thing that makes translation
 * possible later without reading every file in the application, and it has to
 * be done from the start because the cost of retrofitting it grows with the
 * number of screens.
 *
 * Stage has its own catalogue rather than sharing the platform's. The two run
 * in different processes, ship on different days and talk about different
 * things: the platform says "Add a household" and Stage says "Black the
 * screen". A shared file would be a merge conflict between two products on
 * every release, and a translator would be handed a thousand strings to find
 * the forty that are on a laptop at the front of a church.
 *
 * Deliberately not a framework. One locale, no routing, no build step. What it
 * does give is the part that is expensive to add later: every string in one
 * file, and a key that does not exist failing to compile.
 */

import { en } from "./messages/en";

export type Messages = typeof en;
export type MessageKey = keyof Messages;

/** Values interpolated into a message, as {name} in the catalogue. */
export type Params = Record<string, string | number>;

const CATALOGUES = { en } as const;
export type Locale = keyof typeof CATALOGUES;

export const DEFAULT_LOCALE: Locale = "en";

/** The locales that have a complete catalogue. */
export const LOCALES = Object.keys(CATALOGUES) as Locale[];

function interpolate(template: string, params?: Params): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    // A missing value renders the placeholder rather than "undefined", so a
    // defect in a message looks like one rather than like a sentence about
    // nothing.
    return value === undefined ? whole : String(value);
  });
}

/**
 * Looks up a message and fills in its values.
 *
 * The key is typed against the catalogue, so a typo or a renamed key is a
 * compile error rather than a blank space on a screen somebody is operating a
 * service from.
 */
export function t(key: MessageKey, params?: Params, locale: Locale = DEFAULT_LOCALE): string {
  const catalogue = CATALOGUES[locale] ?? en;
  return interpolate(catalogue[key] ?? en[key], params);
}

/**
 * The plural form of a message, chosen by the locale's own rules.
 *
 * The catalogue holds one key per category, suffixed `.one`, `.other` and so
 * on. Intl.PluralRules decides which. English having two forms is a fact about
 * English rather than about counting, and Polish has four.
 *
 * `count` is always available to the message as {count}.
 */
export function plural(
  key: PluralKey,
  count: number,
  params?: Params,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const rule = new Intl.PluralRules(locale).select(count);
  const exact = `${key}.${rule}` as MessageKey;
  const fallback = `${key}.other` as MessageKey;
  const catalogue = CATALOGUES[locale] ?? en;
  const template = catalogue[exact] ?? catalogue[fallback] ?? en[fallback];
  return interpolate(template, { count, ...params });
}

type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * The stems that have plural forms, derived from the catalogue rather than
 * listed. Written through a generic because a conditional type only distributes
 * over a naked type parameter, and `MessageKey extends ...` on its own
 * collapses the whole union to never.
 */
type StemOf<K> = K extends `${infer Stem}.${PluralCategory}` ? Stem : never;
export type PluralKey = StemOf<MessageKey>;

export { en };
