# Hearth Stage, user journeys

What a person does inside the application, in the order they do it, from opening
it for the first time to running a Sunday.

[PRD.md](../PRD.md) says what Stage must do and [BACKLOG.md](../BACKLOG.md) says
when each piece gets built. This document is the join: it is how we check that
the stories add up to something a church can use.

**State** says what is true today, 1 October 2026. It is the honest column.

> **Rewritten.** The first version of this document was organised around songs:
> importing them, typing them in, building a set out of them. That was wrong.
> Songs are one kind of thing Stage presents, and a journey that starts with a
> song library describes a song database rather than a presenter. These journeys
> start where the person starts, which is an empty application and a screen.

---

## The application, in one picture

```
   LIBRARY                PLAYLIST                 LIVE
   ───────                ────────                 ────
   presentations          this Sunday's order      what is on each screen now
                                                   ┌──────────────────────┐
   ┌─────────────┐        1  Countdown             │ foreground   props   │
   │ song        │   ──►  2  Welcome        ──►    │ slide        text    │
   │ scripture   │        3  Holy, Holy...         │ background   media   │
   │ slides      │        4  Notices              └──────────────────────┘
   │ media       │        5  Psalm 23                 one LOOK per output
   └─────────────┘        6  Sermon
                          7  Closing song          main screen   stage display
   media: images,         8  Blank                 foyer screen  livestream
   video, audio
                                                   MESSAGES and PROPS go over
   themes: how a          dropped in live:         the top without touching
   slide looks            a song called from       the deck
                          the floor
```

Three things in that picture are the whole product.

**A presentation is an ordered set of slides**, and a song is one kind of
presentation. So is a sermon outline, a notice, a title card and a video. A model
that only held songs could present a third of a Sunday.

**A look decides which layers are on, per output.** Clearing the words leaves the
background. A prop sits over a video. The foyer screen runs its own look while
the main screen runs lyrics. This is how a presenter is actually operated.

**The playlist can arrive from somewhere else.** For a church that uses Hearth,
Sunday's order is already built by the person who planned the service, and it
reaches the laptop with no export and no file carried across the room. No other
presenter can do that.

---

## J1. The first ten minutes

**Who:** James, worship leader, 34, volunteer, four hours a week. He has
downloaded Stage because he is tired of paying for ProPresenter himself. He has
not read anything.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Opens Stage. It presents without signing in to anything. | ST1.1 | Shell built, installer is STG-138 |
| 2 | The window says what to do first, in one line, and gives him three ways in: make a slide, open a song, or import what he already has. | ST1.2 | STG-149 |
| 3 | Plugs in the projector. Stage finds it, names it, and shows a test pattern with the safe area on it so he can see the edges are being clipped. | ST10.1, ST10.7 | Output built, test pattern STG-66 |
| 4 | **Types a title slide.** "Welcome to Grace Community". It appears on the wall, fitted to the screen, legible from the back. | ST2.16 | **STG-145** |
| 5 | Adds two more slides to it: the notices. Presses the arrow keys and they advance. | ST2.16 | **STG-145** |
| 6 | Blacks the screen. Presses the key again and the slide comes back. | ST6.6 | Built |
| 7 | Decides it is good enough to use on Sunday, and has not opened a manual. | | |

**The test of this journey:** from download to words on a wall in under five
minutes, with no account and no network, and without reading anything. Note that
nothing in it involves a song.

---

## J2. The first Sunday

**Who:** the Sunday operator. Sixteen years old this week, on a rota. Opened
Stage once, three weeks ago.

**The design case: 10:28.** The service starts at 10:30. The laptop is on
battery, driving a projector through a 2017 adapter, on wifi that drops. The
order changed on Thursday. Nobody is free to help.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Opens Stage. Sunday's playlist is already the one offered, because it is the next by date. One keypress. | ST12.5 | STG-48 |
| 2 | Reads the six keys along the bottom of the window. That is the whole of the training. | ST12.10 | Built |
| 3 | Starts the countdown to 10:30. It is anchored to the clock, so restarting Stage resumes it correctly. | ST13.1 | STG-73 |
| 4 | Presses space when the band starts. The slide cross-dissolves. | ST6.5 | Built |
| 5 | Can see at a glance what is live, what is next, whether the screen is covered, and the time. | ST12.6 | Built |
| 6 | The leader repeats the chorus a third time. One press of the back key. | ST5.9 | Built |
| 7 | **The leader calls a song that is not in the playlist.** Types three letters, it is in the deck, and the service carries on. | ST5.8 | STG-49 |
| 8 | Walks into the sermon. The screen goes to the background and the deck row says so, so they keep their place in the service. | ST5.4, ST10.9 | Built, layers STG-160 |
| 9 | Somebody's car is being towed. Types it as a **message** and it appears as a lower third over whatever is on screen, then goes. | ST12.11 | **STG-159** |
| 10 | Cannot delete a presentation, edit the library or change a theme, because none of it is reachable from here. | ST12.3 | Built |

**The test of this journey:** a full service, run by somebody handed the laptop
five minutes earlier, with the trackpad physically disconnected.

---

## J3. Setting up the room, once

**Who:** whoever in the church is willing. It is done once and then forgotten.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Three displays: the projector, a screen facing the platform, and one in the foyer. Stage lists them by name. | ST10.1 | Built |
| 2 | Assigns each a **look**: the projector gets background and slide, the foyer gets the announcement rotation, the platform screen gets the stage display. | ST10.10 | **STG-160** |
| 3 | The band's screen shows the current slide, the next one, the rest of the sequence, chords in the right key, a clock and a timer. | ST11.1 to ST11.4 | STG-59 to STG-62 |
| 4 | Picks one of three stage display layouts rather than designing one. | ST11.4 | STG-62 |
| 5 | Somebody unplugs the projector during the week. It comes back on the same output with no reconfiguration. | ST10.4 | STG-64 |

---

## J4. Building Sunday, on a Thursday evening

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Opens last Sunday's playlist and duplicates it, keeping the shape and dropping the content. | ST2.9 | STG-47 |
| 2 | Drops in four songs, a reading, the sermon as a header, and the notices. | ST2.8, ST2.17 | STG-46, STG-154 |
| 3 | Drops a song a tone because the congregation cannot reach it. The chart transposes with it. | ST2.6, ST5.6 | Built |
| 4 | Types `Psalm 23:1-6`. It resolves from the bundled text, with no internet. | ST7.1, ST7.2 | STG-55, STG-56 |
| 5 | Picks a video loop out of the **media library** for the pre-service countdown, rather than finding the file on disk again. | ST9.10 | **STG-151** |
| 6 | Adds a note to the sermon item for whoever is operating. | ST5.5 | STG-100 |

---

## J5. Bringing the old library across

**Who:** James, who has 300 songs in ProPresenter and is not retyping them.

This is the journey that decides whether a church can leave. It is a one-time
move away from the old product rather than any kind of ongoing dependency, and it
is in S0.2 rather than at the end because a presenter that cannot read an
existing library has no users.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Points Stage at the old library. ProPresenter, EasyWorship, OpenLP, OpenSong or OpenLyrics. | ST3.1 | STG-33 to STG-36 |
| 2 | Stage reports before it writes: how many songs, how many kept their section structure, how many look like duplicates. | ST3.3 | STG-38 |
| 3 | The ones that arrived without structure are listed for review, so they are a known problem rather than a surprise on a Sunday. | ST3.2 | STG-33 to STG-36 |
| 4 | Media the old library referenced is matched on disk, and what is missing is named. | ST3.6 | STG-41 |
| 5 | A week later, undoes the whole import. | ST3.4 | STG-40 |

---

## J6. The church starts using Hearth

**Who:** Maria, the administrator, who will never open Stage.

This is the journey that makes Stage worth building rather than being the
nineteenth free presenter.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Maria makes a six character pairing code in Hearth. James types it into Stage once. | ST1.3 | STG-88, waiting on the platform |
| 2 | Sunday's **playlist is already there**, in the order the person who planned the service put it in. Songs, readings, the sermon, the notices. | ST5.3 | STG-99 |
| 3 | The keys are the ones the leader set. The scripture is the translation the church holds a licence for. | ST5.6, ST7.6 | STG-101 |
| 4 | The notices on the foyer screen are the ones Maria typed on Thursday. Nobody rebuilds them. | ST13.5 | STG-102 |
| 5 | The note addressed to Drums shows to the person on drums, and not to anybody else. | ST5.5 | STG-100 |
| 6 | Songs that came from Hearth are read-only here. The ones James typed in stay his, and he can push them up to the church library once, by choosing to. | ST2.13, ST2.14 | STG-93, STG-98 |

**The test of this journey:** a plan edited in Hearth on Saturday night is on the
screen on Sunday morning, and the service still runs after the network cable is
pulled out mid-set.

---

## J7. The order changes at 10:15

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | James reorders two songs from his phone, in Hearth, from the car park. | | Platform |
| 2 | Stage notices and offers the change as a named card. | ST5.11 | STG-103 |
| 3 | The operator is mid-song. **The live slide does not move.** The offer waits. | ST5.11 | STG-103 |
| 4 | Between items they accept it. The deck recompiles and stays on the same slide, because a cue is identified by its section and its repeat rather than by a number. | ST5.11 | Built |

---

## J8. When it goes wrong

The journey nobody asks about and every church eventually has. It decides whether
Stage is still in use a year later.

| What goes wrong | What Stage does | Req | State |
|---|---|---|---|
| The wifi dies mid-service | Nothing changes. It was all on disk before the service started. | ST21.3 | By design |
| Stage is killed during a song | Comes back to the live slide inside five seconds, with its outputs and timers. | ST19.1 | STG-76 |
| One output window crashes | That screen restarts. The others keep running. | ST19.3 | Built |
| The projector is unplugged | Stage stays up. The output returns on the live slide. | ST10.5 | STG-64 |
| A video file is missing | The slide falls back to the theme colour. The control surface says what happened and the wall says nothing. | ST9.9 | STG-71 |
| The library file is lost | Restored from the automatic backup: every slide, section, arrangement and chart. | ST19.5 | Built |
| An update breaks Sunday | Rolled back from inside Stage, by a volunteer. Updates never apply inside a Sunday window. | ST19.7, ST19.8 | STG-139, STG-140 |
| The laptop is unpaired, or revoked | Keeps everything local and keeps running the service in progress. | ST1.7 | STG-90 |

---

## J9. The livestream

**Who:** the production volunteer, who owns a Stream Deck and knows what NDI is.
Stage must not require them and must not insult them.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Turns on NDI. OBS sees Stage with no capture card. | ST16.1 | STG-126 |
| 2 | Uses an alpha-keyed output so the words key over camera with clean edges. | ST16.2 | STG-127 |
| 3 | Gives that output its own theme and its own look, because words sized for a projector are wrong over a face. | ST16.3, ST10.10 | STG-128, STG-160 |
| 4 | Binds one Stream Deck button to black the main screen and show the lower third together. | ST12.9 | STG-112, STG-113 |

---

## J10. January

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Every song actually shown was logged when it went on the screen, with its date, key and arrangement. | ST2.10 | STG-52 |
| 2 | Including the one called from the floor that was never in the playlist, which is exactly the usage a church forgets. | ST18.4 | STG-105 |
| 3 | Exports the period in the format CCLI accepts. | ST2.11 | STG-53 |
| 4 | A paired church finds it already in Hearth, because Stage pushed it. | ST18.1 | STG-105 |

---

## What these journeys changed

Rewriting them around the application rather than around songs found four gaps,
now stories on the board and set out in [parity.md](parity.md):

- **J1 step 4 was impossible.** A person could not type a slide. Only a song.
  That is PRD domain 2 rewritten and stories STG-145 to STG-149.
- **J2 step 9 was impossible.** No way to put live text over whatever is on
  screen. Now STG-159.
- **J3 step 2 was impossible.** No concept of what is on each output beyond one
  blank state. Now PRD domain 10 and stories STG-160 to STG-162.
- **J4 step 5 was clumsy.** Media was a property of a theme or an item, so the
  same video had to be found on disk every time. Now STG-151 to STG-153.

**J1 and J2 are the journeys that have to be perfect.** They are also the two
with the least in them, and everything in S0.1 and S0.2 serves one of them.
