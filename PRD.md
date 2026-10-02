# Hearth Stage, product requirements

| | |
|---|---|
| **Product** | Hearth Stage, a worship presenter. Free, and it runs on its own. |
| **Phase** | Phase 2. Outline in [the platform PRD, section 8.23](https://github.com/boluwaji11/ChurchManagement/blob/main/PRD.md). This document is the build specification. |
| **Status** | Draft 2, October 2026. Written before any Stage code. |
| **Board** | [BACKLOG.md](BACKLOG.md) |
| **Architecture** | [docs/architecture.md](docs/architecture.md) |
| **Pairing with Hearth** | [docs/hearth-sync-contract.md](docs/hearth-sync-contract.md) |
| **Journeys** | [docs/journeys.md](docs/journeys.md), what people actually do end to end |

Requirement IDs are `ST<domain>.<n>`. The eighteen `S1` to `S18` items in the platform PRD section 8.23 are the
outline those IDs expand, and section 23 maps every one of them to the requirements that deliver it.

> **Draft 2 changed the shape of this document.** Draft 1 specified Stage as a thin client of the
> platform, which made a Hearth account the only way a song could reach a slide. Stage is a complete
> presenter that installs and runs by itself, in the way ProPresenter and OpenLP do. Pairing with
> Hearth is additive. Section 2 covers what that changes.

---

## 1. Why Stage exists

The management system owns the Sunday loop up to the moment the first song starts, and then hands the
whole thing to a different vendor. Planning Center plans the service and exports it to ProPresenter
through an import that loses the arrangement. ProPresenter runs the screens and knows nothing about
the church. The loop breaks in the one place a volunteer has to stand in front of six hundred people.

Stage closes it. A church that uses Hearth pairs Stage with it, and the plan Maria built and the songs
James chose arrive on the laptop out of the same database. The export step is gone, and so is the file
somebody used to carry across the room.

A church that has never heard of Hearth downloads Stage and uses it anyway.

### Two things Stage is at once

**A free presenter that stands on its own.** It holds its own song library, imports the library a
church already has, builds its own set lists, carries its own public-domain scripture, and presents a
Sunday service on a laptop that has never signed in to anything and is not on a network. Measured against OpenLP, FreeShow, Quelea
and Church Presenter, it has to be as complete as they are and look considerably better.

**The only presenter that already knows this Sunday.** Paired with Hearth, the plan, the song order,
the key, the arrangement, the scripture reference, the announcement list, and the team are already
there before the laptop is opened. No other presenter can do this, because no other presenter's
vendor also runs the church's database.

The first makes Stage installable. The second makes it worth keeping, and it is also the reason a
church that liked Stage ends up on Hearth. **Stage is the front door to the platform**, which is a
better distribution route than the platform being a toll gate on Stage.

### The design case

**10:28 on a Sunday.** The service starts at 10:30. The worship leader changed the song order at
10:15. The laptop is on battery, driving a projector through an HDMI adapter bought in 2017, on wifi
that drops every few minutes. The person operating it is sixteen years old and has opened Stage twice.

Stage has to be running the right set within two minutes, and it has to keep running when the wifi
goes. Every decision in this document is tested against that paragraph.

---

## 2. Standalone first, and what that costs

**87 of the 144 stories need no platform at all**, which is releases S0.1 to S0.3 in full. Four
stories outside S0.4 need a paired church: STG-125 run telemetry, STG-141 the portable bundle, and
STG-144 multi-campus. Everything else in S0.5 and S1.0 works alone.

**What an unpaired church gives up**, stated here so it is a decision rather than a discovery:

| Paired only | What an unpaired church does instead |
|---|---|
| Licensed scripture translations, under the church's own licence (ST7.6) | Presents from the bundled public-domain translations, or types the passage in (ST7.1, ST7.5) |
| The service plan arriving by itself (ST5.3) | Builds a set list in Stage (ST2.8), which somebody types |
| Announcements typed in Hearth reaching the foyer screen (ST13.5) | Builds the loop's slides in Stage (ST13.4) |
| Plan notes addressed to a position (ST5.5, ST11.6) | Does without. Who is serving lives in the management system. |
| The library existing in a second place | Relies on Stage's backup and restore (ST19.5) and its ungated export (ST2.12) |
| Themes matching across three laptops (ST8.5) | Sets the theme on each laptop |

Everything else is the same product: the library, the five importers, slides, outputs, the stage
display, backgrounds, timers, the CCLI usage export, and crash recovery.


Draft 1 had the platform as Stage's only source of songs. Correcting that changes four things, and
three of them are costs worth stating plainly.

**1. Stage owns a library.** Song entry, editing, arrangements, chord charts, search, and the
importers all live in Stage, in domains 2 and 3. Draft 1 put every one of them on the platform. This
is the largest single piece of added scope in this document, and it is what independence costs.

**2. Two origins, and therefore one rule.** A song in Stage came from one of two places, and the
difference is a column.

| Origin | Who may edit it | Why |
|---|---|---|
| `local` | Stage | Typed in or imported here. Stage is the only copy, and Stage owns it. |
| `hearth` | The platform | Synced from a paired church. Read-only in Stage, so the library has one writer and cannot diverge. |

A `hearth` song is adjusted for one service through a run override (ST6.7), which lives against the
run. A correction that should stick is made in Hearth, by a person, and arrives at the next sync. A
`local` song is promoted into a paired church's library by the operator's explicit action (ST4.11),
one way, once. There is no merge algorithm anywhere in Stage, and that is deliberate.

**3. Scripture needs a source.** A standalone Stage cannot ask the platform for resolved text, so it
carries its own. Public-domain translations are bundled (ST7.1). Licensed translations cannot be
bundled or fetched by us at any price, so a church that presents from the NIV either pairs with
Hearth and uses the text its own licence covers (R11.5), or types the passage in. This is stated in
the product rather than discovered by a church in week three.

**4. The platform stops being a prerequisite.** Sync moves to S0.4 and gates nothing before it. S0.1
through S0.3 are a complete presenter, buildable start to finish with no platform work at all.

What does **not** change: the song schema. Stage's local library uses the schema in
[the platform PRD, section 9.4](https://github.com/boluwaji11/ChurchManagement/blob/main/PRD.md) exactly, through the shared `packages/songs` package, which is why a
locally authored song promotes into Hearth as an insert rather than a translation.

---

## 3. Users

**James, worship leader, 34, volunteer, four hours a week.** Picks the songs, sets the keys, builds
the arrangement. He already pays for ProPresenter out of his own pocket, or runs a copy from 2016, or
builds slides in PowerPoint on Saturday night. He is the person who downloads Stage, and the person
who decides whether the church adopts it.

**The Sunday operator, age 14 to 70, briefed once.** Sits at the laptop and presses a key when the
song moves on. Rotates weekly, and may never have opened Stage before this morning. Cannot be
trained, so the control surface has to be obvious at a glance and impossible to break.

**Maria, administrator, non-technical.** Does not open Stage. She feels it, because the announcement
loop on the screens before the service is the one she typed into Hearth on Thursday.

**The production volunteer, where a church has one.** Runs the livestream, wants the lower third keyed
over camera, owns a Stream Deck, and is the only person in the building who knows what NDI is. Stage
must not require them, and must not insult them when they show up.

---

## 4. Settled decisions for Stage

| Decision | Choice | Why |
|---|---|---|
| Standalone | **Stage installs and presents without ever signing in to anything.** Offline, with no server of ours involved. | It competes with OpenLP and ProPresenter, which is where the users are. A presenter that needs a ChMS account has no users. |
| Pairing | Optional, additive, reversible. | Pairing is the upgrade that closes the loop. It is never the price of entry. |
| Price | Free, like the rest of Hearth. | Settled in the platform PRD section 2. No paid tier for Stage, ever. |
| Delivery | Electron desktop, macOS, Windows, Linux. | The output drives real displays, holds a video decode pipeline, and runs with the network off. |
| Offline | Offline always. The network is an optional extra. | The building's internet is not a Sunday dependency. |
| Library | Stage holds a real library. Songs are `local` or `hearth`, with one writer each (section 2). | Independence without a merge problem. |
| Song schema | The schema in the platform PRD section 9.4, through `packages/songs`, in both products. | A locally authored song promotes into Hearth as an insert. |
| Scripture | Public-domain translations bundled. Licensed text comes from a paired church's own licence. | We cannot redistribute the NIV, and pretending otherwise is a lawsuit. |
| Data direction | Stage reads plans and `hearth` songs. It writes usage and promotes `local` songs on request. | One writer per record, everywhere. |
| Licence | AGPL-3.0, same as the platform. | |
| Song content | Stage ships with no lyrics of any kind. | Lyrics are the church's CCLI responsibility. Bundling any would make them ours. |
| Telemetry | None beyond the usage a paired church asked for. | Carried from the platform's trust constraints. |

### Non-goals, stated so they stop coming back

Audio mixing. Lighting control. Video switching. Ableton and MultiTracks session playback. Internet
song search. A theme marketplace. Stage as a church's song database of record once it is paired.

**A slide editor as a design tool.** Typing a slide and choosing a theme is in (ST2.16). Dragging text
boxes around a canvas is out: it is how a free presenter ends up with a bad Keynote inside it, and how
every church's slides end up looking different from every other church's.

**Recording or streaming the output.** OBS is free, is better at it, and is already on the desk in
every church that streams. Stage's job is to be a well-behaved source into it (ST16.1, ST16.2).

**Masks and edge blending.** A church with a curved screen has a projector that does this in
hardware.

Those are separate products with separate hardware and separate audiences, and pretending otherwise is
how Stage never ships. A church that needs them already owns a mixer, a lighting desk, and a switcher,
and Stage is better used as one well-behaved source into those than as a bad imitation of them.

---

## 5. Release sequence

Six releases, labelled `S0.1` to `S1.0` so they are never confused with the platform's own versions.
Each is defined by what a church can do on a Sunday with it.

**S0.1 to S0.3 have no platform dependency whatsoever.** They are a complete standalone presenter and
can be built from end to end while the platform works through 0.2 and 0.3.

### S0.1 The slide

Internal, plus one church's midweek rehearsal.

The shared `packages/songs` domain, the local library with a song typed in by hand, the Electron shell
with a control window and one output window, lyric slides rendered from sections following an
arrangement sequence, one theme, text that fits the screen, and keyboard operation with no pointer.

**Exit criteria:** a worship leader types four songs into Stage and runs the set on a second display,
with the network off and the trackpad untouched. Nothing on the output has a visible seam, a cut-off
line, or a flash between slides.

### S0.2 The library

The release that makes Stage usable by a church that has never heard of Hearth.

Import from ProPresenter, EasyWorship, OpenLP, OpenSong and OpenLyrics. Library search, song and
arrangement editing, ChordPro charts. Bundled public-domain scripture with reference parsing and verse
splitting. Set lists built in Stage. A local usage log with a CCLI export.

**Exit criteria:** a church imports its 300 song ProPresenter library with section labels intact,
builds Sunday's set in Stage, runs it, and exports a CCLI usage report at the end of the period.

### S0.3 The room

What makes Stage a church's only presenter.

Stage display and confidence monitor, multi-output mapping with independent content per output, still
and video backgrounds with per-slide overrides, countdown timers and clocks, the pre-service
announcement loop, and crash recovery.

**Exit criteria:** one church runs four consecutive Sundays on Stage alone, with ProPresenter
uninstalled, including a deliberate mid-service process kill that recovers to the live slide inside
five seconds.

### S0.4 The plan

**The loop. The only release that needs the platform**, and the only reason Hearth owns a presenter at
all. Ready when platform 0.4 has shipped the song library and the sync API, and pulled forward the
moment it does.

Device pairing, delta sync, Hearth plans compiled into decks, plan notes addressed to a position,
scripture resolved under the church's own licence, the two-origin rule, local songs promoted into the
church library, and usage pushed back for the platform's CCLI report.

**Exit criteria:** a plan edited in Hearth on Saturday night is on the screen on Sunday morning
without anyone exporting a file, the whole service runs after the network cable is pulled out mid-set,
and the songs used appear in the platform's CCLI report on Monday.

### S0.5 The team

Everything that happens once more than one person is involved.

Remote control from a phone on the local network, hotkeys and macros, Stream Deck, MIDI and OSC, audio
and video as plan items, and props and overlays shown independently of the slide.

**Exit criteria:** the worship leader advances the set from a phone on stage while the operator holds
the laptop, and a Stream Deck button fires the correct cue with the laptop screen asleep.

### S1.0 The broadcast and the launch

Public launch of Stage.

NDI and alpha-keyed output, bilingual lyrics and caption output, theme and template editing, live
camera input, PowerPoint and Keynote import, signed and notarised builds for three operating systems,
and auto-update that will not touch a Sunday.

**Exit criteria:** a livestream carries a keyed lower third from Stage into OBS over NDI, and ten
churches have moved to Stage from a paid presenter, at least five of them without using Hearth.

### Beyond S1.0

Theme sharing between churches. Translation assistance. A touch-first tablet build of the control
surface. Rehearsal mode playing the reference track against the slides.

---

## 6. Domain 1. Install, identity, and pairing

| ID | Rel | Requirement |
|---|---|---|
| ST1.1 | S0.1 | **Stage opens and presents without signing in to anything.** First run reaches a usable library in under a minute. |
| ST1.2 | S0.1 | First run offers to import an existing library, and offers a sample song set for a church starting from nothing. The sample set is public domain. |
| ST1.3 | S0.4 | **Pairing by short code.** An admin generates a code in Hearth, the operator types it into Stage once, and Stage receives a device token and the church's identity. |
| ST1.4 | S0.4 | The pairing code is six characters from an unambiguous alphabet, single use, and expires in fifteen minutes. |
| ST1.5 | S0.4 | The device token is stored in the operating system keychain. It stays out of the cache directory and out of the logs. |
| ST1.6 | S0.4 | A paired device appears in the platform's device list with its name, platform, last sync time, and a **Revoke** control, beside the active session list (R1.10). |
| ST1.7 | S0.4 | A revoked or unpaired device **keeps its local library and keeps working.** Unpairing removes `hearth` songs and plans, and leaves every `local` song untouched. |
| ST1.8 | S0.4 | The device token is scoped: read on plans, songs, arrangements, scripture, and the team roster for synced services. Write on song usage and promoted songs. Nothing else, enforced server side. |
| ST1.9 | S0.1 | Stage names itself after the machine on first run, and the name is editable, because a church with three laptops needs to tell them apart. |
| ST1.10 | S1.0 | Multi-campus: a device pairs to one campus, and only that campus's services sync. |

*Accept ST1.1:* a clean install on a laptop with the wifi switched off reaches a presentable slide.

*Accept ST1.7:* unpairing a device mid-week leaves every song the church typed into Stage, and removes
the ones that came from Hearth.

*Accept ST1.8:* an adversarial suite calls every platform API path with a Stage device token, including
people, giving, and check-in, and every call outside the scope above is refused.

---

## 7. Domain 2. The library: presentations, songs and media

Stage's own library, which is what makes it a presenter rather than a viewer.

**Corrected, 1 October 2026.** This domain treated a song as the central object.
In every presenter a church actually uses, the central object is a
**presentation**: an ordered set of slides, of which a song is one kind. So is a
sermon outline, a notice, a title card, a reading and a video. A model that holds
only songs can present about a third of a Sunday, which is why ST2.16 exists and
why it sits in S0.1 ahead of everything else in this domain.

A song stays special, because its labelled sections and its arrangement sequence
are what let a paired church's plan become slides with no import step. It is
special **as a kind of presentation**. See [docs/parity.md](docs/parity.md) for
the inventory this correction came out of.

| ID | Rel | Requirement |
|---|---|---|
| ST2.1 | S0.1 | **A song is the schema in the platform PRD section 9.4**, held locally: title, authors, CCLI number, copyright line, themes, tempo, time signature, default key, and ordered labelled sections. |
| ST2.2 | S0.1 | **Lyrics are entered as labelled sections**, each with a type and a label, with lines kept as lines. A paste of a plain lyric block is offered a split into sections, and the operator confirms it. |
| ST2.3 | S0.1 | **Arrangements**: several per song, each with a name, key, tempo, and a sequence of section labels. One is default. |
| ST2.4 | S0.2 | Library search across title, alternate titles, author, lyrics, themes and CCLI number, returning in under 100ms at 2,000 songs. |
| ST2.5 | S0.2 | Edit and archive a `local` song. Archived songs leave the library view and keep their usage history. |
| ST2.6 | S0.2 | **ChordPro chart per arrangement**, with transposition to any key, by the same code the platform uses (R12.6). |
| ST2.7 | S0.2 | Reference audio and practice tracks attached to an arrangement, from the operator's disk. |
| ST2.8 | S0.2 | **Set lists built in Stage**: a named, dated, ordered running order of songs, scripture, and markers, which is what a standalone church presents from. |
| ST2.9 | S0.2 | A set list is duplicated from a previous week, carrying structure. |
| ST2.10 | S0.2 | **Local usage log**: every song presented, with date, set list, arrangement and key, and a last-used date on the song. A row is written when a song is actually shown rather than when a set list is opened, so the report reflects the service. |
| ST2.11 | S0.2 | **CCLI usage export** from the local log, in the format CCLI accepts, for a chosen period. Small churches get fined for failing this, and no free presenter does it. |
| ST2.12 | S0.2 | **Export the whole library** as OpenLyrics and as a Hearth-schema JSON bundle, ungated. A church leaving Stage takes its library, which is the same trust commitment the platform makes. |
| ST2.13 | S0.4 | Song origin is `local` or `hearth`, shown in the library, with `hearth` songs read-only in Stage (section 2). |
| ST2.14 | S0.4 | **Promote a `local` song into a paired church's Hearth library**, on the operator's action, one way, with a duplicate check against CCLI number and title first. |
| ST2.15 | S0.1 | Nothing in the library is reachable from the live presentation surface (ST12.3). |
| ST2.16 | S0.1 | **A presentation of plain slides.** A person types slides and they present: a title, three notices, a sermon outline, a blank. Each slide carries text and takes its look from a theme. This is the first thing somebody does with Stage, before any song exists. |
| ST2.17 | S0.2 | **A playlist item can be a presentation, a piece of media, a header, or a timer.** A service is not only songs and readings. |
| ST2.18 | S0.2 | Collections in the library, so two hundred presentations are findable by more than a search box. |
| ST2.19 | S0.2 | A note on a slide, separate from a note on an item, shown to the operator and to the stage display. |

*Accept ST2.2:* a song typed in with three verses, a chorus and a bridge, then exported and reimported,
comes back with the same section types, labels, and line breaks.

*Accept ST2.11:* a six month export lists every song presented, the number of uses, and the CCLI
number, and validates against CCLI's required columns. This is checked against the same fixture the
platform's R12.10 export is checked against, because the two must agree.

*Accept ST2.14:* promoting a song that already exists in the church library by CCLI number offers the
existing song rather than creating a second one.

---

## 8. Domain 3. Import and migration

The library a church already has is the only reason it cannot leave its current presenter. This is
the adoption path, and it is why it sits in S0.2 rather than at the end.

| ID | Rel | Requirement |
|---|---|---|
| ST3.1 | S0.2 | **Import song libraries from ProPresenter 6 and 7, EasyWorship, OpenLP, OpenSong, and OpenLyrics**, into Stage's local library. |
| ST3.2 | S0.2 | **Section types and labels survive the import**, because that is the whole point. A source with no section structure is imported, flagged, and listed for review. |
| ST3.3 | S0.2 | Import is a dry run with a report before it writes: how many songs, how many with sections, how many duplicates, what will be skipped. |
| ST3.4 | S0.2 | Import is **reversible for thirty days**, the same contract the platform's importers hold (R19.4). |
| ST3.5 | S0.2 | Duplicate handling on CCLI number, then on title and first line, with the operator choosing to skip, replace, or keep both. |
| ST3.6 | S0.2 | Media referenced by an imported library is matched on disk, listed where missing, and carried where found. |
| ST3.7 | S0.2 | A plain text or ChordPro file imports as one song. A folder imports as many. |
| ST3.8 | S1.0 | A PowerPoint or Keynote deck imports as a set list item of ordered slides, with no pretence of becoming a song. |
| ST3.9 | S1.0 | The importers are a shared package, so the platform's R20.10 importers and Stage's are the same code reading the same formats. |

*Accept ST3.2:* a 300 song ProPresenter 7 library imports with section labels intact on every song that
had them, and the report names every song that did not.

*Accept ST3.4:* an import of 300 songs is undone in one action thirty days later, leaving the songs that
were there beforehand untouched.

---

## 9. Domain 4. Pairing with Hearth, and sync

The loop. Additive, and the only domain that needs the platform.

| ID | Rel | Requirement |
|---|---|---|
| ST4.1 | S0.4 | **Delta sync by cursor.** Stage asks what changed since its last cursor and receives only that. A full pull happens once, on pairing. |
| ST4.2 | S0.4 | Synced entities: services and plans, plan items, songs, sections, arrangements, arrangement media metadata, resolved scripture text, themes, and the team roster for the service. |
| ST4.3 | S0.4 | Synced records live in a **separate, disposable store** from the local library, so a resync cannot touch a song the church typed in. |
| ST4.4 | S0.4 | **Stage is read-only on everything it pulls** (section 2). There is nothing to merge, and the church's library cannot diverge. |
| ST4.5 | S0.4 | Song usage and promoted songs are the only writes. Both are queued locally, carry a client-generated identifier, and are safe to retry. |
| ST4.6 | S0.4 | Sync runs on launch, on a timer while the network is up, and on demand from a visible control. |
| ST4.7 | S0.4 | **Sync never blocks the render path.** A sync in flight cannot delay a slide advance, and a failed sync cannot stop a service. |
| ST4.8 | S0.4 | The control surface shows the last successful sync, and says plainly when the plan on screen is older than the server's. |
| ST4.9 | S0.4 | Media syncs by content hash into the local cache, resumable, verified before use. A missing background degrades to the theme colour. |
| ST4.10 | S0.4 | **Pre-service prefetch** of the next seven days of services, so Sunday needs no network at all. |
| ST4.11 | S0.4 | Promoting a local song upward (ST2.14) is one way, on request, and never automatic. |
| ST4.12 | S0.4 | An archived song or plan is tombstoned and hidden, and is retained for the service in progress if it is live on screen. |
| ST4.13 | S1.0 | Export the synced cache and the library as a portable bundle, so a second laptop is prepared from a USB stick when a church has no usable wifi. |

*Accept ST4.1:* a sync after one song's lyrics changed transfers that song, and not the library.

*Accept ST4.3:* deleting the synced store and resyncing leaves every `local` song, every set list, and
the whole usage log intact.

*Accept ST4.7:* with the sync endpoint artificially held open for sixty seconds, advance latency is
unchanged against the ST21.1 budget.

*Accept ST4.10:* a laptop synced on Thursday, then left in a cupboard with no network, runs Sunday's
full service including backgrounds and scripture text.

---

## 10. Domain 5. The deck: set lists, plans, and cues

The deck is the service, compiled. It comes from a Stage set list or from a Hearth plan, and the
renderer cannot tell the difference.

| ID | Rel | Requirement |
|---|---|---|
| ST5.1 | S0.2 | **A set list opens as a deck**, in the order it was built. |
| ST5.2 | S0.1 | A song compiles to slides by resolving its arrangement's sequence against its labelled sections. `V1 C V2 C B C C` produces exactly those sections in that order, with repeats as separate cues. |
| ST5.3 | S0.4 | **A Hearth plan opens as a deck** with no building step, plan items in the order Maria and James put them in (R11.2). |
| ST5.4 | S0.2 | Non-presenting items, sermon, prayer, offering, announcements, appear as markers, so the operator's position in the deck matches the service's position in the room. |
| ST5.5 | S0.4 | **Plan notes are visible to the operator**, including the note addressed to their position (R11.6), on the control surface and the stage display. |
| ST5.6 | S0.1 | The deck shows the arrangement's key and tempo, and honours a per-item key override. |
| ST5.7 | S0.1 | **Reordering a cue during a service is local and temporary.** It affects this run, and never writes back to the set list or the plan. |
| ST5.8 | S0.2 | Add a song to the live deck from the library by typing, in under five seconds, because the leader calls one that is not in the set. |
| ST5.9 | S0.2 | Skip, repeat, and jump to any cue by label, so `C2` is reachable by typing it. |
| ST5.10 | S0.1 | Present a song, a scripture and a countdown with no set list open at all. |
| ST5.11 | S0.4 | **The plan changed while we were live.** An updated plan arrives as a named, dismissible offer, and never rewrites the deck under the operator's hands. |
| ST5.12 | S0.5 | Deck snapshot: the run as it happened, kept locally, so the second service reopens exactly as the first one went. |

*Accept ST5.2:* fifty fixture arrangements compile to golden expected decks, including sequences with
repeated labels and a sequence referencing a label the song does not have, which fails loudly at
compile time rather than silently at service time.

*Accept ST5.11:* with a plan change arriving mid-song, the live slide does not move, and the offer
waits.

---

## 11. Domain 6. Lyric rendering

Words on a wall, done properly. The bar is the back row of a dark room.

| ID | Rel | Requirement |
|---|---|---|
| ST6.1 | S0.1 | **One section is one or more slides**, split on line count against the theme's limit. A break falls between two lines. |
| ST6.2 | S0.1 | Text fits the safe area by measurement. A long line reduces the slide's size, and every slide in a section shares one size so the words do not jump between them. |
| ST6.3 | S0.1 | Section label and type are available to the renderer, so a theme shows `V1` on the confidence monitor and keeps it off the wall. |
| ST6.4 | S0.1 | Every glyph stays inside the safe area, with no clipped descender and no scrollbar. An automated render test verifies it. |
| ST6.5 | S0.1 | Transition is a cross-dissolve at a theme-set duration, defaulting to 200ms, GPU composited, with no flash of background. |
| ST6.6 | S0.1 | **Black, clear, and logo** are each one keypress, independent of deck position, and returning from them restores the exact slide. |
| ST6.7 | S0.3 | Per-slide override of size, alignment, and background, stored against this run. The song is untouched, which is also how a `hearth` song is adjusted. |
| ST6.8 | S0.2 | A slide is corrected live for a typo. On a `local` song the correction is offered to the library. On a `hearth` song it stays with the run. |
| ST6.9 | S1.0 | Two languages on one slide, primary and translation, from section-aligned translations (R12.8), with independent sizing. |
| ST6.10 | S1.0 | Right-to-left text, vertical centring, and a font fallback chain covering the scripts a church actually uses. |

*Accept ST6.2:* a section with one two-word line and one eighteen-word line renders both at the same
size, that size fits inside the safe area, and the longer line wraps to at most the theme's line limit.

*Accept ST6.4:* a render harness rasterises every slide in a 200 song fixture library at three output
resolutions and asserts no glyph crosses the safe area boundary.

---

## 12. Domain 7. Scripture

A standalone presenter has to carry its own bible. A paired one uses the church's licence.

| ID | Rel | Requirement |
|---|---|---|
| ST7.1 | S0.2 | **Bundled public-domain translations**, at least KJV, ASV and WEB, with their texts held locally and searchable. |
| ST7.2 | S0.2 | Parse a reference typed as a human types it, `Matt 5:1-12`, `John 3.16`, `Ps 23`, and resolve it from a bundled translation. |
| ST7.3 | S0.2 | **Automatic verse splitting** across slides, breaking at verse boundaries, with the reference on every slide of the passage. |
| ST7.4 | S0.2 | Verse numbers shown or hidden by theme setting. |
| ST7.5 | S0.2 | A passage typed in by hand, for a translation we cannot ship. |
| ST7.6 | S0.4 | A scripture plan item renders from the **platform's resolved text** (R11.5), which is how a paired church presents from a licensed translation it holds the rights to. |
| ST7.7 | S0.3 | Two translations side by side for one passage. |
| ST7.8 | S0.2 | **Licensed translations are never bundled and never fetched by us.** The reason is stated in the product where a church would look for the NIV. |
| ST7.9 | S1.0 | Caption output of the current passage, feeding ST17.3. |

*Accept ST7.3:* a nine verse passage splits at verse boundaries across the fewest slides that fit the
theme, every slide carries the reference, and no verse splits across two slides unless the verse alone
exceeds one slide, in which case it breaks at a sentence.

*Accept ST7.8:* searching Stage for a licensed translation explains in two sentences what is possible
and what pairing with Hearth changes.

---

## 13. Domain 8. Themes and templates

| ID | Rel | Requirement |
|---|---|---|
| ST8.1 | S0.1 | One built-in theme good enough to use unmodified on a Sunday. Typography, contrast and safe areas from the platform's design system. |
| ST8.2 | S0.1 | A theme is data: font family, weights, sizes as a proportion of output height, colour, alignment, safe area insets, line limit, shadow or outline for legibility over video, and transition duration. |
| ST8.3 | S0.3 | Separate themes per content kind: lyrics, scripture, announcement, title. Four looks is what a church will actually maintain. |
| ST8.4 | S0.3 | A theme is previewed at the real output resolution before it is used. |
| ST8.5 | S0.4 | Themes sync from a paired platform, so a church sets its look once and every laptop matches. |
| ST8.6 | S1.0 | Theme editing in Stage, with a live preview and a contrast check that refuses to save a lyric theme below the station floor of 7:1. |
| ST8.7 | S1.0 | Templates: a theme plus a background plus an overlay, saved as one named thing a church picks by name. |
| ST8.8 | S1.0 | Import a font the church owns, with the licence responsibility stated at the moment of import. |

*Accept ST8.1:* the default theme passes a 7:1 contrast measurement over its own background and over
all four bundled video loops, measured on the rendered frame rather than on token values.

---

## 14. Domain 9. Backgrounds and media

| ID | Rel | Requirement |
|---|---|---|
| ST9.1 | S0.1 | Solid colour and gradient backgrounds from the theme. |
| ST9.2 | S0.3 | Still image backgrounds from the operator's disk, scaled and cropped to the output without distortion. |
| ST9.3 | S0.3 | **Video loop backgrounds**, seamlessly looping, hardware decoded, holding frame rate at 1080p while text composites over them. |
| ST9.4 | S0.3 | A handful of bundled loops that look like a church room rather than a stock video site, licensed for redistribution under AGPL terms. |
| ST9.5 | S0.3 | A background is assigned per theme, per item, or per slide, and the most specific assignment wins. |
| ST9.6 | S0.5 | Audio and video as items in their own right, with duration, in and out points, and an end-of-item behaviour. |
| ST9.7 | S0.5 | Audio ducking is out of scope. Stage sets output device and level, and the sound desk owns the rest. |
| ST9.8 | S1.0 | Live camera input as a background layer, with device selection and a frozen fallback if the device disappears. |
| ST9.9 | S0.3 | A media file that is missing, corrupt, or in an undecodable codec fails to the theme colour. The control surface says what happened, and the output stays clean. |
| ST9.10 | S0.2 | **A media library.** Images, video loops and audio, added once, organised, and reusable from any presentation or playlist. Specified as a property of a theme beforehand, which meant finding the same file on disk every time somebody wanted it. |
| ST9.11 | S0.3 | Media is referenced by content hash, so a church reorganising its folders does not break last year's playlists. |

*Accept ST9.3:* a 30 second 1080p H.264 loop plays for three hours with no visible seam at the loop
point, no drift in memory use, and no dropped frames during a slide dissolve, on ST21.5 hardware.

*Accept ST9.9:* deleting a background file while it is on screen leaves the service running.

---

## 15. Domain 10. Outputs and screen mapping

| ID | Rel | Requirement |
|---|---|---|
| ST10.1 | S0.1 | One output window, fullscreen on a display picked by name and position rather than by index. |
| ST10.2 | S0.1 | The output window carries no chrome. The cursor is hidden, operating system notifications are suppressed, and the display is kept awake. |
| ST10.3 | S0.3 | **Several outputs, independent content per output.** The main screen shows lyrics while the foyer screen shows the announcement loop. |
| ST10.4 | S0.3 | Output configuration survives a display unplugged and replugged, matched by display identity, so the Sunday projector always lands on the same output. |
| ST10.5 | S0.3 | A display disappearing mid-service leaves Stage running, and the output reappears on reconnection with the live slide. |
| ST10.6 | S0.3 | Resolution, scaling and aspect handled explicitly, with letterboxing by choice. |
| ST10.7 | S0.3 | A test pattern per output showing safe areas, resolution and a contrast ramp, which is how an operator finds out the projector is clipping the edges before the service. |
| ST10.8 | S0.5 | Output groups: name a set of outputs and address them together. |
| ST10.9 | S0.3 | **Clear one layer at a time.** The words come off and the background stays. A prop comes off and the slide stays. One blank state cannot express how a presenter is operated. |
| ST10.10 | S0.3 | **A look per output**: which of background, media, slide, props and foreground is on. The projector runs lyrics over a background while the foyer runs the notices and the platform screen runs the stage display, each from its own look. |
| ST10.11 | S0.4 | A named look applied to every output at once, so "pre-service" and "during the sermon" are one keypress each. |

*Accept ST10.4:* unplugging the projector, restarting Stage, and plugging it back in restores the same
output to the same display with no reconfiguration.

---

## 16. Domain 11. Stage display and confidence monitor

The screen facing the platform. It is why the product is called Stage.

| ID | Rel | Requirement |
|---|---|---|
| ST11.1 | S0.3 | **Current slide, next slide, clock, and timer** on one screen, legible from twenty feet. |
| ST11.2 | S0.3 | Section label and the remaining sequence, so the leader knows a second chorus is coming. |
| ST11.3 | S0.3 | **Chords over lyrics**, transposed to the arrangement's key by the same `packages/songs` code the printed chart uses. |
| ST11.4 | S0.3 | Layout presets: lyrics and chords for the band, text and timer for the preacher, thumbnail and notes for the host. |
| ST11.5 | S0.3 | The stage display is one of the outputs in ST10.3, configured the same way. |
| ST11.6 | S0.4 | The plan note addressed to this position, and the global note, shown here (R11.6). |
| ST11.7 | S0.5 | A message sent to the stage display from the control surface or the remote, which is how a producer tells the preacher to wrap up. |
| ST11.8 | S0.5 | A timer counting down an item's planned duration, from the set list or the plan. |

*Accept ST11.3:* a chart in G displayed in B flat matches what the platform's printed chart produces
for the same arrangement, chord for chord, against the same fifty-chart fixture set as R12.6.

---

## 17. Domain 12. Live operation and control

The operator is sixteen and untrained. This domain is where that is either respected or ignored.

| ID | Rel | Requirement |
|---|---|---|
| ST12.1 | S0.1 | **Fully keyboard operable.** Next, previous, black, clear, logo, jump, and search, with no pointer. |
| ST12.2 | S0.1 | The control surface shows the live slide, the next slide, and the deck, and the live slide is unambiguous at a glance. |
| ST12.3 | S0.1 | **Nothing destructive is reachable during a service.** Delete, library editing, import, and theme editing are absent from the live surface. |
| ST12.4 | S0.1 | Advance is idempotent under key repeat: holding the key does not skip four cues. |
| ST12.5 | S0.2 | A set list or plan is chosen at launch, defaulting to the next one by date and time, so the common case is one keypress. |
| ST12.6 | S0.3 | The operator can see at all times what is live, what is next, whether the output is black, whether a paired sync is current, and what time it is. |
| ST12.7 | S0.3 | A confirm step on anything that interrupts the service, sized so it cannot be dismissed by the same key that advances a slide. |
| ST12.8 | S0.5 | Hotkey customisation, with the defaults printable on one side of a card. |
| ST12.9 | S0.5 | Macros: one trigger firing several actions, for example black the main output, show the lower third, start the timer. |
| ST12.10 | S0.1 | **Operator brief**: a one-screen card inside Stage saying what the four keys do. It is what the sixteen year old reads at 10:28. |
| ST12.11 | S0.3 | **Messages.** Live text typed and shown over whatever is on screen, with named fields for the things a church sends twice a year. It is how somebody is told their car is being towed, and it never touches the deck. |
| ST12.12 | S0.3 | A transition set per slide as well as per theme, because a title card and a verse want different ones. |
| ST12.13 | S0.5 | Text revealed a line at a time, limited to that. Motion clarifies, and a lyric that flies in from the left does not. |

*Accept ST12.1:* a full service is run with the trackpad physically disconnected.

*Accept ST12.4:* holding advance for two seconds advances one cue per keypress event with no repeat
acceleration, asserted on the cue index.

---

## 18. Domain 13. Timers, clocks, and loops

| ID | Rel | Requirement |
|---|---|---|
| ST13.1 | S0.3 | **Countdown to a time of day**, which is what a pre-service countdown actually is, surviving a restart because it is anchored to the clock. |
| ST13.2 | S0.3 | Countdown of a duration, with start, pause, reset, and an end behaviour. |
| ST13.3 | S0.3 | A clock output for the stage display and the foyer. |
| ST13.4 | S0.3 | **Announcement loop**: slides rotating with a dwell time, on any output, running while the main output does something else. |
| ST13.5 | S0.4 | The loop is built from a paired church's announcements and plan items, so Maria's Thursday typing reaches the foyer screen with nobody rebuilding it. |
| ST13.6 | S0.5 | A loop item is a still, a video, or a slide, mixed in one rotation. |
| ST13.7 | S0.3 | A countdown reaching zero leaves the service alone. A human starts the service. |

*Accept ST13.1:* a countdown to 10:30 restarted at 10:27 resumes showing three minutes, having been
told nothing.

*Accept ST13.5:* an announcement added in Hearth appears in the next pre-service loop with no action in
Stage beyond a sync.

---

## 19. Domain 14. Remote control

| ID | Rel | Requirement |
|---|---|---|
| ST14.1 | S0.5 | **Control from a phone or tablet on the local network**, in a browser, with no app install. |
| ST14.2 | S0.5 | Pairing by a code shown on the control surface, over the local network. Our servers are out of the path. |
| ST14.3 | S0.5 | The remote shows live slide, next slide, the deck and the notes, and advances, reverses, blacks and jumps. |
| ST14.4 | S0.5 | Two controllers stay consistent: the leader on stage and the operator at the desk see the same live cue. |
| ST14.5 | S0.5 | The remote is `portal` density from the design system, usable one handed, with targets a guitarist can hit without looking. |
| ST14.6 | S0.5 | Losing the remote's wifi leaves the laptop's control unaffected, and the remote reconnects to current state. |
| ST14.7 | S1.0 | A view-only remote for the preacher and the host, showing notes and the timer. |

*Accept ST14.4:* with two remotes and the laptop open, advancing from any one moves all three within
300ms on a congested church wifi.

---

## 20. Domain 15. Integrations and triggers

| ID | Rel | Requirement |
|---|---|---|
| ST15.1 | S0.5 | Stream Deck support, as a plugin or as keyboard emulation, with cue, black and macro buttons. |
| ST15.2 | S0.5 | MIDI in and out, for triggers from a keyboard or a show controller. |
| ST15.3 | S0.5 | OSC in and out, documented, with every address listed. |
| ST15.4 | S0.5 | An outbound trigger on cue change, so a lighting desk or a switcher follows Stage. |
| ST15.5 | S1.0 | A documented local HTTP control API, which is also what the remote uses, so a church that wants to script Stage can. |
| ST15.6 | S0.5 | Every integration is off by default, and none is required for a service. |

*Accept ST15.6:* a clean install with no integration configured runs a full service, and no integration
failure can block a cue advance.

---

## 21. Domain 16. Broadcast output

| ID | Rel | Requirement |
|---|---|---|
| ST16.1 | S1.0 | **NDI output** per output group, so OBS and the switcher receive Stage without a capture card. |
| ST16.2 | S1.0 | **Alpha-keyed output**, lyrics and lower thirds over transparency, which every streaming church asks for and no free presenter does well. |
| ST16.3 | S1.0 | A separate theme for the keyed output, because lyrics sized for a projector are wrong over camera. |
| ST16.4 | S0.5 | Lower-third and prop mode: a region with its own content, shown independently of the main slide. |
| ST16.5 | S1.0 | NDI failing to initialise degrades to no NDI, and leaves Stage starting normally. |

*Accept ST16.2:* a keyed NDI source composited over camera in OBS shows antialiased text edges with no
dark fringe, verified on a frame capture.

---

## 22. Domain 17. Multi-language and captions

| ID | Rel | Requirement |
|---|---|---|
| ST17.1 | S1.0 | Bilingual lyric slides from section-aligned translations (R12.8), rendered as a join rather than as a second song. |
| ST17.2 | S1.0 | A second output carrying a different language from the main output, for a congregation that splits. |
| ST17.3 | S1.0 | Caption output of the current slide's text, as an NDI or local HTTP stream, for the livestream's caption track. |
| ST17.4 | S0.1 | Stage's interface is translated from `packages/i18n`, the same catalogue as the platform, with every string externalised from Stage's first commit. |

*Accept ST17.1:* a song with English and Spanish sections renders both on one slide, section aligned,
with neither language overflowing, and a section missing a translation renders the primary alone rather
than an empty half.

---

## 23. Domain 18. Reporting back to a paired platform

| ID | Rel | Requirement |
|---|---|---|
| ST18.1 | S0.4 | **Song usage pushed back** as `SongUsage` rows with song, arrangement, key used, service and date, with `source = stage` (the platform PRD section 9.4). |
| ST18.2 | S0.4 | Pushed usage carries the same rule as the local log in ST2.10: written when a song was shown, so the platform's report reflects the service rather than the intention. |
| ST18.3 | S0.4 | Usage queued offline is pushed on reconnect, idempotently, and a double push does not double count. |
| ST18.4 | S0.4 | A song added live and absent from the plan is still reported, because that is exactly the usage a church forgets and gets fined for. |
| ST18.5 | S0.5 | Run telemetry for the plan's revision history: what ran, in what order, and how long each item actually took, against R11.3's planned durations. |
| ST18.6 | S0.4 | **No other data leaves Stage.** What a church sings is its own business, and the platform's trust constraints carry here unchanged. |
| ST18.7 | S0.2 | An unpaired Stage keeps the same usage log locally and exports it itself (ST2.11), so the CCLI obligation is met with or without Hearth. |

*Accept ST18.1:* a service run with the network off appears in the platform's CCLI export for the period
after the laptop reconnects, with the correct key.

---

## 24. Domain 19. Reliability, recovery, and updates

| ID | Rel | Requirement |
|---|---|---|
| ST19.1 | S0.3 | **Crash recovery to the live slide in under five seconds**, including output configuration and timer state. |
| ST19.2 | S0.3 | The live cue pointer is persisted on every change, so recovery needs no guessing. |
| ST19.3 | S0.3 | A renderer process crashing takes out one output, which is restarted automatically, and leaves the others running. |
| ST19.4 | S0.3 | Stage starts with a corrupt synced cache by rebuilding it. **The local library is a separate store and is never rebuilt from the network**, so it survives. |
| ST19.5 | S0.3 | The local library is backed up on every write, with a restore inside Stage, because for a standalone church this is the only copy. |
| ST19.6 | S0.4 | Stage starts with no network, an expired token, and a stale cache, and runs the service it has. **This is the primary failure case and it is tested every release.** |
| ST19.7 | S1.0 | Auto-update downloading in the background, applied on the operator's say-so, and **never prompting or applying inside a Sunday window**, matching the platform's deploy rule (N5). |
| ST19.8 | S1.0 | The previous version is kept and rolled back to from inside Stage, because an update that breaks Sunday has to be undoable by a volunteer. |
| ST19.9 | S0.3 | A local diagnostic log the operator can send, scrubbed of lyrics, names, and the device token. |
| ST19.10 | S1.0 | Signed and notarised builds for macOS, signed for Windows, AppImage and deb for Linux. An unsigned build is not shipped to a church. |

*Accept ST19.1:* `kill -9` during a live song, then relaunch, shows the same slide on the same output
inside five seconds, measured ten times.

*Accept ST19.5:* deleting the library database and restoring from the automatic backup returns every
song, arrangement, set list, and usage row.

---

## 25. Domain 20. Accessibility and legibility

Two different jobs. The control surface is a user interface. The output is a sign read from the back of
a dark room.

| ID | Rel | Requirement |
|---|---|---|
| ST20.1 | S0.1 | The control surface meets WCAG 2.2 AA, audited in CI, the same bar as the platform (R22.7). |
| ST20.2 | S0.1 | Full keyboard operation with a visible focus ring that is never removed, carried from the design system. |
| ST20.3 | S0.3 | The control surface is `office` density, the stage display `station`, the remote `portal`, with no fourth density mode invented for Stage. |
| ST20.4 | S0.1 | **Output legibility floor:** lyric cap height at or above 4% of output height, body weight at or above 400, and measured contrast at or above 7:1 against the rendered background. A theme below the floor cannot be saved. |
| ST20.5 | S0.3 | Motion respects the operating system's reduced motion setting on the control surface. The output's dissolve is content, and the theme sets it. |
| ST20.6 | S1.0 | Caption output (ST17.3) is the accessibility answer for the congregation, and is documented as such. |

*Accept ST20.4:* an automated audit rasterises the default theme over every bundled background and fails
the build if any sampled text region falls below 7:1.

---

## 26. Domain 21. Non-functional requirements

| ID | Requirement |
|---|---|
| ST21.1 | **Slide advance under 100ms** from key event to pixels changed on the output, by frame capture, at the 99th percentile. |
| ST21.2 | **Cold start to the first slide of the next service in under ten seconds** on reference hardware. |
| ST21.3 | Runs indefinitely with no network. Sync is the only thing that degrades, and only for a paired church. |
| ST21.4 | Crash recovery inside five seconds (ST19.1). |
| ST21.5 | **Reference hardware is a 2019 laptop**: four cores, 8GB, integrated graphics, 1080p output. That is what is on the church's media desk, and performance is measured there. |
| ST21.6 | 1080p60 output with a video background and a text dissolve, with no dropped frames, on reference hardware. |
| ST21.7 | No memory growth across a three hour session with video backgrounds, asserted by a soak test. |
| ST21.8 | **No network call in the render path.** An architectural test enforces it. |
| ST21.9 | Every user-facing string externalised into `packages/i18n` from Stage's first commit (R22.8). |
| ST21.10 | A library of 2,000 songs and 500 set lists with search under 100ms. |
| ST21.11 | Installer under 150MB per platform, and Stage's disk use visible and bounded. |
| ST21.12 | Stage contains no telemetry beyond ST18.x, and crash reporting transmits only on the operator's action. |

---

## 27. Traceability to the platform PRD section 8.23

| Outline | Subject | Delivered by | Release |
|---|---|---|---|
| S1 | Sync and cache, then run with no network | ST4.x, ST19.6 | S0.4 |
| S2 | Render from R12.4 sections following the R12.5 sequence | ST5.2, ST6.1 to ST6.6 | S0.1 |
| S3 | Themes, templates, styling, safe areas, per-slide overrides | ST8.x, ST6.7 | S0.1 to S1.0 |
| S4 | Backgrounds: still, video loop, live camera | ST9.2, ST9.3, ST9.8 | S0.3, S1.0 |
| S5 | Scripture slides, translations, verse splitting | ST7.x | S0.2 |
| S6 | Announcement loops and pre-service rotations | ST13.4 to ST13.6 | S0.3 |
| S7 | Countdown timers and clocks | ST13.1 to ST13.3 | S0.3 |
| S8 | Stage display and confidence monitor | ST11.x | S0.3 |
| S9 | Multi-screen output mapping, independent content | ST10.3 to ST10.8 | S0.3 |
| S10 | NDI and alpha-keyed output | ST16.x | S1.0 |
| S11 | Audio and video playback as items | ST9.6, ST9.7 | S0.5 |
| S12 | Props and overlays, independent of the slide | ST16.4, ST10.8 | S0.5 |
| S13 | Hotkeys, macros, MIDI, OSC, Stream Deck | ST12.8, ST12.9, ST15.x | S0.5 |
| S14 | Remote control from a phone or tablet | ST14.x | S0.5 |
| S15 | Bilingual output and captions | ST17.x | S1.0 |
| S16 | Import from the five presenters | ST3.x | S0.2 |
| S17 | Report song usage back to the platform | ST18.x | S0.4, local export S0.2 |
| S18 | Crash recovery within five seconds | ST19.1 to ST19.3 | S0.3 |

**Two outline items moved release in draft 2.** S16, import, came forward from S1.0 to S0.2, because a
standalone presenter with no way to load an existing library has no users. S1, sync, moved from S0.2 to
S0.4, because it is additive rather than foundational.

---

## 28. What pairing adds, and what the platform owes it

**S0.1 to S0.3 need nothing from the platform board.** S0.4 is the only release that does, and it needs
two things, both already Phase 1 requirements in platform release 0.4.

1. **The song schema** (R12.1 to R12.7, R12.9, the platform PRD section 9.4). Stage uses it locally from its first
   commit, which means the schema is exercised by a real renderer before the platform's own screens
   are built. If it is wrong, Stage finds out first, which is worth something.
2. **The sync contract** (R11.14, R12.13), specified in full in
   [docs/hearth-sync-contract.md](docs/hearth-sync-contract.md), including the six server-side pieces
   platform 0.4 has to carry.

Stage owes a paired platform the usage rows that make the CCLI export honest, and the songs an operator
chooses to promote. Nothing else.

**Nothing in this document may change Phase 1 scope.** Where building Stage shows the contract needs a
field, that is a change to the contract document, raised as a platform story with a requirement ID, and
taken through the platform board.

### One correction owed to PRD.md

[the platform PRD, section 9.6](https://github.com/boluwaji11/ChurchManagement/blob/main/PRD.md) reads "Stage is a client of a versioned sync API, not a second application
with a second database." Draft 2 contradicts it: Stage holds a real library of its own, and sync is one
of two ways songs get into it. PRD.md is the platform board's file, so the line is corrected there
rather than here. The replacement is in section 2 of this document.

---

## 29. Risks

| Risk | Severity | Response |
|---|---|---|
| Standalone scope swallows the release | High | Domains 2 and 3 are the added cost and they are confined to S0.2. The library is song entry, search, set lists, and importers. It is deliberately not a planning tool. |
| Two origins become a merge problem anyway | High | Section 2's rule: one writer per record, run overrides for everything else, promotion one way and by hand. Any requirement that would need a merge is refused. |
| Licensed scripture disappoints a church | Medium | ST7.8 states it in the product, where a church would look for it. Pairing is the answer, and it is also the honest one. |
| Electron performance on reference hardware | High | ST21.5 names the hardware. ST21.1 and ST21.6 are measured budgets with tests from S0.1, so a miss is a defect rather than a tuning exercise. |
| Video and codec reality across three operating systems | Medium | ST9.9 degrades to a colour, so a codec problem is cosmetic. |
| Being judged as the nineteenth free presenter | High | S0.2 has to be genuinely better than OpenLP at the things OpenLP does, on import fidelity, typography, and not crashing. S0.4 is the part nobody can copy. |
| Scope creep from the production volunteer | Medium | The non-goals in section 4 are settled. NDI and alpha key are in, mixing and lighting are out. |
| An operator breaking a service by pressing the wrong key | High | ST12.3 and ST12.7. The live surface has nothing destructive in it. |
| The local library is the only copy and a laptop dies | High | ST19.5 backup and restore, ST2.12 ungated export. A paired church also has the platform. |
| Two windows of work colliding in one repository | Medium | File ownership in [BACKLOG.md](BACKLOG.md). Stage owns `apps/stage` and `packages/songs`. |
