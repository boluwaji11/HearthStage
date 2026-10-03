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
| **Epic** | A Stage release. Defined by what a church can do during a service with it. | `SE1` to `SE6` |
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
4. **Everything built has a story.**
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

A presenter somebody can type slides and songs into and run. No platform dependency. Exit criteria in
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
| STG-145 | **Type a presentation of plain slides and present it**: a title, three notices, a sermon outline | ST2.16 | Resolved |
| STG-146 | Hold a presentation's kind, so a song, a reading, plain slides and a media item are one list | ST2.16 | Resolved |
| STG-147 | Duplicating a slide, moving one between presentations, and the per-slide note | ST2.16, ST2.19 | Resolved |
| STG-148 | Apply a theme to a presentation, and change it without touching the content | ST8.1 | Resolved |
| STG-149 | First run: one line saying what to do, and three ways in | ST1.2 | Resolved |
| STG-168 | Name the application properly, so its data lives in "Hearth Stage" rather than in a folder named after a package, and move an existing library across | ST19.5 | Resolved |
| STG-6 | Build the local library store: songs, sections, arrangements, durable and backed up on write | ST2.1, ST19.5 | Resolved |
| STG-7 | Type a song in: title, the copyright fields, and lyrics as labelled sections | ST2.1, ST2.2 | Resolved |
| STG-8 | Offer a section split when a plain lyric block is pasted, confirmed by the operator | ST2.2 | Resolved |
| STG-9 | Orders on a song: named sequences of slide titles, one of them default. The key and the tempo an order can hold are deferred to STG-44, where something transposes | ST2.3 | Resolved |
| STG-10 | Ship a public-domain hymn set, and offer it rather than installing it. 183 hymns, built from the Open Hymnal Project by a script run by hand | ST1.2 | Resolved |

### SF1. The Electron shell

| ID | Story | Req | State |
|---|---|---|---|
| STG-11 | Scaffold `apps/stage`: Electron, sandboxed renderers, context isolation, CSP, a preload channel allowlist | ST21.8 | Resolved |
| STG-12 | Define `packages/stage-protocol`: `OutputState` down, intents up, typed both ways | ST19.1 | Resolved |
| STG-13 | `packages/stage-i18n`: every word Stage shows in one catalogue, typed keys, and a test that fails the build on copy written inline | ST17.4, ST21.9 | Resolved |
| STG-14 | Open Stage with no sign-in, reaching a usable library in under a minute, and name the device after the machine | ST1.1, ST1.9 | Resolved |
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
| STG-21 | Build the control surface: live slide, next slide, the deck, keyboard only | ST12.1, ST12.2 | Resolved |
| STG-22 | Make black, clear and logo each one keypress, restoring the exact slide. The logo is the church's own file, chosen in Settings | ST6.6 | Resolved |
| STG-23 | Make advance idempotent under key repeat, in the window and again in the session | ST12.4 | Resolved |
| STG-24 | Reorder, skip and repeat a cue for this run, leaving the set list untouched | ST5.7 | Resolved |
| STG-25 | Keep the library, import and theme editing out of the live surface, enforced by a test, and ask before replacing a running service | ST12.3, ST2.15 | Resolved |
| STG-26 | Present a song, a reading and a countdown with no service open | ST5.10 | Resolved |
| STG-27 | Write the operator brief: one card saying what every shortcut does, driven by the same table the keys are | ST12.10 | Resolved |

### SF21. The measurements

| ID | Story | Req | State |
|---|---|---|---|
| STG-28 | Build the render harness: lay out every slide in the bundled library at three resolutions, assert the safe area and the cap height floor | ST6.4, ST20.4 | Resolved |
| STG-29 | Measure advance latency by frame capture and record it per release. The run on reference hardware is still owed | ST21.1, ST21.5 | Resolved |
| STG-30 | Audit the control surface to WCAG 2.2 AA in CI, the same bar as the platform | ST20.1, ST20.2 | Resolved |
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
| STG-171 | **Bring a church's own songs in from the service it already uses**: Planning Center Online first, then WorshipPlanning. OAuth the church grants, words and arrangements, matched on CCLI number | ST3.8 | New |
| STG-173 | **CCLI SongSelect**, under a partner agreement with CCLI: search a church's licensed catalogue and bring a song in with its words, author and number | ST3.8 | Blocked |
| STG-172 | More public domain words: Hymnary and the OpenLyrics public collections, on the same converter STG-10 used | ST3.7 | New |

**On bringing words in over an API.** Three different things get called this.
Two are routes Stage should take and one it should not, and the difference is
not technical: it is who holds the right to put the words on a wall.

- **The church's own library, through their own account (STG-171).** Planning
  Center Online and WorshipPlanning both expose songs with their words and
  arrangements, authenticated per organisation. This is a church's own data,
  which it already holds the rights to, moving from a tool it pays for into one
  it does not. It is the fastest real answer and the one most target churches
  can use on day one, because the 50 to 500 church leaving a paid planner is
  exactly who Stage is for. Match on CCLI number first, then title and first
  line, the same rule STG-39 uses.
- **CCLI SongSelect (STG-173).** The canonical source, and the church is already
  paying CCLI for the right to project these words. Reaching it needs a partner
  agreement, which is how every paid presenter does it. That is a conversation
  before it is a commit, so the story is Blocked and the thing blocking it is
  not code.
- **A public lyrics database.** Refused. The right a presenter needs is public
  display to a congregation, and a lyrics site does not hold that right, so it
  cannot pass it on. Buying a dump does not help: the one such offer checked
  sells 115,338 lyrics for $129, states no provenance, and publishes no licence
  terms. Shipping any of this would make Hearth the distributor, across every
  church at once, of words it has no right to. Stage is the thing a church puts
  on a wall in front of two hundred people.

**OpenSong's API is not one of these.** It is a local remote-control interface
the OpenSong application exposes on port 8082, for driving a running copy and
reading the library on that same machine. As an import route it is worse than
reading the files on disk, which is **STG-33** and needs nothing running. It is
useful prior art for Stage's own remote (**STG-108**, **STG-109**), and that is
where the link belongs.

Two more routes carry no licensing question at all, and both are already on the
board: what the church owns on disk (**STG-32** to **STG-41**, a ProPresenter
folder a church leaving already has) and the public domain (**STG-10**, 183
hymns in, **STG-172** for the rest).

### SF2. The library, in full

| ID | Story | Req | State |
|---|---|---|---|
| STG-42 | Search the library across title, author, lyrics, themes and CCLI number, under 100ms at 2,000 songs | ST2.4, ST21.10 | New |
| STG-43 | Edit and archive a song, keeping its usage history | ST2.5 | New |
| STG-44 | Hold a ChordPro chart per order, transposable, and show it. Carries the key and the tempo fields STG-9 left off the screen | ST2.6 | New |
| STG-45 | Attach reference audio and practice tracks to an arrangement | ST2.7 | New |
| STG-46 | **Build a service**: named, dated, ordered items and headings, pointing at the library rather than copying it | ST2.8 | Resolved |
| STG-47 | Duplicate a service from a previous week, carrying structure | ST2.9 | Resolved |
| STG-48 | Choose a set list at launch, defaulting to the next one by date | ST12.5 | Resolved |
| STG-49 | Add a song to the live deck from the library by typing, in under five seconds | ST5.8 | Resolved |
| STG-50 | Jump to a cue by typing its label, and skip or repeat | ST5.9 | Resolved |
| STG-51 | Correct a typo on a live slide, offering the fix to the library for a local song | ST6.8 | Resolved |
| STG-52 | **Log usage when a song is actually shown**, with date, set list, arrangement and key | ST2.10, ST18.7 | Resolved |
| STG-53 | **Export a CCLI usage report** for a period, validated against the same fixture as the platform's R12.10 | ST2.11, ST18.7 | Resolved |
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
services with ProPresenter uninstalled.

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
| STG-97 | Prefetch seven days of services, so a service needs no network | ST4.10 | New |
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
| STG-164 | Syphon output, for another application on the same Mac | ST16.1 | New |
| STG-165 | Name an output's role: lobby, overflow, stage, stream, so a look can be assigned by what it is for | ST10.10 | New |

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
| STG-139 | Auto-update in the background, applied by the operator, held outside a service window | ST19.7 | New |
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

**SE1 first, and it is a real presenter.** By the end of SE1 somebody types four songs in and
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
| **Waiting on a test** | **STG-1** to **STG-6** the domain and the library, **STG-11** to **STG-20** and **STG-31** the application and its typography, **STG-145** building a presentation, **STG-146** one library list, **STG-147** duplicating, copying and slide notes, **STG-148** the four looks, **STG-21** the live and next panes, **STG-149** first run, **STG-168** the application's name, **STG-7** typing a song in, **STG-8** the pasted block, **STG-9** orders on a song, **STG-10** the hymns on offer, **STG-13** the catalogue, **STG-14** no sign-in and the machine's name, **STG-22** the three covers and the church's logo, **STG-23** the key held down, **STG-24** the order this run goes in, **STG-25** what the live surface cannot do, **STG-26** the clock and the reading, **STG-27** the operator brief, **STG-28** the render harness, **STG-29** the latency measurement, **STG-46** building a service, **STG-47** using last week's again. `pnpm --filter @hearth/stage native` once, then `pnpm --filter @hearth/stage dev`. |
| **Next** | **STG-54**, exporting the whole library as OpenLyrics and as a Hearth bundle. Stories are built in the order this table lists them, and a skip is named with its reason before it starts. |
| **Parity** | [docs/parity.md](docs/parity.md) is the inventory against ProPresenter, EasyWorship, OpenLP and FreeShow. It added 18 stories and rewrote PRD domain 2 around presentations rather than songs. |
| **Repository** | Stage left the platform's repository on 1 October 2026 and is its own. `packages/songs` lives here, so the platform's 0.4 consumes it as a published package. |
| **Deferred past S1.0** | **STG-166** timecode, slides following a recorded track. **STG-167** several machines triggering each other. Both are real ProPresenter features and both belong to churches with a production team, which is not the target in section 4 of the PRD. |
| **Blocked** | **SE4** only, on the six platform deliverables above. Fifty-two stories sit in front of it. |
| **Native binding** | better-sqlite3 has one binding per install and Electron's module ABI differs from Node's, so the workspace keeps the Node one for the tests and `pnpm --filter @hearth/stage native` puts an Electron one in `apps/stage/native`. Run it after an install and after an Electron upgrade. |
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

**`deck` prints a service service, compiled.** Six items: a welcome, two hymns, a
reading, the sermon, and a closing reprise. Every slide on that screen came out
of the song records and the arrangement sequences with nobody typing a slide.
That is the claim the whole platform rests on, and it is now a thing that runs.

What to look at in the output:

1. **"Holy, Holy, Holy" sequences `V1 V2 V1`** and produces three cues, with the
   second V1 marked `(2 of 2)`. A presenter that collapsed the repeat would leave
   the service one slide behind the band.
2. **"Amazing Grace" reports the key of Bb**, although its arrangement is in G,
   because the leader set an override on the item for the next service. The reprise
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
R12.6's "fifty charts" asks for in substance. It covers every quality a chord
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
  a service edit should cost the edit rather than the file. The synced cache
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

---

## STG-145, how to test it

The gap the parity inventory found: J1 step 4 was impossible, because a person could not type a
slide. Only a song. A presentation is now the central object and a song is one kind of it.

```
pnpm --filter @hearth/songs slides
pnpm --filter @hearth/stage native
pnpm --filter @hearth/stage dev
```

In the window:

- Press **Slides** in the top right of the control surface. A second window opens.
- Press **New** and type a title. It stores itself, and the library on the left gets the row.
- Press **Add slide**. A box appears, already focused. Type into it. **Cmd and Return** adds the next
  one without reaching for the mouse.
- Each box has **Up**, **Down** and **Remove**. Removing one offers **Undo** in the footer.
- Backspace in an empty box takes the box away.
- **Slide title** on a box, something like `Point 2`, shows in the deck list during the service and
  stays off the wall.
- There is no save button. The footer says `3 slides · saved`. Close the window mid sentence, reopen
  it, and the words are there.
- Press **Present**. The output window shows slide one. Back on the control surface, **space**
  advances and **B** blacks it.
- Paste a sermon outline with gaps in it into an empty box and it becomes one slide per paragraph.
  Say the word and that goes.

**Sixty-six tests across the three packages.** What they defend:

1. **A slide exists because somebody added one.** A song is split by rule, because a church types
   lyrics as sections and the typography decides what fits. A typed slide ends where the person
   building it said it ends. A blank line inside a slide counts as whitespace. The line
   limit still applies, so a slide typed too long for the screen becomes two and keeps its label on
   both halves.
2. **An empty box is not a slide.** Pressing add puts a box on screen and nothing in the library
   until there are words in it, which is also what stops a stray box reaching the wall as a blank
   screen.
3. **A presentation is named before it is filled.** A title with no slides yet is a library row and a
   warning rather than a refusal. The place an empty one has to be caught is the deck, where it is
   reported by name before the service.
4. **Storing never overwrites typing.** State comes down whole, and the window replaces its boxes
   only when the serial changes, which happens when a different presentation is opened. A save comes
   back with the serial unchanged.
5. **The model splits the text, once.** The window sends a title and one box per slide. Splitting,
   numbering, trimming and dropping the empty ones happen in `slidesFrom`, so the screen, the store
   and the deck cannot each do it slightly differently. The R12.4 newline guard lives there.
6. **Each typed slide is sized on its own.** A title card is not shrunk to fit the four point
   outline that follows it, and the two halves of one slide that was split do share a size. The
   compiler names the grouping on the cue (`fitGroup`).
7. **A missing presentation is reported at compile time**, by name, the way a missing song is, and
   cue ids are stable across a recompile so a restart lands on the same slide.
8. **The editor is sandboxed like every other window.** No Electron import, no `ipcRenderer`, a CSP
   with no remote origin, and the slide array is bounded where it crosses the boundary.

**Two things that moved.** Presenting a presentation replaces whatever service is open, because set
lists are STG-146 and STG-147. And the save button is gone: the window stores itself when a box
loses focus, when a slide is added, removed or moved, and a second after typing stops.

---

## STG-146, how to test it

One list. A song and a set of typed slides are the same kind of thing to the person looking for one,
and two lists would mean knowing which one a thing is in before looking for it. Nobody knows that
about the notices.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides**. The left column now holds **Amazing Grace** and **Holy, Holy, Holy** beside
  anything you typed, each row tagged **Song** or **Slides** in its own hue.
- The **Search** box at the top filters across both. Type `grace`, then `notice`.
- Click a song. It opens as the sections it is made of, read only, and the footer says so. Typing a
  song in is STG-7, and a row that cannot be opened at all would be worse than this.
- Click back to a presentation. The boxes are yours again and **Add slide** comes back.
- A song row counts **sections**. A slides row counts **slides**.
- Archive is still the rule: nothing in this list can be deleted.

The two hymns arrive on their own the first time, and only into a library with nothing at all in it.
They are public domain. Offering the fuller sample set with a choice is still STG-10.

### The card controls, reworked

- Drag a slide by the **grip** on the left of its header. A line shows where it lands.
- **Up**, **down** and **remove** are icons now, each carrying its name for a screen reader and a
  tooltip for everyone else. Up and down stay because WCAG 2.2 requires a way round dragging for
  anybody who cannot drag.
- The label field is now **Slide title**. It shows in the deck list during the service, so the
  operator can find "Point 2" mid sermon, and it stays off the wall.

**Eleven new tests.** What they defend:

1. **One query, one order.** The list is sorted across both tables rather than two lists stitched
   together in the renderer, so paging stays in the right place once a library has two hundred rows.
2. **The count means what the row holds**: sections on a song, slides on a presentation.
3. **Archiving works on both halves** and an archived row leaves the one list.
4. **A song cannot be written through the slide editor.** Opening one and saving is refused at the
   boundary rather than written, because writing it would put a song and a presentation in the
   library under one id. This was a real defect the test found.
5. **Opening a presentation after a song replaces the boxes**, which is the serial doing its job.

---

## What testing found, 1 October 2026

Two defects, both from the same session, both fixed in the commit that names this section.

**Three problems on the control surface.** The sample service wanted the two bundled hymns and the
library did not have them, so every song item failed to compile. The seed from STG-146 only ran on a
library with nothing at all in it, and a church that had typed a set of slides first had a library
that was not empty and still had no songs. It now checks one song at a time, so a library missing a
bundled hymn gets it and an archived one stays away.

**A compile problem read like a log line.** `item.song.missing Holy, Holy, Holy` was in a tooltip on
a chip. Two things wrong with that: it is a code rather than a sentence, and it was reachable only by
pointing at something. Problems now read as sentences (`"Holy, Holy, Holy" is not in the library`) in
a strip under the header, visible from the moment the service is opened, which is the whole point of
finding them at compile time (ST5.2).

**One piece of copy.** The slide label field said "For the operator". It is now **Slide title**.

---

## STG-147, how to test it

Three things a person wants on the second evening: another slide like this one, that slide from last
week, and a note to whoever is running it.

```
pnpm --filter @hearth/stage dev
```

- Open a presentation and press **Slides**. Each card header now carries four icons. Hover for names.
- **Duplicate** puts a copy of the slide directly below it. **Cmd and D** inside a box does the same.
- **Copy** puts a slide on the clipboard. The footer says `a slide copied`, and a **Paste slide**
  button appears beside Add slide. Open a different presentation and press it: the slide lands at the
  end, words and title and note together.
- **Note** opens a one line box under the slide. Type `Hold here until the band comes in`. The box
  stays open while there is a note in it and folds away when the note is emptied.
- Press **Present**, then look at the control surface. The **Notes** pane shows the note against the
  slide that is live, tagged `this slide`, above any note on the item itself. Advance a slide and it
  goes.
- Nothing about the note reaches the output window.

**Six new tests**, all on the note, because the note is the part with a path through the model and
the other two live in the window. What they defend:

1. **A note belongs to a slide.** Separate from an item note, which belongs to the whole song or the
   whole reading. "Hold here until the band comes in" is about one slide, and an item note would put
   it against six.
2. **A note has no path to the wall.** Asserted by looking at everything the output window is handed
   and failing if the note is anywhere in it.
3. **A note follows both halves of a slide that was split for the screen**, for the same reason the
   title does: the operator is looking at either one.
4. **A note of spaces is no note**, trimmed in the model rather than stored as whitespace.
5. **It survives the round trip to disk**, in its own column, separate from the words.

**The clipboard lives in the window.** Switching presentations repaints this window without
reloading it, so a copy survives the trip, and closing the window loses it, which is what a person
expects of a clipboard. Duplicating and copying are checked by hand rather than by a test, because
testing a renderer needs the harness in STG-28.

---

## STG-148, how to test it

The look and the words are different things. Changing one has to be incapable of touching the other,
and the way to show that is to change the look and see that nothing moved.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides** and open a presentation. There is a **Look** picker beside the title.
- It offers **The service's look**, then **Hearth**, **Plain**, **Daylight** and **Strong**.
- Pick **Daylight**. The slide boxes turn to dark words on warm paper as you watch. Pick **Strong**:
  white on black, bigger and heavier.
- The words do not move, the titles stay, the notes stay. It saves on the spot.
- Press **Present**. The output window is in that look. Press **space** through the slides.
- Open a different presentation and give it a different look. Present each in turn: the output
  changes look as the service moves from one item to the other.
- Pick **The service's look** again and the presentation goes back to following the service.

### The four

| Name | For |
|---|---|
| Hearth | The default. A serif on ink, good enough to use at a service untouched (ST8.1). |
| Plain | Notices and a sermon outline, where a serif reads as a hymn board. |
| Daylight | Dark words on a light ground, for a lobby screen or an overflow room read in daylight. A dark slide in a lit room is a mirror. |
| Strong | A projector that has lost its contrast. Bigger, heavier, white on black. A church with a fifteen year old projector and no budget has this problem, and the answer every other product gives is to buy a projector. |

**Forty-two new tests.** What they defend:

1. **Every look clears 7:1 against its own background**, checked with the platform's own OKLCH
   contrast maths rather than by eye. The next person to add a theme will be choosing colours they
   like, so the floor is a test rather than a note.
2. **Every look clears the other floors too**: cap height at or above 4% of output height, weight at
   or above 400, a safe area because projectors clip edges, and a dissolve under 400ms.
3. **Changing a look touches no words.** Asserted by comparing every slide before and after, byte for
   byte.
4. **A look is resolved when a slide is painted** rather than stored on a cue, so restyling needs no
   recompile and can never rewrite a slide.
5. **A look this build does not have falls back to the default.** A library outlives a release and a
   synced theme can be missing, so the words go up in the wrong font rather than failing to go up.
   Writing such an id is refused, so a window with a stale list cannot store one.
6. **A save that does not mention the look leaves it alone**, which is what lets the editor save on
   every keystroke pause without touching the theme.

### What testing changed, 2 October 2026

**The key brief sat in the middle of the window.** The problems strip from the previous fix gave the
control surface four named grid rows and only three of them exist on a service that compiles
cleanly, so the deck took an `auto` row and the footer took the `1fr`. It is a flex column now, which
cannot be wrong about how many children there are.

**The looks were flat.** Four solid fills behind twelve words reads as a document rather than as a
slide, and on a nine foot screen that is the difference between church software and free church
software. STG-20 had already built gradient grounds and no theme used one. They do now: a warm glow
behind Hearth, a cool raked ground behind Plain, warm paper for Daylight, and Strong stays flat on
purpose because a gradient spends the contrast that theme exists to keep. Plain also ranges left and
drops the serif, because "Church lunch, the 12th" set centred in a serif reads as a hymn.

A gradient is held as stops rather than as a CSS string, so **the 7:1 floor is checked against every
stop**. A light patch halfway down a dark ground is exactly where words stop being readable, and the
flat colour says nothing about it. Measured: the closest any theme comes to the floor is 13.8:1.

**Still to come on themes.** The thing actually missing is a church's own photographs and video
behind the words, and that is the media library: **STG-151** and **STG-67**, in S0.2 and S0.3. These
gradients stand in for that rather than compete with it. Separate looks per content kind (ST8.3) and
previewing at the real output resolution (ST8.4) are S0.3. Editing a theme inside Stage with a
contrast check that refuses to save below 7:1 is ST8.6, in S1.0.

---

## STG-21 and STG-149, how to test them

Two things, both about the first minute: what the operator is looking at, and what a church sees
when they have nothing yet.

```
pnpm --filter @hearth/stage dev
```

### The live and next panes are the room

- Open a presentation from **Slides** and press **Present**.
- The **Live** pane is now the slide itself: the theme's ground, the theme's font, every line, at
  sixteen by nine. The **Next** pane is the slide one keypress away.
- Change the **Look** in the editor. Both panes change with the output window.
- Press **B**. The live pane goes black along with the room. Press **Esc** and the exact slide comes
  back, in both.
- Advance into the sermon marker. The pane says which item it is and that the screen is meant to be
  empty, rather than showing an empty screen that reads as a fault.
- A long slide shrinks in the pane the same way it shrinks on the wall, because the measurement is
  the same code at a different size.

The reason it was wrong is worth recording. The panes drew their own preview from the first line of
a cue, in the control surface's own font, with no ground. The fix is one renderer and one stylesheet
used by both windows: `src/output/slide.ts` and `src/output/slide.css`. Two implementations drift,
and the first anybody hears of the drift is somebody saying the screen looked different from the
preview.

### The three ways in

- Quit Stage and open it again. The control surface says **Hearth Stage**, **Put words on a screen**,
  and three things to press.
- **Make a slide** opens the editor with an empty presentation ready to type.
- **Open a song** opens the editor on the library.
- **Try a service** loads the sample service, and the deck, the panes and the keys all come alive.
- Make something of your own and press Present. The ways in go, because a service is open.

**The launch no longer opens a service.** Landing a new church in a demo service they did not build is
a product explaining itself before it has been asked. The sample is one of the three ways in instead.

**Nine new tests**: the panes are handed the same content and theme the output is handed, the next
pane is the slide one keypress away, a cover leaves the slide underneath it intact, and a session
with nothing open reports no service, puts nothing on the output and ignores an advance.

**What ST1.2 still owes.** It asks for a first run that offers to import an existing library. The
importers are STG-33 and after, in SF3, so the third way in is the sample service for now and the
import takes its place when those land.

---

## STG-168, how to test it

The application kept a church's only copy of its library in a folder called `@hearth/stage`, named
after the package. Nobody can find that, nobody can back it up on purpose, and nobody would recognise
it in a support call.

```
pnpm --filter @hearth/stage dev
```

- The window and the macOS menu bar say **Hearth Stage**.
- The library is at `~/Library/Application Support/Hearth Stage/library.db`, with its backups beside
  it.
- Open **Slides**. Everything that was there is still there.

**Eight tests on the decision, and none of them touch a disk.** For an unpaired church these files
are the only copy of everything they typed, so moving them is the kind of one-line change that
quietly loses a library. `relocation` takes what exists and returns what to move, so every refusal is
a case with a test on it:

1. It moves `library.db`, the write-ahead log and shared memory file SQLite keeps beside it, and the
   backups.
2. It carries only what is there, so a missing write-ahead log is no problem.
3. **It asks about the library rather than about the directory.** The first version asked whether the
   new directory existed. Chromium creates that directory for its own caches before any of this runs,
   so the answer was always yes and nothing ever moved. Found by running it and looking at the disk
   rather than by reading it.
4. A new directory already holding a library is left alone, because overwriting it would throw away
   whatever has been typed into it. The old files stay, so a church keeps both.
5. A fresh install and a second launch both do nothing.

The old directory keeps its browser caches, which are disposable and belong to a profile that no
longer exists. Clearing those up is not worth the risk of a recursive delete in a path built from a
name.

---

## The Slides window, rebuilt, and STG-7

Two pieces of testing feedback and one story, in one pass.

### The window opens on the library

A sidebar beside an editor spent a third of a laptop screen on a list nobody reads while they type.
It is two views now, one at a time.

- **The library.** Search at the top, **New** at the top right, and the saved work as tiles.
- **One thing, open.** Pressing a tile or **New** fills the window with it, and **All slides** goes
  back.

A tile is the thing it opens: its first slide, in the look it is presented in. A church recognises
the notices by what they look like faster than by reading a row in a list, and a wall of titles in
one font is a filing cabinet. The tile is a thumbnail rather than a rendering, because the measured
fit belongs on a screen somebody is reading from and running it for two hundred tiles would cost a
second of layout.

### A song is a thing with slides

The cards are identical whichever it is. There is no control asking what kind of section a slide is,
because a volunteer typing their first song has never heard of a pre-chorus and does not need to.

What that costs is handled rather than dropped:

- **A label is generated.** A label is what an arrangement's sequence refers to, so a song must have
  them. Sections get `V1`, `V2`, `C`, `B` from their kind and their order, and the **Slide title**
  field overwrites them for anybody who cares. A label somebody typed is kept, and a generated one
  moves along rather than clashing with it.
- **The kind rides along.** It goes to the window on the draft, is never shown, and comes back
  untouched, so editing the words of an imported song leaves its choruses as choruses. A section
  nobody has typed a kind for is a verse. Setting kinds is part of arrangements, STG-9.
- **A song gets an arrangement nobody asked for.** A song without one cannot present, and the obvious
  one is every section once in the order they were typed. Making, naming and reordering them is
  STG-9.

A song also carries the credits a licensed song has to show: author, year, CCLI number, copyright
line and whether it is public domain. Those appear on a song and not on a sheet of notices, because
a sheet of notices has nothing to carry.

### STG-7, how to test it

```
pnpm --filter @hearth/stage dev
```

- Press **Slides**. The window opens on tiles, with search at the top and **New** at the top right.
- Press **New**. The window clears to one empty slide, ready to type.
- Press **All slides** to go back.
- Press the **Amazing Grace** tile. It opens for editing like anything else: the same cards, the same
  **Add slide**, the same drag and the same icons. Above them are the credits.
- Change a word in a verse and press **All slides**. Open it again: the change is there.
- Add a verse. It is given the next label without being asked for one.
- Press **Present** on it. It presents, because it has an arrangement whether or not anybody made one.
- Type a song with no title and the problem says so, and nothing is written.

**Thirty-three new tests.** The two that matter most: a section always ends up with a label, because a
sequence refers to labels, and a song always ends up with an arrangement, because a song without one
cannot present. Both would cost a church a rewrite if they were wrong.

### What testing found, STG-7

Four things, all in the commit that names this section.

**Present did nothing on a song.** `presentNow` looked the id up among presentations only, so a song
fell through and the service never changed. A song and a set of slides are both a one item service
now, through `songPlan`, which is the same shape `presentationPlan` already had.

**A song typed in could not present until a restart.** The song lookup was built once on the way up,
so anything typed afterwards was missing from it. It reads fresh at compile time, which is when a
service is opened and when a plan changes rather than anywhere near a cue advance.

**No way back to the window that presents.** The editor is its own window and covers the control
surface on a laptop with one screen. There is a **Service** button at the top left of the library
now.

**Editing Amazing Grace would have destroyed its Spanish verse.** It carries a translated first verse
pointing at the English one by id. The editor shows neither the language nor the link, and the save
path regenerated section ids and set `translationOf` to null, so a church's bilingual hymn would have
come back as an English verse nobody asked for. Sections are matched to the record being replaced by
label now, and everything this screen does not ask about is carried across: the id, the kind, the
language and what it translates. Four tests on it, including one that reorders the sections first.

Nothing on screen said this was happening, which is the point: a save path that quietly drops a field
is the kind of defect a church finds eighteen months later in a service.

---

## STG-8, how to test it

Lyrics arrive from a web page, a Word document or an old presenter's export, and they arrive as a
wall of text. The schema needs ordered labelled sections, so something has to turn one into the
other, and the honest options are to ask the person to do it by hand or to propose something they can
look at.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides**, **New**, give it a title, and press **Add slide**.
- Copy a whole hymn off a lyrics site and paste it into the empty box.
- A panel appears **under that box**, saying how many slides it would make and what it went on, with
  the first line of each one listed. Nothing has changed yet.
- Press **Use these 6 slides** and they appear. Press **Keep as one** and the whole block stays in the
  one box.

Three things to try, because the three ways in behave differently:

| What you paste | What it says |
|---|---|
| Lyrics with `Verse 1`, `Chorus` and `Bridge` on their own lines | Split where the words said Verse and Chorus. The headings come off the slides and become the slide titles. |
| Lyrics with blank lines between stanzas and no headings | Split at the blank lines. |
| A solid block with neither | Split every four lines, which is a guess. The panel is quieter, because it is. |

**Eighteen new tests.** What they defend:

1. **A lyric that begins with a section word is a lyric.** "Chorus of angels sing" and "Verse after
   verse of mercy" are words to sing, so the whole line has to match. A rule that read the start of a
   line would break a hymn in half.
2. **A heading is read however it is decorated**: `[Chorus]`, `(Chorus)`, `CHORUS:`, `Chorus -`, and
   the short forms `V2` and `C` a church types into a sequence.
3. **It never loses a line.** Checked by flattening the proposal and comparing it to what went in,
   for headings and for a solid block.
4. **A single heading at the top says what a block is** rather than where it breaks, so a chorus
   pasted on its own stays one slide.
5. **Words above the first heading are kept** as a section of their own rather than thrown away.
6. **A guess says it is a guess**, on the proposal and in the panel.

**Somebody agrees with the split before anything is stored.** It is shown with what it was based on,
and the two buttons are the only things that change the boxes. A splitter that guessed silently would put a chorus in the
middle of a verse on a wall, and the person who pasted it would have no idea why.

**A heading gives the kind of section for nothing.** `Chorus` sets the section's kind as well as its
title, so a pasted hymn arrives with its structure even though nothing on the screen ever asks about
section kinds. That is the same field STG-7 carries through the window untouched.

## STG-9, how to test it

A church sings the same song two ways: the whole thing at a conference, and four sections on a
Tuesday evening. An order is a named list of slide titles, and the default is the one that goes on
the wall when nobody says otherwise.

**Two of the three fields the story asked for are not on the screen.** A key does nothing until
there is a chord chart to transpose, and a tempo does nothing until something follows a click. Both
are carried in the record untouched and both get a field in STG-44, where they start to do work. A
key in a box that nothing reads is a thing a volunteer fills in and wonders about.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides** and open a hymn. **Orders** is under the slides, with one order in it called
  **As written**.
- Look at the cards above. Each **Slide title** box now shows the name that order refers to: `V1`,
  `V2`, `C`.
- Press **Add order**. A second row appears, named **Order 2**, holding every slide once.
- Call it **Short** and cut its **Slides** field down to `V1 C V3`. Type it the way you would say it,
  separated by spaces.
- Press **Default** on the Short row.
- Press **Present**. The wall shows three sections in that order.
- Type `V9` into a Slides field. It says **V9 is not a slide title** underneath, and the stored order
  leaves it out.
- Rename a slide while an order still refers to its old title. The order loses that title rather
  than breaking.
- The **Remove order** button on the last remaining order is dead, because a song with no order
  cannot present at all.

**Sixteen new tests.** What they defend:

1. **Every state between two edits has to be storable.** The editor stores itself a second after
   typing stops, so a sequence naming a slide that was renamed a moment ago turns up at the library
   constantly. Those titles come out of the sequence, and an order left with nothing comes out with
   them.
2. **Exactly one default.** The one marked, or the first. A record with none cannot decide what to
   present, and a record with two is the same problem wearing a hat. The radio group on screen
   enforces it as well.
3. **A name typed twice moves along.** The second `Short` is stored as `Short 2`, because an order is
   referred to by its name.
4. **The key, the tempo and the chart survive a save that asks about none of them.** Matched by
   name, the way STG-7 matches a section by its label. This is the same defect class as the Spanish
   verse STG-7 nearly destroyed.
5. **Ids never collide.** Adding an order in front of two existing ones used to hand the new one an
   id an existing one already held, and the store writes arrangements by deleting and inserting.
6. **A song nobody made an order for still presents**, with every section once.

**Two defects found on the screen after this landed, both fixed here.**

1. **The sample service asked for three orders that were not there.** Saving a sample song in the
   editor before this story replaced every order it had with one called "As written", so the ids the
   sample service names (`ag-standard`, `ag-short`, `hhh-standard`) were gone from the library. This
   story closes the hole going forward, because an order is now carried through the window and
   matched to its record by name. `src/main/repair.ts` puts back what the old build took, on a
   signature exact enough to leave a church's own orders alone: one order, called "As written", and
   none of the ones the song shipped with. The church stays on the order it was on. Seven tests, most
   of them about what it refuses to touch.
2. **A service could not be put away.** **Home** sits in the header beside Slides while a service is
   open, and goes back to the three ways in. Without it a church that opened the sample to look at it
   was left in it.

**Orders are on a song and not on a sheet of notices.** A song is in the library for years and gets
reordered weekly. The notices are written for one week, and the cards are dragged into the order they
are read in. The cards and the editor are the same for both.

## STG-10, how to test it

Stage now carries 183 hymns and writes none of them anywhere until somebody presses a button. Before
this, two landed in every library on the way up, which is a product deciding what a church owns.

**Where the words come from.** The [Open Hymnal Project](http://openhymnal.org/) publishes around 300
hymns as ABC source, and every file states the copyright of its words, its music, its translation and
its setting separately. `packages/songs/scripts/import-open-hymnal.ts` reads the archive, keeps only
the hymns whose **words** are in the public domain, rebuilds the verses from the syllables under the
music, and writes `packages/songs/src/hymns.json`. It is run by hand and its output is committed, so
the application reaches nothing at runtime and a church with no connection gets the same library.
Stage ships no licensed lyrics, which is a requirement rather than a convenience: lyrics are the
church's CCLI responsibility, and bundling any would make them ours.

**Why 183 of 306.** 113 are left out because their words are under copyright, and ten more because
the hymn would not come back cleanly. The lyrics sit under the music one syllable at a time, and they
are put back together using the hymn's own metre, so `8 6 8 6` means four lines of eight, six, eight
and six syllables. Where the syllables and the metre disagree the hymn is left out, because a hymn
broken in the wrong place is worse on a wall than a hymn that is not there.

```
pnpm --filter @hearth/stage dev
```

Your library already has songs in it, so the offer stays out of your way. To see it, open the built
application against an empty data folder:

```
pnpm --filter @hearth/stage build
cd apps/stage && npx electron . --user-data-dir=/tmp/hearth-trial
```

- The library is empty. **Add 183 hymns** sits under "Nothing saved yet".
- Press it. The tiles fill, the button goes, and every row is a song.
- Open one. It has its verses as slides, its author and year, "Public Domain" on the copyright line,
  and an order called **As written**.
- Press **Present**. It goes on the wall.
- Search for a word in a title. The list narrows as you type.
- Press **Try a service** on the start screen of a fresh folder. It brings its own two songs and
  nothing else, so the sample is a thing somebody asked for.

**Twelve new tests.** The ones that matter: every one of the 183 validates, every one compiles to a
deck with no problems, every one is marked public domain, no two share an id, and no verse has an
empty line. A church presses one button, so a hymn nobody typed has to be as sound as one somebody
did.

## STG-13, how to test it

Nothing moves on the screen. Every word is in the same place, in the same font, saying the same thing.
That is the whole test, and it is why this is worth doing now rather than at the first translation: the
cost of pulling copy out of a window grows with the number of windows.

**Stage has its own catalogue rather than the platform's.** The two run in different processes, ship on
different days, and talk about different things. One says "Add a household" and the other says "Black
the screen". A shared file would be a merge conflict between two products on every release, and a
translator would be handed a thousand strings to find the forty that are on a laptop at the front of a
church.

```
pnpm --filter @hearth/stage dev
```

- Every button, label and heading reads as it did. The service window, the Slides window, the editor,
  the orders panel, the key brief along the bottom.
- Open a service with a problem in it. The red strip still says what is wrong in a sentence.
- The look picker still names the four looks.
- Count the slides on something. "4 slides" with an s, "1 slide" without one, which is now the
  language's own rule rather than a ternary in a renderer.

**Three guards, in `apps/stage/tests/copy.test.ts`.** A word typed into a window fails the build and
names the file and the line:

1. **Nothing assigns copy in the source.** `textContent`, `title`, `placeholder`, `aria-label` and
   `createTextNode` are all checked.
2. **Nothing writes copy in the markup.** The HTML carries `data-t="library.new"` and the words arrive
   from the catalogue, so the markup is the shape of the screen and nothing else.
3. **Every key in the markup exists.** An attribute is a string, so the compiler cannot check it the
   way it checks `t("...")`, and a renamed key would otherwise be a blank button that nothing reports.

**The main process stores two words that look like copy and are not**: an order called "As written",
and the "Order 2" a blank name becomes. Both are written into the library and read back as data.
Translating them would rewrite a church's records when they changed language, so they stay where they
are, and the guard covers the windows rather than the whole application.

## STG-14, how to test it

Stage asks nobody who they are. It never has, and now that is a fact with a test under it rather than
a thing that happens to be true. What is new is the machine's own name, which a church with three
laptops needs so they can tell a sound desk from a booth.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides**, then **Settings** in the header. The name of this machine is already filled in,
  taken from the machine itself. Underneath it says which operating system it is.
- Change it to something a church would say, like Sound Desk, and press Return. Quit and open again.
  The name is still there.
- Clear the box and leave the field. It goes back to the name it had, because a blank name in a list
  of three laptops helps nobody.
- Press **Slides** at the top left to come back.

It is stored in `device.json`, beside the library rather than inside it. A church that copies
`library.db` to a second laptop is copying their songs, and the second laptop is still a different
machine. A name travelling inside the library would give two machines one name on the day somebody
most needs them told apart.

**Seventeen new tests.** What they defend:

1. **A church's chosen name survives everything.** A restart, a different hostname, a damaged file.
2. **A damaged file does not stop the application opening.** It holds a name and a platform, both of
   which the machine can say again, so losing it costs the name somebody typed and nothing else.
   Refusing to start over it would cost a service.
3. **The path to a slide on the wall is three presses**, and two for a hymn. Walked against the real
   library rather than asserted.
4. **No window has a field that asks who somebody is.** No password box, no email box, no credential
   autocomplete, anywhere a person can see.

The id in that file is for the church's device list when pairing arrives (ST1.6), and it stays the
same across runs so a renamed laptop is still the same laptop. The token that proves this machine is
the church's goes in the keychain with ST1.5, and nothing here is a step towards signing in.

## STG-22, how to test it

Black and clear were already one keypress each. The key marked L showed the same thing as C, because
there was no logo to show, and that is what this story fixes.

**The mark is the church's own, and nothing ships a default.** A screen at the front of somebody's
building is not a place to put our name. A church with no logo gets the ground, which is what the key
did before.

```
pnpm --filter @hearth/stage dev
```

- Press **Slides**, then **Settings**, then **Choose a file** and pick a PNG. It appears as a preview
  under the word Logo.
- Go back to the service and press **L**. The room shows the mark, centred, on the service's ground.
  The Live pane shows the same thing, because both windows draw the cover through one function.
- Press **L** again, or **Esc**. The exact slide is back. It never left: the cover goes transparent
  over a slide that was never taken down, which is what "restores the exact slide" means.
- Press **B** then **L** then **C** without pressing Esc between them. Each one is one press.
- Press **B** on the start screen, with no service open at all. The room goes black. The three covers
  are independent of where the deck is, including nowhere.
- Press **Remove** in Settings. **L** goes back to showing the ground.
- Move the file you chose to the wastebasket and restart. The mark is still there, because Stage kept
  a copy. A path into a folder somebody tidies is a blank screen at 10:28.

**Eleven new tests.** The ones that matter: a file that is not a picture is refused, one over four
megabytes is refused, a file that cannot be read is refused by name rather than silently, a second
logo removes the first so two files cannot both claim to be the mark, and a logo that has gone missing
falls back to the ground rather than putting a broken image on a wall.

**The logo goes down its own channel** rather than on the state. It is a picture that changes once in
a year and the state goes down behind every keypress, so carrying it there would put a megabyte on the
wire between a key and a pixel. That makes six channels, and the count is asserted, because a channel
is the whole surface a sandboxed window can reach.

## STG-23, how to test it

Hold the advance key down for two seconds. The deck moves one cue.

```
pnpm --filter @hearth/stage dev
```

- Press **Try a service**, then hold **Space**. One cue. Let go and press again: one more.
- Hold the **right arrow**, then the **left arrow**. Same on both.
- Press Space four times quickly, like an operator who is behind. Four cues. A fifth of a second apart
  is a person, and the guard is nowhere near that.
- Click four cues in the deck list one after another, as fast as the mouse allows. All four. Choosing a
  cue is never guarded, because there is no such thing as a repeat in a click.

**Two halves.** The window drops the repeat flag the operating system sets, which is one line and has
been there since STG-11. The session refuses a second key inside sixty milliseconds, which is the half
this story adds, because a presentation clicker with a tired switch sends two events in a handful of
milliseconds and flags neither. A room sees two cues go past for one press of a thumb, and nobody can
work out why.

**The first version of the guard was wrong, and the test caught it.** It stamped the clock only when a
cue actually moved, which made it a rate limit rather than a guard: a key held for two seconds walked
the deck at one cue every sixty milliseconds, thirty three cues in. Stamping on every press, including
the refused ones, is what makes a held key one cue. The test that found it holds the key for two
seconds at the rate an operating system actually repeats.

**Six new tests**, and one in the architecture file asserting the window still drops the flag, because
that line is exactly the kind that goes missing in a refactor with nothing failing until a Sunday.

## STG-24, how to test it

A set list is what a church planned on Thursday. What happens on Sunday is that the preacher overruns,
so the last verse goes, and the chorus goes round one more time because the room is still singing.

```
pnpm --filter @hearth/stage dev
```

- Press **Try a service**. Hover a cue in the deck list, or tab onto it. Five small buttons appear on
  the row, each carrying its name.
- Press **Skip this run** on a verse. The row stays in the list, struck through and dimmed, and
  pressing Space steps straight over it. Press **Put it back** and it is back.
- Press **Skip this run** on the verse that is live. The room moves on to the next thing, rather than
  sitting on a slide that is no longer in the service.
- Press **Sing it again** on a chorus. A copy appears right under it, marked with a plus. Advance into
  it and the room sees the chorus twice. **Take the repeat away** removes the copy.
- Press **Move up** and **Move down** on a verse. It swaps with its neighbour, and it stops at the
  ends of its own song. Moving a song to the other end of a service is a set list decision, and doing
  it here would leave the room looking at an order nobody has on paper.
- **Back to the set list** appears above the deck as soon as the run differs, and goes when you press
  it. The slide the room is looking at stays where it is.
- Press **Home**, then **Try a service** again. Everything is as the church planned it.

**An entry is not a cue.** A chorus sung twice is one cue and two entries, so the operator skips or
moves one of them without touching the other. That is why the running order is its own list in
`running.ts` rather than a flag on a cue.

**Twenty two new tests**, thirteen of them on the pure order and nine through a running session. The
one that matters most compares the set list before and after a skip, a repeat and a move, and then
reopens the service to find the order the church planned.

**A hole in the STG-13 copy guard, found and closed.** "Nothing on the screen" was written into the
control window inside a ternary spread over four lines, and the guard scanned line by line, so the
assignment and the words were never on the same line. It reads whole files now, after taking out the
strings that are not copy: a key handed to `t`, a comparison, a `case` label.

## The words, settled

Three levels, three words, and none of them used twice.

| Level | Word | What it is |
|---|---|---|
| 1 | **Service** | What the church is running on a Sunday. Its items in order. |
| 2 | **Item** | One thing in a service: a song, a reading, the notices. A stack of slides with a name on it. |
| 3 | **Slide** | One screen the room sees. |

The window that lists items was called **Slides**, and so are the things inside the things it lists.
It is the **Library** now. A song's sections and a notice sheet's slides are the same thing to the
person looking at a tile, and the same thing in the editor, where each one is a card with a title and
a box, so a tile counts slides whichever kind it is.

Building a service out of several items is **STG-46**, duplicating last week's is **STG-47**, and
adding one to a running deck is **STG-49**. The words land first because every one of them is in
`packages/stage-i18n` after STG-13, which made this a change to one file rather than to nine.

## STG-25, how to test it

The design case is 10:28 on a Sunday with a sixteen year old operating and a room filling up.
Everything they can reach has to be safe to press by accident.

Most of this story is a test rather than a change, because the separation was already there and the
thing worth owning is that it stays there. The live surface asks for fourteen intents and the test
names all of them. Anything that writes, removes or restyles fails the build if it turns up in that
window: saving, opening an item for editing, adding the hymns, renaming the machine, choosing a logo.
The window is also checked for a library list, a file input and a `select`, because a theme picker is
a `select` and that is how one would arrive.

**The run buttons from STG-24 are the one thing on that surface that changes anything**, and they are
allowed because `running.ts` is a layer over the compiled deck that touches no store. The test asserts
that too: the file may not mention the library or saving.

**One real change.** Present, in the editor, replaces what the room is looking at. A church running a
service should not lose it to a button somebody pressed in another window.

```
pnpm --filter @hearth/stage dev
```

- Press **Try a service**, then **Slides**, open a hymn and press **Present**. It asks, and it says
  what happens: the service comes off the screen and nothing in it changes.
- Press **Keep the service**. Nothing moves.
- Press **Present** again and confirm. The hymn goes up.
- Press **Present** on the same hymn a second time. No question, because nothing is being replaced.
- Press **Home**, then **Present** on a hymn. No question, because no service is running.

**Six new tests.**

## STG-26, how to test it

Three things on a screen with no service open. A song already worked. The other two did not.

```
pnpm --filter @hearth/stage dev
```

**The clock.** A room fills up at twenty to, nothing is open yet, and the screen should say how long is
left.

- Along the bottom right: **Countdown**, then **5 min**, **10 min**, **15 min**.
- Press **10 min** with nothing open at all. The wall shows a clock counting down, and the Live pane
  shows the same clock on the same second.
- Press **Try a service**, then press **5 min**. The clock sits over the slide. Press **Stop** and the
  slide is exactly where it was. Nothing moved underneath it, the same as the covers.
- Let it run to zero. It stops at 0:00 rather than counting upwards, because a service that has
  started does not need a clock saying how late it is in front of the people who are late.

**It is one message, not one a second.** Main sends the moment the clock reaches and the windows count
for themselves, so a countdown puts nothing on the wire behind a keypress. Each window runs one timer,
started when there is a clock on screen and stopped the moment there is not.

**The reading.** The bundled translations are ST7.1, in a later release. Until then a church puts a
passage up by typing it.

- Press **Library**, **New**, title it, and fill in **Reference** beside the title with something like
  `Psalm 23:1-6`.
- Type the passage across a few slides and press **Present**. Every slide carries the reference
  underneath, because somebody arriving at slide three still needs to know where they are (ST7.3).
- Clear the Reference box. It is a sheet of slides again, with nothing underneath. That one field is
  the whole of what makes an item a reading, so there is no kind to choose and no mode to be in.

**Fifteen new tests**, and a schema step: `presentations` gained a `reference` column. It ran against
your library on the way up, which now reads schema 3 with both items and all 185 songs untouched.

## STG-27, how to test it

The strip along the bottom of the service window named six keys. Three more worked and were written
down nowhere, which is the quiet failure this story is about: a key that works and nobody knows, or a
key written on a card that stopped working two releases ago.

```
pnpm --filter @hearth/stage dev
```

- Along the bottom left: **Shortcuts** and **Countdown**. Nothing else.
- Press **Shortcuts**, or the **?** key anywhere on the service window. The card lists every shortcut,
  with the alternate spellings underneath the ones that have them.
- Press **Escape**. The card closes and the screen behind it is untouched, because Escape belongs to
  whatever card is up rather than uncovering the wall.
- Press **Home** during a service. Back to the first cue. It was always there and the strip had no
  room to say so.
- Press **Countdown**, then **10 min**. The card closes and the clock goes up. **Stop** appears beside
  the two buttons, so taking it down again is one press rather than two.
- Hold any key down. One cue, which the card says in a line underneath.

**One table, one card.** `KEYS` in the control window holds every spelling and what it does. The
handler looks a press up in it and the card is built from it, so the two cannot disagree, because
there is nothing to keep in step. The strip was a second place the shortcuts were written down, and a
second place is a place to drift from.

**Eight tests** hold that shape: one keydown listener and no second switch on a key anywhere in the
window, no key with two meanings, every meaning in the catalogue, two cards and both opened from the
same corner.

## STG-28, how to test it

```
pnpm --filter @hearth/stage build
pnpm --filter @hearth/stage render
```

It lays out every slide of the bundled library in all four looks at 720p, 1080p and 4K, and prints one
line. **15,756 slides, under three seconds.** `render 40` does the first forty, for when something is
being fixed.

It is a real engine doing real layout with real fonts, loading the same stylesheet and the same
renderer module the output window loads. A harness with a page of its own would measure a page no
church ever sees.

Three things fail the build:

1. **A glyph crossing the safe area** (ST6.4). A descender over that line is clipped on a projector
   with overscan, and nobody finds out until a Sunday.
2. **A slide taller than the screen it is on.** A line nobody in the room can read.
3. **A capital under 4% of the output height** (ST20.4).

**It found a defect in its first full run.** Thirty two slides at 720p sat under the legibility floor.
The floor was being compared against the font size, and ST20.4 names the **cap height**, which is not
the same number: a serif at 28px draws a capital about 20px tall, so the real floor was 28% too low.
The fit now measures how much of a font size a capital is, in the theme's own typeface off a canvas,
and divides the floor by it. All 15,756 pass, and nothing started overflowing, so those slides had the
headroom all along and were simply being allowed to shrink too far.

**What it does not do yet.** ST20.4's contrast half is already covered by `theme.test.ts`, which checks
every theme against every stop of its own gradient through `packages/colour`. Sampling contrast off
rasterised pixels, which is what catches an image background, waits for the media library in STG-151.

## STG-29, how to test it

```
pnpm --filter @hearth/stage build
pnpm --filter @hearth/stage latency
```

Sixty advances, measured from the key event to pixels changed on the output. The budget is 100ms at
the 99th percentile (ST21.1), and the number is written to `apps/stage/latency.json` so a release can
be compared with the one before it.

**On this machine: 50th 11ms, 95th 18ms, 99th 75ms.** Inside the budget, with the 99th percentile
using most of it.

**It drives the real application.** The built app is launched with the debugging port open and spoken
to over the DevTools protocol: a real key event into the control window, and a screencast on the
output window, which emits a frame when and only when something is painted. Nothing is instrumented,
so there is no code path here that a church does not run. It uses a scratch library in a temporary
folder, so measuring cannot touch what a church typed.

**The first numbers it produced were nonsense, and that is worth writing down.** It read 878ms at the
median. The rig was clicking "Try a service" before the window had its state back, so the click did
nothing and the deck was empty. Advancing an empty deck paints nothing, so the first frame the rig
saw after each key was the clock in the corner of the window repainting on the second. It now waits
for the deck to have groups in it before it starts, and a measurement rig's first number should always
be assumed to be measuring the rig.

**What is still owed.** ST21.5 names the reference hardware as a 2019 laptop: four cores, 8GB,
integrated graphics. This machine has eight cores and 16GB, so the report records what it ran on and
says plainly that it is faster than the hardware the requirement names. The number on a church's media
desk is not yet known.

## STG-46, how to test it

Until this, a service was either the sample or one thing pressed Present on. This is the story that
makes Stage a presenter a church can actually run a Sunday from.

**It was built out of board order.** STG-30, the WCAG audit in CI, was next and is now queued behind
STG-47 to STG-49. The reason: every story after this one is easier to judge once a service can be
assembled, and a presenter that cannot hold a running order is not yet a presenter.

```
pnpm --filter @hearth/stage dev
```

- Press **Library**. There are two tabs now: **Items** and **Services**.
- Press **Services**, then **New**. Name it, set the date.
- Press **Add from the library**. Search, press a hymn, and it goes on the end.
- Press **Add a heading** and type "Sermon". A heading puts nothing on the screen and keeps the order
  readable, so the operator knows the next press is the song after it.
- Move things with the arrows, take one out with the bin.
- Press **Present**. The whole order goes on the service window as one deck, groups and all.
- Go back, correct a word in that hymn under **Items**, and present the service again. The correction
  is there, because an order points at the library rather than copying it. That is the whole reason a
  library exists.

**Twenty six new tests**, eleven on the model, ten on the store and eight through the editor's side of
main. The one that matters most corrects a hymn after the service was built and then checks the deck
shows the correction.

**Schema 4** adds `set_lists` and `set_entries`. It ran against your library on the way up, which now
reads schema 4 with 185 songs and both items untouched. An entry carries the title beside the
reference, so an order still reads as an order when an item has been archived, and the compiler
reports the gap by name.

**One thing closed on the way past.** The editor had two dialogs for the first time, and the test that
said "one dialog, never stacked" was asserting the wrong thing: the count rather than the stacking.
There is now one `showModal` call in the window, inside a helper that closes whatever was open, so
stacking is impossible rather than avoided.

## STG-47, how to test it

A church's order is mostly the same from one Sunday to the next: a welcome, two songs, the notices,
the sermon. Starting from the last one is the difference between two minutes and twenty.

```
pnpm --filter @hearth/stage dev
```

- Press **Services**, build one and go back to the list.
- Press the copy mark on its row. The copy opens straight away, because somebody who pressed it is
  about to change two things in it and then present it.
- It carries the name and every line of the order. The date has moved on by a week, to the same
  weekday.
- Go back. Last week's is still in the list, on its own date, untouched.

**Thirteen new tests.** The date arithmetic is checked across the end of a year, the end of February
in a leap year, and a daylight saving change, because a date held as text and moved by seven days is
exactly where that kind of defect lives. Every entry of the copy gets an identity of its own, so the
two orders cannot collide in the store.

## The windows, rearranged

Four tabs and two header buttons had accumulated, and the library was a tab beside the presentation plans
when it is the thing presentation plans are built out of.

| Before | Now |
|---|---|
| Header held Library and Services | Header holds Home and the status |
| Landing page offered four ways in | Two: **Service plans** and **Library** |
| Library and Services were tabs of one page | Two pages, each reached from the landing page |
| The library listed songs, slides and media together | A kind is chosen first, and the list is of that kind |
| "Service" | "Service plan" |

**The library is chosen into.** Songs, Media, Slides. A library holding two hundred hymns, a term of
notices and a folder of loops is a list nobody can read, and the kind somebody wants is the first
thing they know. Media is on the choice with an empty state until the media library lands with
STG-151.

**Service plans is the page the window opens on.** Empty, it says so and offers the one thing to do
about it in the middle of the screen. With plans in it, **New presentation plan** sits in the corner.

**Still to come, next:** a slide typed inside a presentation plan belongs to that plan rather than landing
in the library, with **Save to the library** as a deliberate act. That is a storage change, so it is
its own step.

## The restructure, step 1b: a trail, and a page that says what it is

The first pass moved the pages. This one makes them read as pages.

| Was | Is |
|---|---|
| The window's title bar said "Library" | It says Hearth Stage, on every page |
| Back was a word naming a fixed destination | Back is one arrow, and it goes where you came from |
| Settings sat in the Presentation Plans header | Settings is on the landing page, with the two ways in |
| Titles sat wherever the header's flex left them | A page's name is centred, the way out on the left, the one action on the right |
| The three kinds huddled in the top left | They sit in the middle of the page as tiles |
| **New** appeared under Slides | It appears under Songs |

**Where a slide is born.** A song is typed into the library, because a song library is a shelf of
songs. A slide is typed inside a presentation plan, belongs to that plan, and reaches the shelf only when
someone saves it there. **Add from the library** inside a plan is a picker over the plan rather than
a page you leave the plan for.

**Settings is a page main owns.** It used to be a flag the editor window kept to itself, which was
fine while the only door to it was in that window's own header. The landing page is in the other
window, so the page moved into the state both windows read.

**Still to come, next:** the storage half. `presentations.in_library`, items created inside a plan
starting at 0, the library listing only what is on the shelf, and **Save to the library** flipping
the flag.

## STG-169, where a slide lives

A church types a term of one-off notices. None of them belong on the shelf
somebody browses looking for a hymn.

`presentations.in_library` is migration 5, defaulting to 1, because everything
written before it was typed in the library. A slide typed inside a presentation plan
is written with 0 and its id is appended to the plan in the same save, so a plan
never names a slide that does not exist. The library lists what is on the shelf.
The deck compiler reads every presentation, so an off-shelf slide presents like
anything else.

**Save to the library** sits on the slide editor and shows only on a slide that
is off the shelf and has been written once.

**The picker narrows first.** Songs, Media, Slides, the same three the library
page offers. Somebody building a service knows whether they want a hymn or a
notice before they know its name, and one list of two hundred rows makes them
scroll to find out.

**Still to come, next:** the two pages open in their own window, and they should
be tabs of the window that presents. That is a window change, so it is its own
step.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-169 | Where a slide lives, and the shelf it reaches on purpose | ST2.8 | Resolved |

## STG-170, one window

The presentation plans, the library and the slide editor opened in a second window.
On a laptop with one screen that window covered the service a church was
running, and the way back to it was the dock.

They are a page of the window that presents now. `#workbench` sits between the
header and the footer, `editor.css` is scoped under it so the two stylesheets
can share a document, and `body[data-workbench="open"]` puts the live surface
away underneath. Main holds the page, including `"none"` for the workbench
closed, so the back mark on every page walks out to the service.

**What keeps the library out of an operator's reach** used to be the window
boundary. It is now that rule in control.css, so the rule has a test of its own
and `live-surface.test.ts` reads the markup with the workbench cut out of it.

**A walk through the built application** is `pnpm --filter @hearth/stage walk`.
It drives the real window over the DevTools protocol and reads what is on
screen. It found two defects the unit tests and the smoke run both missed: four
intents that fell through to the session and did nothing, and a plan that kept
a copy of itself from before the slide typed inside it existed.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-170 | One window: the plans and the library as pages of it | ST1.2, ST12.3 | Resolved |

## STG-48, the plan to open on

A volunteer opens Stage at 09:40 on the morning of the service. The plan they
want is on the landing page, named and dated, and it holds the focus, so the
service starts on one keypress (ST12.5).

`nextUp` in `packages/songs/src/setlist.ts` is the rule: the soonest plan that
has not happened, counting today, falling back to the most recent one behind for
the Monday somebody opens last week's to look at it. Ties go to the title, so
two services on one day keep a stable order. It is pure and has its own tests.

**The focus is taken once per plan, on the next frame.** Once per plan because
the state goes down behind every keypress and a focus call on each one would
make the rest of the window unreachable. On the next frame because the workbench
is the other half of this window and paints from its own state, so the layout
asked for too early is the one from the page before.

The walk through the built application found that ordering. Both halves painted,
both were correct, and the focus landed nowhere.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-48 | The plan to open on, and the one keypress that starts it | ST12.5 | Resolved |

## STG-49, a song called from the floor

The leader calls a song that is not in the set and the operator has the length of
an introduction to get it on the deck. **A** opens a card, a few letters find it,
Enter puts it on (ST5.8).

**It goes after the item on the screen**, so the next press walks into it. At the
end would mean finding it again.

**It writes nothing.** The service that is running gets the song; the set list on
disk is what the church planned, and a change made in a hurry at 10:40 is not a
plan. `withItem` in `packages/songs` and `withGroup` in `running.ts` are both
pure, and `running.ts` still names no store.

**The run survives it.** Everywhere else a new deck is a new service and the run
starts as planned. This is the same service, so `Session.insert` carries the run
across: a verse the operator skipped two minutes ago stays skipped, a chorus they
added stays added.

**The card holds the library**, which the live surface is otherwise refused.
`live-surface.test.ts` allows searching and adding, and still refuses the
browsing grid, the theme picker and the importer. The rows come off the editor
state the window already receives, so nothing was added to the state that goes
down behind every keypress.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-49 | A song called from the floor, onto the deck that is running | ST5.8 | Resolved |

## STG-30, WCAG 2.2 AA, audited

`pnpm --filter @hearth/stage a11y` runs axe-core against the real window in
thirteen states, from the landing page to a service running with the shortcuts
card open. Against the real window rather than the markup, because half of what
this catches is computed: contrast is a colour over a colour after the tokens
resolve, and a name is whatever `fillText` put there. A jsdom audit would pass a
window nobody can read.

`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. `best-practice` is left
out, because a rule nobody agreed to is the rule that gets disabled in a hurry
the first time it fails a release.

**It found a regression on its first run.** The navigation restructure moved the
library header and dropped the line that gave the hymns button its words, so
"Add 183 hymns" had been an unnamed button since. It was still clickable, which
is why nothing else caught it.

**This repository had no CI.** `.github/workflows/ci.yml` now runs typecheck,
the tests, the build, the Electron binding, and then the four rigs that need a
display under xvfb: the smoke run, this audit, the walk through the window and
the output legibility harness.

**What a file can hold is held in `tests/access.test.ts`**, so a broken rule
fails in a second rather than after Electron starts: the focus ring is never
styled away and is declared once for the whole window, nothing does something on
a click without being a real control, and every button carries a name from the
markup or from the window.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-30 | WCAG 2.2 AA audited in CI, and the CI to run it in | ST20.1, ST20.2 | Resolved |

## STG-50, back to the chorus

Skip and repeat landed with STG-24. This is the third part of ST5.9: any cue is
reachable by typing its label. **G**, type `C2`, press Enter.

**An exact label wins.** A song with two written choruses labels them `C1` and
`C2`, and that is what its order says, so that is what the operator types.
Failing an exact match, `C2` is read as the second time `C` comes round, which is
what it means in a song whose chorus is sung twice off one section.

**A cue the operator skipped is not reachable.** Jumping into something somebody
deliberately took out would put a verse on the wall that the church is not
singing.

**What it will do is shown while the label is typed.** A jump on a live surface
should be read before it is made rather than after.

`findCue` is in `src/shared/cues.ts` and pure, so it is tested without opening a
window.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-50 | Back to the chorus: any cue reachable by typing its label | ST5.9 | Resolved |

## The vocabulary: a Presentation Plan

"Service Plan" became **Presentation Plan** everywhere a church reads it, and
everywhere the code names it: the catalogue keys moved from `service.*` to
`plan.*`, the element ids from `service-view` to `plan-view`, and the window's
functions from `renderService` to `renderPlan`.

**"Service" still means the gathering.** `control.endOfService` is the end of the
service, and the plan is the thing a church builds beforehand. The two were one
word and the word was doing two jobs.

The typed catalogue caught every renamed key as a compile error, which is what it
is for.

## STG-51, a typo on the wall

The operator reads the misspelling at the same moment the room does. The card
holds the words as they are, correcting them puts the correction on the screen,
and keeping it in the library is the press after (ST6.8).

**The correction is the run.** `Session.correct` writes into this session's copy
of the deck and names no store, so every other slide of the section measures
against the corrected words and the one on the wall does not jump size as the
fix lands. It survives advancing, reversing, and a song called from the floor,
and it goes when the service does.

**Keeping it is the one write this surface can make.** Main refuses it on
anything the laptop does not own, because a synced song belongs to the platform
(PRD section 2, the two-writer rule), and then the card says "This run only"
rather than hiding a button with no explanation.

**Putting the words back is not a matter of index.** The splitter drops blank
lines and regroups what is left, so the slide holds the words and the section
holds the words plus the shape somebody typed. `correctSlide` runs the split
again and walks it alongside the original, replaces the one run of lines, and
leaves the blank lines exactly where they were.

**The card no longer reports its own success.** It said "Kept in the library"
the moment the button was pressed. The walk through the built application showed
it saying that over a library that had not changed, which was a different defect
hiding behind a wrong assertion of mine. `kept` comes back on the state now, so
the card says it when main has done it.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-51 | A typo corrected on the wall, and offered to the library | ST6.8 | Resolved |

## STG-52, what the church actually sang

A small church gets fined for a CCLI report that does not match what happened, so
this is the record the fine turns on. `song_usage` is migration 6.

**A row is written when a song reaches the wall**, not when a plan is opened. The
session calls `onShown` as the live cue changes, and main writes the row, because
the session owns the deck on the screen and the log is the library's.

**Covered is not sung.** A cue reached behind a black writes nothing, and taking
the cover off writes it then. The usual order, cover the screen and then move, is
still recorded.

**One service is one use.** The operator going back to the chorus is the same use,
held both in the session, which logs once per group, and in the store, where the
unique index makes it true whatever calls it.

**The log outlives the song.** The title, author and CCLI number are copied in
rather than joined, because a church that archives a hymn in March still has to
report the February service it was sung in. There is no foreign key on `song_id`
for the same reason.

A song put up on its own with no plan open still counts. CCLI does not care that
nobody typed a plan.

Migration 6 ran against the real library on disk: 185 songs, 2 presentations and
2 plans intact.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-52 | The local usage log, written when a song is actually shown | ST2.10, ST18.7 | Resolved |

## STG-53, the CCLI report

Small churches get fined for failing this report and no free presenter does it,
so it is one of the few places Stage is the only answer a church has.

**The fixture is the agreement with the platform.** `CCLI_FIXTURE` and
`CCLI_EXPECTED_CSV` are in `packages/songs`, which the platform consumes as a
package, so R12.10 asserts the same thing from the same facts. If the two ever
disagree, one of them is wrong and a church gets a report its licence does not
accept. Changing either is a change to both boards.

The fixture is built to catch what a report gets wrong: a song sung across
several services counting once each, two services on one day counting twice, both
ends of the period being in it and a day outside it being out, a hymn with no
CCLI number still being listed, and a comma or a quote in a title surviving the
CSV. Writing it caught two things: a title with commas has to be quoted, and
counting services by date alone is wrong for a church that meets twice in a day,
so a use carries the plan it was sung in.

**The screen says what it will export before it exports it**: how many songs,
across how many services, and how many have no CCLI number. The church is the
only one who can tell a hymn out of copyright from a song somebody typed in a
hurry, so that count is named rather than fixed.

**It opens on the last six months**, which is the span a church reports, so the
one screen somebody visits once a year opens on the answer.

The walk caught a routing defect introduced here: the export case landed in the
middle of a fall-through group, so Presentation Plans and Library stopped
opening. The unit tests could not see it.

| Story | What | Requirement | State |
|---|---|---|---|
| STG-53 | The CCLI usage export, and the fixture the platform shares | ST2.11, ST18.7 | Resolved |
