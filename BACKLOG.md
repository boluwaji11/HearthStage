# Backlog, Hearth Stage

The Stage board. Separate from [BACKLOG.md](BACKLOG.md) so the platform and the presenter can be built
in parallel without two people editing one table.

Requirement IDs (`ST5.2`, `ST19.1`) point at [PRD.md](PRD.md) and say **what** to build.
Work item IDs (`STG-14`) say **when** it is being built and whether it is finished.

> **Draft 2, October 2026.** Draft 1 made Stage a thin client of the platform, which put a Hearth
> account between a church and a slide. Stage is a complete presenter that runs by itself, so the
> library and the importers are Stage's own work and sync is additive. **SE1 to SE3, fifty-eight
> stories, need nothing from the platform board.** The board was renumbered while nothing was built.

## How this works

Same four levels, same states, and the same rules as the platform board.

| Level | Meaning | ID |
|---|---|---|
| **Epic** | A Stage release. Defined by what a church can do on a Sunday with it. | `SE1` to `SE6` |
| **Feature** | A PRD domain inside that release. | `SF1` to `SF21` |
| **Story** | One deliverable. Built, then tested, then closed. | `STG-n` |
| **Task** | Steps inside a story. In the story's checklist. | |

### States

**New**, **Active**, **Resolved**, **Closed**, **Blocked**, **Deferred**. Meanings as on the platform
board. **Resolved is not Closed.** A story sits in Resolved until Boluwaji has used it by hand.

### Rules

1. **One story Active at a time on this board.** The platform board has its own Active story, and the
   two do not count against each other.
2. **Every story names what to test.**
3. **Commits reference the story**, in the footer: `Work item: STG-14`.
4. **Nothing is built that has no story.**
5. **The board is updated in the same commit as the work.**
6. **A Stage story never changes platform scope.** Where Stage needs something from the platform, it
   becomes a row in the dependency table at the bottom of this file and a story on the platform board,
   with a requirement ID.

## File ownership, so two windows do not collide

| Owned by Stage | Owned by the platform |
|---|---|
| `apps/stage/**` | `apps/web/**` |
| `packages/songs/**` | `packages/db/**` |
| `packages/stage-protocol/**` | `packages/i18n/src/**` catalogue entries for web screens |
| `packages/song-import/**` | `PRD.md`, `BACKLOG.md`, `ROADMAP.md` |
| `packages/stage-store/**` | |
| `apps/stage/**` | |
| `PRD.md`, `BACKLOG.md` | `docs/architecture.md`, `docs/data-model.md`, `docs/design-system.md` |
| `docs/architecture.md`, `docs/hearth-sync-contract.md`, `docs/journeys.md` | |

Shared, and touched with care: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`,
`packages/ui/**` (read by Stage, changed by the platform), `packages/i18n` catalogue (Stage adds its
own namespace rather than editing web keys).

`packages/songs` and `packages/song-import` are owned here because Stage builds them first and is their
only consumer until the platform's song library screens (0.4) and importers (R20.10) arrive. The schema
in [the platform PRD, section 9.4](https://github.com/boluwaji11/ChurchManagement/blob/main/PRD.md) is the contract between the two, and a change to it is a platform story.

---

## SE1. The slide (S0.1)

A presenter a worship leader can type four songs into and run. No platform dependency. Exit criteria in
[PRD.md section 5](PRD.md).

**Order corrected, 1 October 2026.** This epic originally put the song entry stories (STG-7 to
STG-10) ahead of the Electron shell (STG-11 to STG-15). Typing a song in needs a screen to type it
on, so the shell comes first. The stories themselves are unchanged, and the shared domain still
comes before everything, because the deck compiler is what a window renders.

### SF0. The shared song domain

| ID | Story | Req | State |
|---|---|---|---|
| STG-1 | Scaffold `packages/songs` with the song, section, arrangement and usage types from the platform PRD section 9.4, and no runtime dependencies | ST2.1 | Resolved |
| STG-2 | Resolve an arrangement sequence into an ordered list of sections, failing loudly on a missing label | ST5.2 | Resolved |
| STG-3 | Split a section into slides on the theme's line limit, breaking between lines | ST6.1 | Resolved |
| STG-4 | Compile a set list into a deck of cue groups, deterministically, with golden fixtures | ST5.1, ST5.4 | Resolved |
| STG-5 | Parse ChordPro and transpose to any key, verified against the fifty-chart fixture set | ST2.6, ST11.3 | Resolved |

### SF2. Presentations and the library, first pass

**Reordered after the parity inventory, 1 October 2026.** STG-145 comes first in
this feature, ahead of the song stories, because typing a slide is the first
thing a person does with Stage and until now there was no way to do it. See
[docs/parity.md](docs/parity.md).

| ID | Story | Req | State |
|---|---|---|---|
| STG-145 | **Type a presentation of plain slides and present it**: a title, three notices, a sermon outline | ST2.16 | New |
| STG-146 | Hold a presentation's kind, so a song, a reading, plain slides and a media item are one list | ST2.16 | New |
| STG-147 | Edit, reorder and delete the slides in a presentation | ST2.16 | New |
| STG-148 | Apply a theme to a presentation, and change it without touching the content | ST8.1 | New |
| STG-149 | First run: one line saying what to do, and three ways in | ST1.2 | New |
| STG-6 | Build the local library store: songs, sections, arrangements, durable and backed up on write | ST2.1, ST19.5 | Resolved |
| STG-7 | Type a song in: title, the copyright fields, and lyrics as labelled sections | ST2.1, ST2.2 | New |
| STG-8 | Offer a section split when a plain lyric block is pasted, confirmed by the operator | ST2.2 | New |
| STG-9 | Create arrangements with a key, a tempo and a sequence, one of them default | ST2.3 | New |
| STG-10 | Ship a public-domain sample song set, and offer it on first run | ST1.2 | New |

### SF1. The Electron shell

| ID | Story | Req | State |
|---|---|---|---|
| STG-11 | Scaffold `apps/stage`: Electron, sandboxed renderers, context isolation, CSP, a preload channel allowlist | ST21.8 | Resolved |
| STG-12 | Define `packages/stage-protocol`: `OutputState` down, intents up, typed both ways | ST19.1 | Resolved |
| STG-13 | Wire `packages/i18n` into Stage with its own namespace, and a test that fails the build on copy written inline | ST17.4, ST21.9 | New |
| STG-14 | Open Stage with no sign-in, reaching a usable library in under a minute, and name the device after the machine | ST1.1, ST1.9 | New |
| STG-15 | Open an output window fullscreen on a display chosen by identity, with the cursor hidden and the display kept awake | ST10.1, ST10.2 | Resolved |

### SF6. Lyric rendering

| ID | Story | Req | State |
|---|---|---|---|
| STG-16 | Define a theme as data, and ship one built-in theme good enough to use unmodified | ST8.1, ST8.2 | Resolved |
| STG-17 | Render a lyric slide inside the theme's safe area, with the section label available to the theme | ST6.1, ST6.3 | Resolved |
| STG-18 | Fit text by measurement, one size per section, cached by text, theme and resolution | ST6.2 | Resolved |
| STG-19 | Cross-dissolve between slides on two GPU layers, with no flash of background | ST6.5 | Resolved |
| STG-20 | Render solid and gradient backgrounds from the theme | ST9.1 | Resolved |

### SF12. Live operation

| ID | Story | Req | State |
|---|---|---|---|
| STG-21 | Build the control surface: live slide, next slide, the deck, keyboard only | ST12.1, ST12.2 | New |
| STG-22 | Make black, clear and logo each one keypress, restoring the exact slide | ST6.6 | New |
| STG-23 | Make advance idempotent under key repeat | ST12.4 | New |
| STG-24 | Reorder, skip and repeat a cue for this run, leaving the set list untouched | ST5.7 | New |
| STG-25 | Keep the library, import and theme editing out of the live surface | ST12.3, ST2.15 | New |
| STG-26 | Present a song, a scripture and a countdown with no set list open | ST5.10 | New |
| STG-27 | Write the operator brief: one screen saying what the four keys do | ST12.10 | New |

### SF21. The measurements

| ID | Story | Req | State |
|---|---|---|---|
| STG-28 | Build the render harness: rasterise every slide in the fixture library at three resolutions, assert safe area and 7:1 contrast | ST6.4, ST20.4 | New |
| STG-29 | Measure advance latency by frame capture and record it per release, on reference hardware | ST21.1, ST21.5 | New |
| STG-30 | Audit the control surface to WCAG 2.2 AA in CI, the same bar as the platform | ST20.1, ST20.2 | New |
| STG-31 | Add the architecture test that fails the build if the render path can reach the network | ST21.8 | Resolved |

---

## SE2. The library (S0.2)

The release a church with a 300 song ProPresenter library can actually adopt. No platform dependency.

### SF3. Import and migration

| ID | Story | Req | State |
|---|---|---|---|
| STG-32 | Scaffold `packages/song-import`: one reader interface, the Hearth schema as output, golden fixtures per format | ST3.9 | New |
| STG-33 | Read OpenLyrics and OpenSong libraries | ST3.1, ST3.2 | New |
| STG-34 | Read an OpenLP database | ST3.1, ST3.2 | New |
| STG-35 | Read a ProPresenter 6 and 7 library, keeping section labels | ST3.1, ST3.2 | New |
| STG-36 | Read an EasyWorship database | ST3.1, ST3.2 | New |
| STG-37 | Import a plain text or ChordPro file as one song, and a folder as many | ST3.7 | New |
| STG-38 | Run an import as a dry run with a report before it writes | ST3.3 | New |
| STG-39 | Handle duplicates on CCLI number, then title and first line, with skip, replace or keep both | ST3.5 | New |
| STG-40 | Make an import reversible for thirty days | ST3.4 | New |
| STG-41 | Match imported media on disk, and list what is missing | ST3.6 | New |

### SF2. The library, in full

| ID | Story | Req | State |
|---|---|---|---|
| STG-42 | Search the library across title, author, lyrics, themes and CCLI number, under 100ms at 2,000 songs | ST2.4, ST21.10 | New |
| STG-43 | Edit and archive a song, keeping its usage history | ST2.5 | New |
| STG-44 | Hold a ChordPro chart per arrangement, transposable, and show it | ST2.6 | New |
| STG-45 | Attach reference audio and practice tracks to an arrangement | ST2.7 | New |
| STG-46 | **Build a set list**: named, dated, ordered songs, scripture and markers | ST2.8 | New |
| STG-47 | Duplicate a set list from a previous week, carrying structure | ST2.9 | New |
| STG-48 | Choose a set list at launch, defaulting to the next one by date | ST12.5 | New |
| STG-49 | Add a song to the live deck from the library by typing, in under five seconds | ST5.8 | New |
| STG-50 | Jump to a cue by typing its label, and skip or repeat | ST5.9 | New |
| STG-51 | Correct a typo on a live slide, offering the fix to the library for a local song | ST6.8 | New |
| STG-52 | **Log usage when a song is actually shown**, with date, set list, arrangement and key | ST2.10, ST18.7 | New |
| STG-53 | **Export a CCLI usage report** for a period, validated against the same fixture as the platform's R12.10 | ST2.11, ST18.7 | New |
| STG-54 | Export the whole library as OpenLyrics and as a Hearth-schema bundle, ungated | ST2.12 | New |
| STG-150 | Collections in the library, so two hundred presentations are findable | ST2.18 | New |
| STG-151 | **A media library**: images, video and audio added once and reusable anywhere | ST9.10 | New |
| STG-152 | Reference media by content hash, so reorganising folders does not break last year's playlists | ST9.11 | New |
| STG-153 | Pick media from the library when building a playlist or a theme | ST9.10 | New |
| STG-154 | A playlist item that is media, a header or a timer, as well as a presentation | ST2.17 | New |
| STG-155 | A note on a slide, shown to the operator and the stage display | ST2.19 | New |

### SF7. Scripture

| ID | Story | Req | State |
|---|---|---|---|
| STG-55 | Bundle KJV, ASV and WEB, held locally and searchable | ST7.1 | New |
| STG-56 | Parse a reference the way a human types it, and resolve it from a bundled translation | ST7.2 | New |
| STG-57 | Split a passage at verse boundaries, with the reference on every slide | ST7.3, ST7.4 | New |
| STG-58 | Type a passage in by hand, for a translation we cannot ship, and say why in the place a church looks for the NIV | ST7.5, ST7.8 | New |

---

## SE3. The room (S0.3)

What makes Stage a church's only presenter. No platform dependency. Exit criteria: four consecutive
Sundays with ProPresenter uninstalled.

### SF11. Stage display

| ID | Story | Req | State |
|---|---|---|---|
| STG-59 | Build the stage display: current slide, next slide, clock, timer, legible from twenty feet | ST11.1 | New |
| STG-60 | Show the section label and the remaining sequence | ST11.2 | New |
| STG-61 | Show chords over lyrics, transposed by the same code the printed chart uses | ST11.3 | New |
| STG-62 | Ship three stage display presets: band, preacher, host | ST11.4 | New |

### SF10. Outputs

| ID | Story | Req | State |
|---|---|---|---|
| STG-63 | Drive several outputs with independent content per output | ST10.3, ST11.5 | New |
| STG-64 | Keep output configuration across a display unplugged, replugged, and a restart | ST10.4, ST10.5 | New |
| STG-65 | Handle resolution, scaling and aspect explicitly, with letterboxing by choice | ST10.6 | New |
| STG-66 | Add a test pattern per output showing safe areas, resolution and a contrast ramp | ST10.7 | New |

### SF9. Backgrounds

| ID | Story | Req | State |
|---|---|---|---|
| STG-67 | Show a still image background, scaled and cropped without distortion | ST9.2 | New |
| STG-68 | Play a seamless hardware-decoded video loop with text composited over it | ST9.3 | New |
| STG-69 | Bundle a small set of loops that look like a church room, licensed for redistribution | ST9.4 | New |
| STG-70 | Resolve background assignment by precedence: theme, then item, then slide | ST9.5 | New |
| STG-71 | Fail a missing or undecodable media file to the theme colour, saying so on the control surface | ST9.9 | New |
| STG-72 | Override size, alignment and background on one slide, for this run only | ST6.7 | New |

### SF13. Timers and loops

| ID | Story | Req | State |
|---|---|---|---|
| STG-73 | Count down to a time of day, anchored to the clock so a restart resumes correctly | ST13.1, ST13.7 | New |
| STG-74 | Count down a duration, and output a clock | ST13.2, ST13.3 | New |
| STG-75 | Run an announcement loop of rotating slides on any output, while the main output does something else | ST13.4 | New |

### SF19. Recovery

| ID | Story | Req | State |
|---|---|---|---|
| STG-76 | Persist the live cue pointer on every change and recover to it in under five seconds | ST19.1, ST19.2 | New |
| STG-77 | Restart a crashed output renderer without touching the other outputs | ST19.3 | New |
| STG-78 | Back up the library on every write, with a restore inside Stage | ST19.5 | New |
| STG-79 | Write a diagnostic log the operator can send, scrubbed of lyrics, names and any token | ST19.9 | New |

### SF8, SF12. The rest of the room

| ID | Story | Req | State |
|---|---|---|---|
| STG-80 | Hold separate themes per content kind: lyrics, scripture, announcement, title | ST8.3 | New |
| STG-81 | Preview a theme at the real output resolution | ST8.4 | New |
| STG-82 | Show two translations of one passage side by side | ST7.7 | New |
| STG-83 | Show the operator what is live, what is next, whether output is black, and the time, at all times | ST12.6 | New |
| STG-84 | Confirm anything that interrupts the service, with a key that is not the advance key | ST12.7 | New |
| STG-85 | Respect the operating system's reduced motion setting on the control surface | ST20.5 | New |
| STG-86 | Soak test three hours with video backgrounds, asserting no memory growth | ST21.6, ST21.7 | New |
| STG-87 | Measure cold start to the first slide, under ten seconds on reference hardware | ST21.2 | New |
| STG-156 | **Clear one layer at a time**: the words come off and the background stays | ST10.9 | New |
| STG-157 | A transition set per slide as well as per theme | ST12.12 | New |
| STG-159 | **Messages**: live text over whatever is on screen, with named fields | ST12.11 | New |
| STG-160 | **A look per output**: which of background, media, slide, props and foreground is on | ST10.10 | New |
| STG-161 | Assign a look to each output, and see at a glance what each one is showing | ST10.10 | New |
| STG-162 | Build the layer stack in the output renderer, composited rather than swapped | ST10.10 | New |

---

## SE4. The plan (S0.4)

**The loop.** The only epic that needs the platform. Blocked until platform 0.4 ships the song library
and the sync API, and pulled forward the moment it does. The dependency table below names what is owed.

### SF1. Pairing

| ID | Story | Req | State |
|---|---|---|---|
| STG-88 | Pair with a six character code, and store the token in the keychain | ST1.3 to ST1.5 | New |
| STG-89 | Show the device in the platform's device list, named and revocable | ST1.6, ST1.9 | New |
| STG-90 | Unpair or handle revocation by removing `hearth` records and keeping every local one | ST1.7 | New |

### SF4. Sync

| ID | Story | Req | State |
|---|---|---|---|
| STG-91 | Build the synced store, separate and disposable, beside the local library | ST4.3 | New |
| STG-92 | Sync by cursor, one transaction per page writing rows and advancing the cursor together | ST4.1, ST4.2 | New |
| STG-93 | Mark song origin, make `hearth` songs read-only in Stage, and show which is which | ST2.13, ST4.4 | New |
| STG-94 | Run sync on a worker thread, and prove it cannot delay a cue advance | ST4.7 | New |
| STG-95 | Fetch media by content hash, resumable and verified | ST4.9 | New |
| STG-96 | Show the last successful sync, and say when the plan on screen is older than the server's | ST4.8 | New |
| STG-97 | Prefetch seven days of services, so Sunday needs no network | ST4.10 | New |
| STG-98 | Promote a local song into the church library on request, with a duplicate check first | ST2.14, ST4.11 | New |

### SF5. The plan as a deck

| ID | Story | Req | State |
|---|---|---|---|
| STG-99 | Open a Hearth plan as a deck, in the order it was planned | ST5.3 | New |
| STG-100 | Show plan notes, global and addressed to a position, on the control surface and the stage display | ST5.5, ST11.6 | New |
| STG-101 | Render scripture from the platform's resolved text, under the church's own licence | ST7.6 | New |
| STG-102 | Build the announcement loop from the church's announcements and plan items | ST13.5 | New |
| STG-103 | Offer an updated plan as a dismissible offer that never rewrites the live deck | ST5.11 | New |
| STG-104 | Sync themes from the platform, so every laptop matches | ST8.5 | New |

### SF18, SF19. Reporting and the failure case

| ID | Story | Req | State |
|---|---|---|---|
| STG-105 | Push usage rows idempotently, including a song added live and absent from the plan | ST18.1, ST18.3, ST18.4 | New |
| STG-106 | Build the fault injection suite: no network, held-open connections, 500s, a revoked token, an invalid cursor, a corrupt cache | ST4.7, ST19.4, ST19.6 | New |
| STG-107 | Run a full cached service with the wifi password changed and the token revoked, every release | ST19.6 | New |

---

## SE5. The team (S0.5)

Everything that happens once more than one person is involved. **STG-125 needs a paired platform.** The rest does not.

### SF14. Remote control

| ID | Story | Req | State |
|---|---|---|---|
| STG-108 | Serve the remote on the local network, paired by a code shown on the control surface | ST14.1, ST14.2 | New |
| STG-109 | Advance, reverse, black and jump from the remote, showing the deck and the notes | ST14.3, ST14.5 | New |
| STG-110 | Keep two controllers and the laptop consistent within 300ms | ST14.4, ST14.6 | New |

### SF15. Triggers

| ID | Story | Req | State |
|---|---|---|---|
| STG-111 | Customise hotkeys, and print the defaults on one card | ST12.8 | New |
| STG-112 | Fire several actions from one trigger as a macro | ST12.9 | New |
| STG-113 | Support a Stream Deck with cue, black and macro buttons | ST15.1 | New |
| STG-114 | Accept and emit MIDI | ST15.2 | New |
| STG-115 | Accept and emit OSC, with every address documented | ST15.3 | New |
| STG-116 | Emit an outbound trigger on cue change, so a lighting desk can follow | ST15.4 | New |
| STG-117 | Keep every integration off by default, and prove none can block a cue | ST15.6 | New |

### SF9, SF11, SF16. The rest

| ID | Story | Req | State |
|---|---|---|---|
| STG-118 | Play audio and video as items, with in and out points and an end behaviour | ST9.6, ST9.7 | New |
| STG-119 | Show a lower third or prop region independently of the main slide | ST16.4 | New |
| STG-120 | Address a named group of outputs together | ST10.8 | New |
| STG-121 | Send a message to the stage display from the control surface or the remote | ST11.7 | New |
| STG-122 | Run a timer against an item's planned duration | ST11.8 | New |
| STG-123 | Mix stills, video and slides in one announcement rotation | ST13.6 | New |
| STG-124 | Snapshot the run as it happened, so the second service reopens it | ST5.12 | New |
| STG-125 | Push run telemetry to a paired platform for the plan's revision history | ST18.5 | New |
| STG-158 | Text revealed a line at a time, and nothing more elaborate than that | ST12.13 | New |
| STG-163 | A named look applied to every output at once, so "pre-service" is one keypress | ST10.11 | New |

---

## SE6. The broadcast and the launch (S1.0)

Public launch of Stage.

### SF16. Broadcast

**STG-141 and STG-144 need a paired platform.** The rest of SE6 does not.

| ID | Story | Req | State |
|---|---|---|---|
| STG-126 | Output NDI per output group, degrading to no NDI when it cannot initialise | ST16.1, ST16.5 | New |
| STG-127 | Output alpha-keyed lyrics with clean antialiased edges | ST16.2 | New |
| STG-128 | Give the keyed output its own theme, sized for camera | ST16.3 | New |

### SF17. Language

| ID | Story | Req | State |
|---|---|---|---|
| STG-129 | Render bilingual slides from section-aligned translations | ST17.1, ST6.9 | New |
| STG-130 | Carry a different language on a second output | ST17.2 | New |
| STG-131 | Stream caption output for the livestream's caption track | ST17.3, ST7.9, ST20.6 | New |
| STG-132 | Support right-to-left text and a font fallback chain | ST6.10 | New |

### SF8. Themes, properly

| ID | Story | Req | State |
|---|---|---|---|
| STG-133 | Edit a theme in Stage, with a contrast check that refuses a lyric theme below 7:1 | ST8.6 | New |
| STG-134 | Save a theme, background and overlay together as a named template | ST8.7 | New |
| STG-135 | Import a font the church owns, stating the licence responsibility at import | ST8.8 | New |
| STG-136 | Use a live camera as a background layer, with a frozen fallback | ST9.8 | New |

### SF19, SF3. Shipping and the last of the move

| ID | Story | Req | State |
|---|---|---|---|
| STG-137 | Import a PowerPoint or Keynote deck as an item of ordered slides | ST3.8 | New |
| STG-138 | Sign and notarise macOS, sign Windows, build AppImage and deb | ST19.10, ST21.11 | New |
| STG-139 | Auto-update in the background, applied by the operator, held outside the Sunday window | ST19.7 | New |
| STG-140 | Roll back to the previous version from inside Stage | ST19.8 | New |
| STG-141 | Export the library and cache as a portable bundle for a church with no usable wifi | ST4.13 | New |
| STG-142 | Serve a view-only remote for the preacher and the host | ST14.7 | New |
| STG-143 | Document the local HTTP control API | ST15.5 | New |
| STG-144 | Pair a device to one campus, and sync only that campus's services | ST1.10 | New |

---

## What the platform owes Stage

Specified in full in [docs/hearth-sync-contract.md](docs/hearth-sync-contract.md). These become stories
on the **platform** board with `HRT-n` IDs when platform 0.4 is planned. **SE4 is blocked until all six
land. SE1, SE2, SE3 and most of SE5 are not.**

| Owed | Platform requirement | Note |
|---|---|---|
| The song schema: sections ordered and labelled, sequences as data, translations section aligned | R12.1 to R12.7, R12.9 | the platform PRD section 9.4. Stage uses it locally from STG-1, so a real renderer exercises it before the platform's own screens exist. |
| Service plans readable as data: ordered items, arrangement and key, resolved scripture text, notes per position | R11.1 to R11.6, R11.14 | |
| `change_seq` on every synced table, from a per-tenant sequence | R11.14 | Set by the trigger that already writes the audit entry |
| The device principal: table, token hashing, scope enforced in the query layer, pairing code UI, device list with revoke | R11.14, R1.5, R1.10 | Sits beside the active session list, which exists |
| The routes under `/api/stage/v1`, including the song promotion endpoint | R11.14, R12.13 | |
| Idempotent `song_usage` insert keyed on the client id, feeding the CCLI export | R12.9, R12.10 | Stage's local export (STG-53) is validated against the same fixture, so the two agree |

One correction is owed in the other direction: **the platform PRD section 9.6** says Stage is "a client of a
versioned sync API, not a second application with a second database", which draft 2 contradicts. PRD.md
belongs to the platform board, so that line is corrected there.

---

## Execution plan

### The order, and why

**SE1 first, and it is a real presenter.** By the end of SE1 a worship leader types four songs in and
runs the set on a projector. That is judgeable, and it is judgeable without a Hearth account, which is
the point of draft 2. Inside SE1 the order is forced: `packages/songs` before anything compiles a deck,
the library before there is a song to compile, the deck before there is anything to render, the render
before the control surface has something to control, and the measurement harness alongside the render,
because a latency budget written afterwards is a wish.

**SE2 is the adoption release.** A presenter that cannot read a church's existing library has no users,
so the five importers come before the stage display, before video backgrounds, and before sync. SE2
also carries the local CCLI export, which is a genuine reason to choose Stage over OpenLP on its own.

**SE3 before SE4.** A church leaves ProPresenter when it has the stage display, several outputs, video
backgrounds, and crash recovery. Pairing with Hearth is what makes it stay.

**SE4 when the platform is ready, and no earlier.** It is the differentiator and the reason Hearth owns
a presenter, and it is also the one epic whose dependency we do not control. Fifty-eight stories sit in
front of it, which is long enough that the platform will have shipped 0.4 before Stage is waiting.

**SE5 then SE6**, because remotes, Stream Decks, NDI and three signed installers all matter once
churches are arriving.

### Working method

Unchanged from [CLAUDE.md](CLAUDE.md). One story Active on this board. Built, then what to test is
written down plainly, then stop. The next story does not start until the last one has been used by hand.

### What is no longer true

Draft 1 said S0.2 was blocked on platform 0.4 and that Stage held a cache rather than a library. Both
are gone. The only blocked epic is SE4, and nothing before it waits on anybody.

---

## Now

| | |
|---|---|
| **Active** | Nothing |
| **Waiting on a test** | **STG-1** to **STG-6** the domain and the library, **STG-11** to **STG-20** and **STG-31** the application and its typography. `pnpm --filter @hearth/stage dev` opens it. |
| **Next** | **STG-145**, typing a presentation of plain slides, which is the gap the parity inventory found and the first thing a person does with Stage. Then STG-146 to STG-149, then the measurements STG-28 and STG-29. |
| **Parity** | [docs/parity.md](docs/parity.md) is the inventory against ProPresenter, EasyWorship, OpenLP and FreeShow. It added 18 stories and rewrote PRD domain 2 around presentations rather than songs. |
| **Repository** | Stage left the platform's repository on 1 October 2026 and is its own. `packages/songs` lives here, so the platform's 0.4 consumes it as a published package. |
| **Blocked** | **SE4** only, on the six platform deliverables above. Fifty-two stories sit in front of it. |
| **Branch** | Stage work is on the `stage` branch, in a git worktree at `../hearth-stage`, so the two windows no longer share a HEAD. Everything up to `da167d8` is on `main`. |
| **Watch** | `packages/songs` is read by the platform's song library screens in 0.4, and `packages/song-import` by its R20.10 importers. The schema in the platform PRD section 9.4 is the contract, and a change to it is a platform story. |
| **Owed elsewhere** | The the platform PRD section 9.6 correction, on the platform board. |

---

## STG-1, how to test it

`packages/songs` is the spine. It has no screen, so the test is the suite and the types.

```
pnpm --filter @hearth/songs test
pnpm --filter @hearth/songs typecheck
```

Thirty-three tests, three files. What each one is defending:

1. **Lyrics cannot become a blob.** `validate.test.ts` refuses a section whose single line holds
   newlines, which is how a "good enough" song list passes a type check today and costs a rewrite in
   Phase 2. It names the line it found. This is the R12.4 guard, and it is the most valuable test in
   the package.
2. **A sequence has to resolve.** An arrangement sequencing `V1 C B` against a song that has only
   `V1` reports two problems by name, at validation time, rather than leaving two holes in the
   service. The R12.5 acceptance criterion.
3. **A repeat is allowed.** `Holy, Holy, Holy` sequences `V1 V2 V1` and validates clean, because the
   deck compiler has to turn that into three cues (STG-4).
4. **Translations are aligned.** `Amazing Grace` carries a public-domain Spanish first verse pointing
   at the English one. A translation of a translation, a translation in the same language as its
   primary, and a translation pointing at nothing are each refused, so a bilingual slide cannot
   render one language twice.
5. **Keys are read the way they are written.** `bb`, `f#`, `E♭`, `A minor` and `a min` all parse.
   `H`, `Gbb` and `key of G` return null rather than a guess, because a guessed key transposes a
   whole set wrongly and nobody finds out until the band is playing. `C#` and `Db` share a pitch
   class, which is what transposition will depend on in STG-5.
6. **Errors and warnings are different things.** A bad time signature, an unparseable CCLI number and
   an implausible year are warnings, so a library imported from somewhere else still presents. A
   missing title or an unresolvable sequence is an error.
7. **The package depends on nothing.** `no-dependencies.test.ts` fails the build if `package.json`
   grows a dependency, if any source file imports anything outside its own directory, or if a
   database, framework or store is referenced. Stated as a test because a README does not fail a
   build.

Worth reading rather than running: `src/types.ts` is the schema from the platform PRD section 9.4 written out, and
it is the one file where being wrong is expensive. Two things in it are decisions rather than
transcription, and both are open to being overruled now while nothing depends on them.

- **`tenantId` is absent.** The platform holds these records with a tenant and row-level security,
  and Stage holds them with no tenant at all, so tenancy belongs to each store rather than to the
  shared type.
- **`origin` is present**, `local` or `hearth`, carrying the two-writer rule from PRD section 2
  into the type itself.

The sample library is two public-domain hymns. Stage offers them on first run so a church starting
cold has something to present, and the suite asserts every bundled song is public domain, because
Stage ships no copyrighted lyrics.

---

## STG-2, STG-3 and STG-4, how to test them

Three stories grouped, because separately none of them produces anything to look
at and together they produce the first thing that does.

```
pnpm --filter @hearth/songs deck
pnpm --filter @hearth/songs deck -- --lines 2
pnpm --filter @hearth/songs test
```

**`deck` prints a Sunday service, compiled.** Six items: a welcome, two hymns, a
reading, the sermon, and a closing reprise. Every slide on that screen came out
of the song records and the arrangement sequences with nobody typing a slide.
That is the claim the whole platform rests on, and it is now a thing that runs.

What to look at in the output:

1. **"Holy, Holy, Holy" sequences `V1 V2 V1`** and produces three cues, with the
   second V1 marked `(2 of 2)`. A presenter that collapsed the repeat would leave
   the service one slide behind the band.
2. **"Amazing Grace" reports the key of Bb**, although its arrangement is in G,
   because the leader set an override on the item for this Sunday. The reprise
   below it reports D, which is its own arrangement's key.
3. **The sermon and the welcome are in the deck**, saying "nothing on the
   screen". The operator's position in the deck matches the service's position
   in the room, which is what stops somebody losing their place during the
   notices.
4. **Psalm 23 breaks at verse boundaries**, four verses then two, and carries
   `Psalm 23:1-6` on both slides, because somebody arriving at the second slide
   still needs to know where they are.
5. **The note to Drums shows**, next to the note for everybody. A volunteer sees
   the global notes plus their own.
6. **`--lines 2` recompiles the whole service tighter.** Every section splits,
   and the cue count goes up. Worth running to see that a break always falls
   between two lines.

**`test` is 78 tests now**, 45 of them new. The ones defending something real:

- A sequence naming a label the song does not have is reported by name and
  position, and the sections that did resolve still present. One bad label does
  not take a whole song off the screen, and nobody finds out at 10:31.
- A song in the plan that is missing from the library is reported rather than
  skipped, so an operator knows before the service that one item will not show.
- **Five lines at a limit of four splits three and two**, rather than four and
  one. A single stranded line looks like a mistake on a wall.
- A blank line inside a section breaks there first, because a church that writes
  a stanza gap means it.
- **A cue id survives a recompile.** The same service compiled at a different
  line limit keeps the same id on the same section, which is what lets a crash
  recover to the live slide (ST19.1) even though the slide count changed.
- A bilingual section whose translation runs out renders the primary alone rather
  than against an empty half.

Nothing here is on a screen yet. The first pixel is STG-11 to STG-17: the
Electron shell, an output window on a chosen display, and this deck rendered as
slides. The compiler above is what it will render.

---

## STG-5, how to test it

```
pnpm --filter @hearth/songs chart
pnpm --filter @hearth/songs chart -- --key Bb
pnpm --filter @hearth/songs chart -- --song holy --key F
pnpm --filter @hearth/songs test
```

**`chart` prints a chord chart with the chords over the words.** The same
resolution the platform's printed chart will use and the same one Stage's
confidence monitor will use, because they are one function in one package. A
guitarist reading Bb while the keyboard reads B is audible to the whole room,
and this is what stops it.

What to check in the output:

1. **`--key Bb` gives Eb where a naive transposition gives D#.** Spelling follows
   the target key. A chart in
   Bb with a D# in it is read twice by every player who sees it. Ask for
   `--key A` instead and the same chart comes out with F# in it, because A is a
   sharp key.
2. **The slash chord moves both notes.** `D/F#` in G becomes `F/A` in Bb.
3. **The words do not move.** Only the chords and the `{key: ...}` directive
   change. Comments, section directives and spacing come back as the church
   wrote them, because a chart is a document somebody has edited.
4. **The chords sit over the right syllables.** `G` lands on "-mazing", not on
   "A". Where a chord is wider than the syllable under it, the words shift along
   so the next chord still lands on its own word rather than colliding.
5. **`--song holy --key F`** does the second hymn, which has a minor chord and a
   slash chord in it.

**The fixture set is 60 chord symbols across six key changes**, which is what
R12.6's "fifty charts" asks for in substance. It covers every quality a worship
chart uses, slash chords with natural and altered bass notes, both directions of
respelling between sharp and flat keys, and a no-op when the key does not
change. One test asserts no transposition anywhere in the corpus produces a
double accidental, which is the classic failure.

It is a corpus of symbols rather than fifty real charts on purpose: real charts
are copyrighted and Hearth ships none. The two public-domain hymn charts in the
fixtures are transposed whole as the document-level check.

Two bugs were found by writing the tests, both worth knowing about. Two adjacent
chords could run together as `Gmaj7C` when the first was wider than its
syllable. Fixing that revealed the second: separating them moved the chord off
its own word, so the words now shift along with it.

---

## STG-6, how to test it

```
pnpm --filter @hearth/stage-store library
pnpm --filter @hearth/stage-store library -- --keep
pnpm --filter @hearth/stage-store test
```

**`library` builds a real library on disk, destroys it, and brings it back.**
ST19.5 says the library is backed up on every write with a restore inside Stage,
because for a church that never pairs this file is the only copy of work
somebody typed in on a Tuesday evening. The script is that claim, run.

What it shows, in order:

1. **It opens and migrates**, 0 to 1, creating four tables.
2. **Two songs save**, and the list shows their authors, keys, section counts
   and CCLI numbers.
3. **A song whose lyrics are one string with newlines in it is refused**, naming
   `section.lines.containsNewline`. This is the R12.4 guard becoming binding
   rather than advisory: the validator from STG-1 now runs on every save, so a
   blob wearing an array cannot reach the disk, and therefore cannot reach
   Phase 2.
4. **A synced song is refused.** `library.db` holds what Stage owns. The
   two-writer rule from PRD section 2 is now a property of which file a
   row is in, rather than a check somebody has to remember.
5. **Archiving takes a song off the list and keeps the record.** The list shows
   one, the file still holds two.
6. **The library is deleted**, WAL files and all, then restored from the backup.
   Every section, every arrangement and the chord chart come back, the archived
   song comes back still archived, and the lyrics are still lines.

**37 tests.** The ones worth knowing about:

- A refused save leaves the previous version of the song exactly as it was. The
  transaction never opens.
- A section label is unique within a song at the database as well as in the
  validator, so a caller bypassing validation still cannot write it.
- `synchronous = FULL` on the library, asserted, because a power cut during a
  Sunday morning edit should cost the edit rather than the file. The synced cache
  will run `NORMAL`, since its worst case is a resync.
- A library written by a newer Stage is refused rather than downgraded, because
  a migration that silently dropped a column would lose a church's work.
- An interrupted migration leaves the database at the last step that finished.
- Restoring moves the file it replaces aside rather than deleting it. Somebody
  restoring a backup is already having a bad day.
- A backup that is not a readable library is refused before it is offered.

**One documented decision changed.** `docs/architecture.md` said Drizzle
would be the query layer against SQLite too. It is now prepared statements and a
hand written migrator, for the reasons set out in that file: four tables, data a
church cannot get back, and an interrupted upgrade that has to be provably safe.
Drizzle stays on the platform against Postgres. Say the word if you would rather
it were consistent across both.

---

## STG-11, STG-12 and STG-15, how to test them

**There is a window now.**

```
cd /Users/boluwaji.oyewumi/hearth-stage
pnpm --filter @hearth/stage dev
```

Two windows open. The **control surface** is the operator's, at office density:
the service and its date, the deck down the left with every cue in it, the live
slide and the next slide, the notes for the item that is live, and the six keys
along the bottom. The **output** is what a congregation sees. On a machine with
one screen it opens as a window so there is something to look at; plug in a
projector or a second display and it goes fullscreen on it, with no chrome and
no cursor.

Then use it without touching the trackpad:

1. **Space or the right arrow advances.** Watch the output cross-dissolve rather
   than cut. The live row in the deck moves and scrolls itself into view.
2. **Hold the advance key down.** It moves exactly one cue. Key repeat is
   ignored (ST12.4).
3. **B blacks the output.** Press it again and the exact slide comes back. The
   deck has not moved, and the chip at the top right says Black while it is on
   (ST6.6).
4. **C clears, L shows the logo panel, Escape comes back to the slide.**
5. **Advance while it is black.** The slide changes behind the cover, which is
   how an operator sets up the next one.
6. **Walk into the welcome and the sermon.** The output goes empty and the deck
   row says "Nothing on the screen", so the operator's place in the deck matches
   the service's place in the room (ST5.4).
7. **Reach Psalm 23.** The reference sits under the verses on both slides.
8. **Reach Amazing Grace.** The deck heading says the key of Bb, because the
   leader overrode the arrangement's G, and the notes pane shows both the note
   for everybody and the one addressed to Drums.
9. **Tab through the deck and press Enter.** Every cue is reachable without a
   pointer.
10. **Close the output window.** The control surface carries on and its chip
    list updates.

```
pnpm --filter @hearth/stage smoke
pnpm --filter @hearth/stage test
pnpm --filter @hearth/stage-protocol test
```

`smoke` launches the built application and fails if it exits early or writes an
error, which is the one check typecheck cannot do. The 23 session tests cover
what main does with an intent, with no window open at all, because main owns all
state and keeping Electron out of that class is what makes it testable.

**What is deliberately not here.** Text is sized by the theme against the
viewport rather than measured, so a long line does not yet reduce the slide and
share one size across a section. That is STG-18, and the slide it produces is
good enough to judge the rest against. Backgrounds are a solid colour. The
service is compiled from the public-domain fixtures rather than opened from the
library on disk, which is a one-line change once there is a screen to choose a
service on.

**Two things worth knowing.**

The preload bridge is the entire surface a window can reach: four named channels
and nothing further. Renderers run sandboxed, context isolated, with no node
integration, under a content security policy with no remote origins, and they
cannot open a window or navigate. Every intent is validated in main on arrival
rather than trusted, and the protocol tests include a prototype-polluting
payload. This matters now rather than later because STG-74 serves the same
intents to a phone on the church wifi.

The smoke test found a real defect within a minute of existing. `ELECTRON_RUN_AS_NODE`
is set by any editor that is itself an Electron application, which includes VS
Code, and inheriting it makes Electron start as plain Node and throw on the
first line of main. `pnpm dev` now strips it, so running Stage from an editor
terminal works.

---

## STG-16 to STG-20 and STG-31, how to test them

```
cd /Users/boluwaji.oyewumi/hearth-stage
pnpm --filter @hearth/stage dev        leave it running
pnpm --filter @hearth/stage test
```

**Text is measured now.** Previously the theme's size was applied blindly and a
long line ran off the screen. What to look for:

1. **Resize the output window narrow.** The words shrink to fit and stop at the
   safe area rather than touching the edge. Make it wide again and they grow
   back to the theme's size.
2. **A section split across two slides shares one size.** Run with `--lines 2`
   in the fixtures and the two halves of a verse are the same size, even when
   one half is much shorter. A size jump mid-section reads as a mistake to a
   congregation, which is why the renderer is handed every slide of the section
   it is painting rather than only the live one.
3. **The size is measured once.** Advancing within a section applies a cached
   number. Measuring is layout, and layout has no business between a keypress
   and a pixel.

**52 tests in the app.** The ones defending something real:

- Binary search rather than stepping, asserted at under fifteen measurements for
  a search from 200px. Stepping a pixel at a time would be 190 layouts a slide.
- The floor holds: text never shrinks below 4% of output height (ST20.4), even
  for an absurd line. Below that the words stop being readable from the back of
  the room, so the overflow becomes something for the render harness to report
  rather than something hidden by tiny text.
- A shared section size equals the smallest any of its slides could take.
- The cache measures again when the output resizes or the theme changes, and
  never otherwise, and it does not grow without limit.
- **The theme clears 7:1 against its own background and against black**, checked
  with the platform's own OKLCH contrast maths so Stage's output and the web
  app's screens are judged by one implementation.
- **STG-31**: the render path reaches for nothing on the network. `fetch`,
  `WebSocket`, `node:http`, a remote font, a CDN stylesheet, each fails the
  build. The CSP on both pages is asserted to carry no remote origin, renderers
  are asserted to hold no Electron import and no `ipcRenderer`, and main is
  asserted to validate every intent.

**One change to a platform file.** `packages/ui/package.json` gained one line:
`"./contrast": "./scripts/contrast.mjs"`, so Stage can use the design system's
existing contrast audit rather than reimplementing OKLCH maths. Additive, and
the platform window should know it is there.

**Still not measured:** advance latency against the 100ms budget (ST21.1) and
the render harness that rasterises every slide to assert the safe area and the
contrast on a real frame (ST20.4, ST6.4). Those are STG-29 and STG-28, and they
are next, because until they exist the typography and performance claims are
arguments rather than facts.
