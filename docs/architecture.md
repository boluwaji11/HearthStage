# Hearth Stage architecture

How Stage is built. [PRD.md](../PRD.md) says what it does.
[hearth-sync-contract.md](hearth-sync-contract.md) says how it talks to the platform when a church pairs it.

**Stage runs on its own.** It holds its own song library, imports the library a church already has,
and presents a service with nothing of ours on the network. Pairing with Hearth adds a second source
of songs and plans, and it adds no dependency to anything described here except the sync client.

## Shape

```
apps/
  stage                 Electron application
    src/main            Main process: windows, displays, SQLite, sync, triggers
    src/preload         Typed IPC bridge, channel allowlist
    src/control         Renderer: the operator's control surface
    src/output          Renderer: an output window, one per display
    src/display         Renderer: stage display and confidence monitor
    src/remote          Served to a phone on the local network
packages/
  songs                 Song model, sequence resolution, ChordPro, deck compilation
  song-import           Readers for ProPresenter, EasyWorship, OpenLP, OpenSong, OpenLyrics
  stage-protocol        IPC and local control API types, shared by main and renderers
  ui                    Design tokens and components, shared with the web app
  i18n                  String catalogue, shared with the web app
```

`packages/songs` is the reason this is a monorepo. The platform's music stand view and Stage's slides
resolve the same arrangement with the same function, so they cannot disagree. `packages/song-import`
is the same bargain for the five file formats: Stage builds the readers in S0.2 and the platform's
R20.10 importers use them unchanged.

## Why Electron

Three things decide it, and they are the three things a browser tab cannot do.

1. **Real displays.** One fullscreen window per physical display, addressed by display identity so
   the main projector always lands on the same output (ST10.4). A browser offers one fullscreen
   element on the display it happens to be on.
2. **A library of its own, on disk.** A local SQLite database the church authors into, a
   content-addressed media directory, and no network in the render path (ST21.8). A browser tab
   cannot hold a 2,000 song library a volunteer trusts.
3. **Hardware.** Hardware video decode, MIDI, OSC, NDI, and a Stream Deck, all native.

The cost is a 150MB installer and Chromium's memory floor, which is why ST21.5 names 2019 hardware as
the measurement target rather than a developer's laptop.

## Processes

```
                     ┌──────────────────────────────┐
                     │ main                         │
                     │  display manager             │
   keychain ◄────────┤  deck compiler (packages/songs)
   library.db◄───────┤  library, set lists, usage   │
   cache.db ◄────────┤  sync client (paired only)   │
   media dir◄────────┤  usage queue                 │
                     │  hotkeys, MIDI, OSC          │
                     │  local HTTP server (remote)  │
                     └───┬────────┬────────┬────────┘
                         │        │        │   typed IPC, state down, intent up
              ┌──────────▼┐  ┌────▼─────┐  ┌▼──────────┐
              │ control    │  │ output n │  │ display   │
              │ (office)   │  │ (dumb)   │  │ (station) │
              └────────────┘  └──────────┘  └───────────┘
```

**Main owns all state.** Every renderer is a function of state it is handed. No renderer reads the
database, holds the token, or decides what is live.

**Renderers are sandboxed.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a
preload exposing a named channel allowlist, and a content security policy with no remote origins. An
output window renders church lyrics from a local cache and has no business holding a filesystem
handle.

**One renderer per output.** An output crashing takes out one screen, which main restarts
automatically, and leaves the others running (ST19.3). One window driving several displays would mean
one crash taking the whole room dark.

### IPC

Typed in `packages/stage-protocol`, and one-directional in meaning:

- **Down: state.** `OutputState` is the complete description of what an output should show. A renderer
  diffs it and paints. There is no "advance" message to an output.
- **Up: intent.** The control surface sends `Advance`, `GoTo`, `Black`. Main decides what that means
  and broadcasts new state.

The payoff is that recovery, the remote, the Stream Deck, and the control surface are all the same
code path. A restored session is state applied to fresh renderers, which is why ST19.1's five seconds
is achievable.

## The deck

Compilation is pure, lives in `packages/songs`, and runs in main.

```
set list or Hearth plan + songs + arrangements + themes
          │
          ▼  compileDeck()        pure, deterministic, unit tested
   Deck { groups: CueGroup[] }
          │
          ▼  one cue
   Cue { kind, slide, theme, background, meta }
          │
          ▼  resolve()
   OutputState per output
```

- A **cue group** is one item of a Stage set list or one item of a Hearth plan, which compile to the
  same structure. A **cue** is a slide, or a marker for a non-presenting item (ST5.4).
- A song's cues come from resolving the arrangement's `sequence` against the song's labelled sections.
  `V1 C V2 C B C C` produces seven groups of slides, repeats included as separate cues (ST5.2).
- A section longer than the theme's line limit splits into several cues, breaking on line boundaries
  (ST6.1).
- **Compilation is deterministic**, so it is tested against golden fixtures. A sequence referencing a
  label the song does not have fails at compile time with the label named, rather than at 10:31 on a
  a service (ST5.2 acceptance).
- Compilation happens when a set list or plan is opened, and when a plan change is accepted. A cue
  advance never compiles anything.

### Text fitting

By measurement (ST6.2).

Fitting is a binary search over font size against a measured text bounding box, run in an offscreen
renderer at deck compile time, with the result cached by `(text, theme id, output resolution)` in
SQLite. All slides in one section share the smallest size any of them needs, so words do not jump
between slides.

The point is that **no measurement happens in the render path**. An advance applies a cached size.

### Advance

```
key event → control → IPC intent → main: cue index += 1
          → OutputState broadcast → output renderer: swap layers
```

The budget is 100ms at the 99th percentile (ST21.1), measured by frame capture rather than by a
timestamp in the code. What keeps it inside the budget:

- The next cue's slide is already in the DOM, composited, at opacity zero. An advance is an opacity
  transition on two GPU layers.
- The media for the next cue is already decoded and the next-but-one is prefetched.
- Between the key and the pixels there is no layout, measurement, database read, or network call.

## Local store

**SQLite** through `better-sqlite3`, in the Electron userData directory, WAL mode.

Three stores, and the split is the thing that makes a standalone presenter safe to trust.

| Store | Contents | Lifetime |
|---|---|---|
| `library.db` | **The church's library.** Songs, sections, arrangements, charts, set lists, the usage log, and the import journal for thirty-day rollback. | **Durable, and for an unpaired church this is the only copy.** Backed up on every write, restorable from inside Stage (ST19.5). |
| `cache.db` | Everything synced from a paired platform, plus the text-fitting cache | Disposable. Deleted and rebuilt by a full resync. |
| `local.db` | Usage push queue, the live cue pointer, output configuration, this run's overrides, deck snapshots | Durable. Small, and written on every cue change. |
| `media/` | Content-addressed files, `media/sha256/ab/cd/<hash>` | LRU evicted against a ceiling |

**`library.db` and `cache.db` are never the same table.** A resync truncates and rebuilds `cache.db`
and cannot reach a song the church typed in (ST4.3), and a corrupt cache therefore costs a download
rather than a library (ST19.4). It is also what enforces the two-origin rule in PRD section 2:
a song's origin is which file it lives in, so "Stage cannot edit a `hearth` song" is a property of the
storage rather than a check somebody has to remember to write.

Queries read both stores through one view, so the renderer and the deck compiler never know or care
which source a song came from.

The schema mirrors the platform's column names, so a sync is an insert and a promotion (ST2.14) is a
copy.

**Queries are prepared statements against `better-sqlite3`, and migrations are hand written, versioned
by `PRAGMA user_version`, one transaction per step.** An earlier draft of this document said Drizzle
here too. It was changed when the store was built, for three reasons. The library is four tables, so
an ORM's type safety buys little. The data is a church's own work on a laptop that updates itself, and
a migrator we own in one readable file has no tool version of its own to fall out of step with it. And
an interrupted upgrade has to leave the database at the last step that finished, which is easier to
guarantee when the mechanism is forty lines long. Drizzle stays on the platform, against Postgres,
where generated SQL and a review process earn their keep.

Two invariants are enforced by the store rather than by a screen, because a screen is one of several
callers:

- **A song is validated before it is written.** `validateWholeSong` runs on every save and an error
  refuses it, which is what makes the R12.4 newline guard binding: a blob wearing an array cannot
  reach the disk.
- **`library.db` accepts only a `local` song.** A synced song is refused outright, so the two-writer
  rule is a property of which file a row is in.

### Sync, when a church has paired

- Runs in main, on a worker thread, off the path of a cue.
- A `changes` loop, then body fetches, then **one transaction per page that writes the rows and
  advances the cursor together**. A crash replays, and replay is safe because every write is an upsert.
- Backoff on failure, and every failure path ends in serving what is on disk.
- The usage queue is drained on reconnect, idempotently.
- **An unpaired Stage never starts this.** The sync client is not constructed, the timer is not armed,
  and the control surface leaves sync off the screen entirely.

### Import

`packages/song-import` presents one reader interface per format and emits records in the PRD section
9.4 schema. Everything after that is shared: the dry run counts and reports, the duplicate check runs
on CCLI number then title and first line, and the write happens in one transaction tagged with an
import id so thirty-day rollback is a delete by that id (ST3.4).

Readers run on a worker thread, because a 300 song ProPresenter library is tens of megabytes of XML and
the control surface has to stay alive while it reads.

## Media pipeline

- Video backgrounds play in a `<video>` element in the output renderer, hardware decoded, looping
  seamlessly by double buffering two elements and crossfading at the loop point.
- A still background is an `<img>`, pre-decoded with `decode()` before the cue it belongs to becomes
  next.
- Text composites in a layer above the background, and the two never share a compositing layer, so a
  text dissolve does not force the video to re-raster.
- A missing or undecodable file degrades to the theme's solid colour, and says so on the control
  surface and never on the output (ST9.9).

## Displays

Display identity, rather than index, is the whole trick (ST10.4).

A display's identity is a stable hash of manufacturer, model, serial where available, and EDID, and it
falls back to position and resolution where it is not. Output configuration is stored against that
identity, so unplugging the projector and plugging it back in restores the same output to the same
screen.

A display disappearing closes its window and keeps its configuration. The display reappearing reopens
the window and applies current state, so the output comes back on the live slide (ST10.5).

## Remote control

A local HTTP server in main, serving `src/remote` and a small websocket for state.

- **Local network only.** It binds to the LAN interface, and nothing is proxied
  through our servers (ST14.2).
- Pairing by a code shown on the control surface, exchanged for a session cookie scoped to that
  device.
- The remote sends the same intents as the control surface and receives the same state, so two
  controllers cannot diverge (ST14.4).
- Losing the remote's wifi has no effect on the laptop, and the remote reconnects to current state
  (ST14.6).

The same server is the documented local control API in ST15.5.

## Design system

Stage uses `packages/ui` tokens, with no fourth density mode invented for it (ST20.3):

| Surface | Density |
|---|---|
| Control window | `office`, dense and keyboard-first |
| Stage display | `station`, read from twenty feet |
| Remote | `portal`, one-handed on a phone |

**Output rendering is not a user interface.** It uses a separate theme system (ST8.2), because
typography sized for a projector in a dark room is a different problem from typography on a laptop.
The themes borrow the palette and the type scale, and they do not borrow the component library.

## Testing

| Layer | How |
|---|---|
| `packages/songs` | Unit tests. Sequence resolution, section splitting, ChordPro transposition against the same fifty-chart fixture set the platform uses for R12.6. |
| Deck compilation | Golden fixtures. Fifty arrangements compile to expected decks, including the failure cases, from a Stage set list and from a Hearth plan. |
| `packages/song-import` | Golden fixtures per format. A real ProPresenter, EasyWorship, OpenLP, OpenSong and OpenLyrics library each imports to an expected set of records with section labels intact (ST3.2). |
| The library | Round-trip: a song typed in, exported, and reimported comes back with the same section types, labels and line breaks (ST2.2). Backup and restore returns every song, set list and usage row (ST19.5). |
| Rendering | A headless harness rasterises every slide in a 200-song fixture library at three resolutions, asserting no glyph crosses the safe area and no region falls below 7:1 contrast (ST6.4, ST20.4). |
| Control surface | Playwright against Electron. A full service run with the pointer disconnected (ST12.1). |
| Sync | Against a real platform instance in CI, plus a fault injection suite: held-open connections, 500s, revoked tokens, invalid cursors, a corrupt cache. A separate case asserts a resync leaves `library.db` byte-identical (ST4.3). |
| Unpaired | Every release runs the full S0.1 to S0.3 suite on a clean profile with no pairing and the network blocked, because that is how most installs will be configured. |
| Performance | Advance latency by frame capture, a three-hour soak with video backgrounds, and cold start, all on the ST21.5 reference hardware, recorded per release. |
| Recovery | `kill -9` mid-song, ten times, asserting the live slide inside five seconds (ST19.1). |
| Architecture | A test that fails the build if anything in the render path can reach the network or the sync client (ST21.8). |

**The S0.1 release ships the render harness and the latency measurement.** Performance budgets written
after the fact are wishes.

**The unpaired suite is the default suite.** A church that never pairs is a supported configuration
rather than a degraded one, so the tests treat it as the normal case and pairing as the variant.

## Packaging

- `electron-builder`. macOS signed and notarised, Windows signed, Linux AppImage and deb (ST19.10).
- `electron-updater`, downloading in the background, applying on the operator's say-so, and **refusing
  to prompt inside a service window**, which is the same rule the platform's deploys follow (ST19.7).
- The previous version is retained and rolled back to from inside Stage (ST19.8).
- Installer under 150MB per platform (ST21.11), which means the bundled video loops are few and
  compressed.

## Security

| Concern | Handling |
|---|---|
| Device token | Operating system keychain through `safeStorage`. It stays out of the cache directory, out of the logs, and out of every renderer. |
| Renderers | Sandboxed, context isolated, no node integration, CSP with no remote origins. |
| IPC | A named channel allowlist in preload. Every payload validated in main. |
| Remote server | LAN interfaces only, paired by code, session scoped. |
| Local data | The library and the synced cache are unencrypted at rest, because a presenter laptop that needs a password to read its own songs cannot start at 10:28. The control that matters is what is never there: pastoral notes, confidential note classes, giving, and contact details are outside the device principal's scope and are never synced. |
| Unpaired install | Holds no token, opens no outbound connection, and runs no sync client. There is nothing to revoke and nothing to leak. |
| Logs | Scrubbed of lyrics, names, and any token, and transmitted only on the operator's action (ST19.9, ST21.12). |
