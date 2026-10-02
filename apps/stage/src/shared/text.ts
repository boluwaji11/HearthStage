/**
 * STG-13, ST17.4. The catalogue, reaching the windows.
 *
 * Markup carries a key rather than a word. `data-t` fills the element's text,
 * and `data-t-label`, `data-t-title` and `data-t-placeholder` fill the
 * attributes a person hears or hovers. The HTML stays the shape of the screen
 * and the words stay in one file, which is the whole point: a translator reads
 * the catalogue rather than three windows and a stylesheet.
 *
 * `tests/copy.test.ts` fails the build on a word written into a window, so this
 * cannot quietly stop being how it is done.
 */

import { plural, t, type MessageKey, type Params, type PluralKey } from "@hearth/stage-i18n";

export { plural, t };
export type { MessageKey, Params, PluralKey };

const ATTRIBUTES: [string, string][] = [
  ["data-t-label", "aria-label"],
  ["data-t-title", "title"],
  ["data-t-placeholder", "placeholder"],
];

/**
 * Fills every element that names a key.
 *
 * Run once on the way up. Nothing re-runs it, because a window that changed
 * language mid-service would be a worse thing than one that did not.
 */
export function fillText(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-t]")) {
    const key = element.dataset["t"];
    if (key !== undefined) element.textContent = t(key as MessageKey);
  }

  for (const [attribute, target] of ATTRIBUTES) {
    for (const element of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
      const key = element.getAttribute(attribute);
      if (key !== null) element.setAttribute(target, t(key as MessageKey));
    }
  }
}
