/**
 * Builds a real library on disk, then destroys it and brings it back.
 *
 * ST19.5 says the library is backed up on every write with a restore inside
 * Stage, because for a church that never pairs with the platform this file is
 * the only copy of its work. This script is that claim, run.
 *
 *   pnpm --filter @hearth/stage-store library
 *   pnpm --filter @hearth/stage-store library -- --keep
 *
 * Developer facing, so these strings are deliberately outside packages/i18n.
 */

import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { amazingGrace, holyHolyHoly } from "@hearth/songs/fixtures";
import type { WholeSong } from "@hearth/songs";
import { backup, backups, isUsable, openLibrary, restore } from "../src/index";

const bold = (text: string) => `\u001b[1m${text}\u001b[0m`;
const dim = (text: string) => `\u001b[2m${text}\u001b[0m`;
const tick = dim("  ok  ");

const keep = process.argv.includes("--keep");
const directory = mkdtempSync(join(tmpdir(), "hearth-stage-library-"));
const path = join(directory, "library.db");

const local = (whole: WholeSong): WholeSong => ({
  ...whole,
  song: { ...whole.song, origin: "local" },
});

function kb(file: string): string {
  return existsSync(file) ? `${Math.round(statSync(file).size / 1024)} KB` : "gone";
}

async function main(): Promise<void> {
  console.log("");
  console.log(bold("The library on the laptop"));
  console.log(dim(path));
  console.log("");

  const opened = openLibrary(path, { backups: false, generations: 3 });
  console.log(`${tick}opened, migrated ${opened.migrated.from} to ${opened.migrated.to}`);

  opened.library.save(local(amazingGrace));
  opened.library.save(local(holyHolyHoly));
  console.log(`${tick}saved two songs  ${dim(kb(path))}`);

  console.log("");
  for (const summary of opened.library.list()) {
    console.log(
      `   ${summary.title.padEnd(20)} ${dim(
        `${summary.author ?? "unknown"} · key of ${summary.defaultKey ?? "?"} · ` +
          `${summary.sectionCount} sections · ${summary.arrangementCount} arrangements · CCLI ${summary.ccliNumber ?? "none"}`,
      )}`,
    );
  }
  console.log("");

  // A song whose only fault is the one being demonstrated, so the message says
  // one thing.
  const blob: WholeSong = {
    song: { ...local(amazingGrace).song, id: "song-blob", title: "A Blob" },
    sections: [
      {
        id: "blob-v1",
        songId: "song-blob",
        sectionType: "verse",
        label: "V1",
        sortOrder: 0,
        lines: ["Line one\nLine two\nLine three"],
        language: "en",
        translationOf: null,
      },
    ],
    arrangements: [
      {
        id: "blob-default",
        songId: "song-blob",
        name: "Default",
        key: "G",
        tempoBpm: null,
        sequence: ["V1"],
        chordpro: null,
        isDefault: true,
      },
    ],
    media: [],
  };
  try {
    opened.library.save(blob);
    console.log(bold("   a blob was accepted, which is a defect"));
  } catch (error) {
    const problems = (error as { problems?: { code: string }[] }).problems ?? [];
    console.log(`${tick}refused a song whose lyrics were one string with newlines in it`);
    console.log(dim(`        ${problems.map((problem) => problem.code).join(", ")}`));
  }

  const synced: WholeSong = { ...amazingGrace, song: { ...amazingGrace.song, origin: "hearth" } };
  try {
    opened.library.save(synced);
    console.log(bold("   a synced song was accepted, which is a defect"));
  } catch {
    console.log(`${tick}refused a synced song, because the library holds what Stage owns`);
  }

  opened.library.archive("song-holy");
  console.log(
    `${tick}archived one. The list shows ${opened.library.count()}, the file still holds ${opened.library.count(
      { includeArchived: true },
    )}`,
  );

  const info = await backup(opened.db, path, { generations: 3 });
  console.log(`${tick}backed up  ${dim(`${Math.round(info.bytes / 1024)} KB`)}`);
  opened.close();

  console.log("");
  console.log(bold("Now the laptop loses it"));
  rmSync(path);
  for (const suffix of ["-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
  console.log(`${tick}deleted the library  ${dim(kb(path))}`);

  const found = backups(path, { generations: 3 });
  console.log(
    `${tick}${found.length} backup${found.length === 1 ? "" : "s"} on disk, newest usable: ${isUsable(
      found[0]?.path ?? "",
    )}`,
  );

  restore(path, found[0]?.path ?? "");
  console.log(`${tick}restored  ${dim(kb(path))}`);

  const back = openLibrary(path, { backups: false });
  console.log("");
  console.log(bold("What came back"));
  for (const summary of back.library.list({ includeArchived: true })) {
    const song = back.library.get(summary.id);
    const chart = song?.arrangements.find((a) => a.chordpro !== null);
    console.log(
      `   ${summary.title.padEnd(20)} ${dim(
        `${summary.sectionCount} sections · ${summary.arrangementCount} arrangements · ` +
          `${chart === undefined ? "no chart" : "chart intact"}` +
          `${summary.archivedAt === null ? "" : " · still archived"}`,
      )}`,
    );
  }

  const verse = back.library
    .get("song-amazing-grace")
    ?.sections.find((section) => section.label === "V1");
  console.log("");
  console.log(dim("   and the lyrics are still lines rather than a blob:"));
  for (const line of verse?.lines ?? []) console.log(`     ${line}`);
  back.close();

  console.log("");
  if (keep) {
    console.log(dim(`Left on disk: ${directory}`));
  } else {
    rmSync(directory, { recursive: true, force: true });
    console.log(dim("Cleaned up. Pass --keep to leave the files behind."));
  }
  console.log("");
}

void main();
