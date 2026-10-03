/**
 * The English catalogue. Every string Stage puts on a screen.
 *
 * Keys are `area.thing`, flat rather than nested, because a flat file greps and
 * a nested one does not, and because a translator reading this top to bottom
 * should be able to tell which window a line belongs to.
 *
 * Plural forms are separate keys suffixed with a CLDR category: `.one`,
 * `.other`, and whatever else a locale needs. Intl.PluralRules picks.
 *
 * Rules for writing a line here, the same as everywhere else: no em dashes,
 * plain and concrete, and no explanatory padding. A label is a label, and the
 * only sentence on a screen is a destructive confirmation saying what happens.
 */
export const en = {
  // The window that presents
  "control.home": "Home",
  "control.slides": "Library",
  "control.plans": "Presentation Plans",
  "control.start": "Start",
  "control.deck": "Deck",
  "control.stage": "What is live",
  "control.problems": "Problems with this service",
  "control.live": "Live",
  "control.next": "Next",
  "control.notes": "Notes",
  "control.notes.none": "None",
  "control.notes.here": "this slide",
  "control.nothingOnScreen": "Nothing on the screen",
  "control.endOfService": "End of the service",
  "control.setList": "Stage set list",
  "control.hearthPlan": "Hearth plan",
  "control.cues.one": "{count} cue",
  "control.cues.other": "{count} cues",
  "control.separator": "  ·  ",

  // First run, the three ways in
  "start.name": "Hearth Stage",
  "start.plans": "Presentation Plans",
  "start.library": "Library",
  "start.settings": "Settings",
  "fix.open": "Correct the slide",
  "fix.words": "Words",
  "fix.apply": "Put it on the screen",
  "fix.keep": "Keep it in the library",
  "fix.kept": "Kept in the library",
  "fix.run": "This run only",
  "jump.open": "Go to",
  "jump.label": "Label",
  "jump.nothing": "No cue by that name",
  "keys.jump": "G",
  "keys.jump.meaning": "Go to a cue by its label",
  "call.open": "Add a song",
  "call.nothing": "Nothing by that name",
  "call.added": "{title} is next",
  "keys.call": "A",
  "keys.call.meaning": "Add a song the leader called",
  "start.today": "Today",
  "start.tomorrow": "Tomorrow",
  "nav.back": "Back",

  // What the output is doing
  "status.onScreen": "On screen",
  "status.black": "Black",
  "status.cleared": "Cleared",
  "status.logo": "Logo",
  "status.output": "{name}: {display}",
  "status.problems.one": "{count} problem",
  "status.problems.other": "{count} problems",

  // The keys, which is what the operator reads at 10:28
  "keys.next": "Space  or  \u2192",
  "keys.next.meaning": "Next",
  "keys.next.also": "Down arrow, or Page Down",
  "keys.back": "\u2190",
  "keys.back.meaning": "Back",
  "keys.back.also": "Up arrow, or Page Up",
  "keys.first": "Home",
  "keys.first.meaning": "Back to the first cue",
  "keys.black": "B",
  "keys.black.meaning": "Black the screen",
  "keys.clear": "C",
  "keys.clear.meaning": "Clear the words",
  "keys.logo": "L",
  "keys.logo.meaning": "Logo",
  "keys.escape": "Esc",
  "keys.escape.meaning": "Back to the slide",
  "keys.brief": "?",
  "keys.brief.meaning": "What the keys do",

  // The operator brief (STG-27, ST12.10)
  "brief.title": "Shortcuts",
  "brief.open": "Shortcuts",
  "card.close": "Close",

  // What an operator does to a cue during a service (STG-24)
  "run.up": "Move up",
  "run.down": "Move down",
  "run.skip": "Skip this run",
  "run.unskip": "Put it back",
  "run.repeat": "Sing it again",
  "run.drop": "Take the repeat away",
  "run.reset": "Back to the plan",

  // Putting something else on the screen while a service is running (STG-25)
  "present.replace.title": "Put {item} on the screen?",
  "present.replace.detail": "{service} comes off the screen. Nothing in it changes.",
  "present.replace.confirm": "Put it on the screen",
  "present.replace.keep": "Keep the service",

  // The clock before a service starts (STG-26)
  "countdown.label": "Countdown",
  "countdown.minutes": "{count} min",
  "countdown.stop": "Stop",
  "countdown.add": "{count} more",
  "countdown.left": "Time left",

  // What is wrong with a service, said so somebody can act on it
  "problem.anItem": "An item",
  "problem.named": "“{item}”",
  "problem.notInLibrary": "{item} is not in the library",
  "problem.noWords": "{item} has no words to put on the screen",
  "problem.noSlides": "{item} has no slides yet",
  "problem.noText": "{item} has no text",
  "problem.noArrangement": "{item} has no order",
  "problem.unknownArrangement": "{item} asks for an order that is not there",
  "problem.emptySequence": "{item} has an order with nothing in it",
  "problem.unknownLabel": "{item} has an order naming a slide it does not have",
  "problem.unknownCode": "{item} has a problem ({code})",

  // Where a cue is, under the Live and Next panes
  "cue.occurrence": "{label}, {occurrence} of {total}",
  "cue.slideOf": "slide {at} of {count}",
  "cue.key": "key of {key}",
  "cue.slideCount": "{at}/{count}",

  /*
   * The library.
   *
   * Three levels, three words, and none of them used twice: a **service** holds
   * **items**, and an item holds **slides**. A song, a reading and the notices
   * are all items, and what makes them the same kind of thing is that each one
   * is a stack of slides with a name on it. The window that lists them is the
   * library, because it was called Slides and so are the things inside the
   * things it lists.
   */
  "library.title": "Library",
  "library.search": "Search",
  "library.newSong": "New Song",
  "library.pickEmpty": "Nothing of this kind on the shelf",
  "library.empty": "Nothing saved yet",
  "library.noMatch": "Nothing matches that",
  "library.addHymns": "Add {count} hymns",
  "library.slides.one": "{count} slide",
  "library.slides.other": "{count} slides",
  "library.onScreen": "on screen",
  "library.fromHearth": "from Hearth",

  // One thing, open
  "editor.back": "Library",
  "editor.look": "Look",
  "editor.lookService": "The service's look",
  "editor.present": "Present",
  "editor.title": "Title",
  "editor.reference": "Reference",
  "editor.author": "Author",
  "editor.year": "Year",
  "editor.ccli": "CCLI number",
  "editor.copyright": "Copyright line",
  "editor.publicDomain": "Public domain",
  "editor.addSlide": "Add slide",
  "editor.toLibrary": "Save to the library",
  "editor.pasteSlide": "Paste slide",
  "editor.keyHint": "Cmd and Return adds a slide",
  "editor.undo": "Undo",
  "editor.removed": "{what} removed",

  // A slide
  "slide.title": "Slide title",
  "slide.number": "Slide {at}",
  "slide.drag": "Drag to move",
  "slide.moveUp": "Move up",
  "slide.moveDown": "Move down",
  "slide.duplicate": "Duplicate",
  "slide.copy": "Copy",
  "slide.note": "Note",
  "slide.remove": "Remove",
  "slide.onScreen.one": "{count} slide on screen",
  "slide.onScreen.other": "{count} slides on screen",

  // What the editor is doing, along the bottom
  "editing.copied": "a slide copied",
  "editing.readOnly": "from Hearth, read only",
  "editing.song": "a song",
  "editing.needsTitle": "needs a title",
  "editing.saving": "saving",
  "editing.saved": "saved",
  "editing.onScreen": "{count} on screen",

  // A pasted block of lyrics
  "paste.what.one": "{count} slide. {reason}",
  "paste.what.other": "{count} slides. {reason}",
  "paste.markers": "Split where the words said Verse and Chorus",
  "paste.blankLines": "Split at the blank lines",
  "paste.lineCount": "Split every four lines, which is a guess",
  "paste.accept.one": "Use this slide",
  "paste.accept.other": "Use these {count} slides",
  "paste.refuse": "Keep as one",

  // The ways a song is sung
  "orders.heading": "Orders",
  "orders.name": "Name",
  "orders.slides": "Slides",
  "orders.default": "Default",
  "orders.add": "Add order",
  "orders.remove": "Remove order",
  "orders.named": "Order {at}",
  "orders.unknown.one": "{titles} is not a slide title",
  "orders.unknown.other": "{titles} are not slide titles",
  "orders.asWritten": "As written",

  // What stopped a save, beside the field
  "save.title.missing": "Give it a title",
  "save.slide.empty": "A slide has no words",
  "save.slide.newline": "A line holds a line break",
  "save.slide.mismatch": "A slide belongs to something else",
  "save.kind.unknown": "That kind of presentation is unknown",
  "save.sections.none": "It has no words yet",
  "save.detail": "{message} ({detail})",

  // The running order a church types for one service (STG-46)
  "library.items": "Items",
  "library.plans": "Presentation Plans",
  "plan.name": "Name",
  "plan.date": "Date",
  "plan.newSlide": "New slide",
  "plan.add": "Add from the library",
  "plan.heading": "Add a heading",
  "plan.headingTitle": "Heading",
  "plan.empty": "Nothing in it yet",
  "plan.remove": "Take out",
  "plan.pick": "Add to the plan",
  "plan.entries.one": "{count} item",
  "plan.entries.other": "{count} items",
  "plan.none": "No Presentation Plans yet",
  "plan.create": "Create a Presentation Plan",
  "plan.new": "New Presentation Plan",
  "plan.duplicate": "Use this again next week",
  "plan.title": "Presentation Plan",

  // The library, which is chosen into rather than shown whole (STG-46)
  "library.kind.song": "Songs",
  "library.kind.media": "Media",
  "library.kind.slides": "Slides",
  "library.kind.choose": "Library",
  "library.kind.empty.song": "No songs yet",
  "library.kind.empty.media": "No media yet",
  "library.kind.empty.slides": "No slides yet",

  // This machine
  "settings.title": "This machine",
  "ground.label": "Background",
  "ground.choose": "Choose a background",
  "ground.none": "None",
  "ground.clear": "Clear the background",
  "ground.missing": "That file is gone",
  "ground.planLabel": "Background for the service",

  "media.files": "Images, video and audio",
  "media.images": "Images",
  "media.videos": "Video",
  "media.audios": "Audio",
  "media.wontPlay": "Will not play here",
  "media.add": "Add media",
  "media.empty": "No media yet",
  "media.rename": "Rename",
  "media.remove": "Remove from the library",
  "media.image": "Image",
  "media.video": "Video",
  "media.audio": "Audio",
  "media.refused.type": "Stage cannot read that kind of file.",
  "media.refused.size": "That file is too large to add.",
  "media.refused.unreadable": "That file could not be read.",
  "media.refused.already": "Already in the library.",
  "media.count.one": "{count} file",
  "media.count.other": "{count} files",

  "collection.untitled": "Collection {count}",
  "collection.all": "All",
  "collection.new": "Create new collection",
  "collection.rename": "Rename",
  "collection.remove": "Remove this collection",
  "collection.in": "Filed under",
  "collection.none": "No collections yet",
  "collection.count.one": "{count} item",
  "collection.count.other": "{count} items",
  "library.export": "Export the library",
  "library.exportOpenLyrics": "As OpenLyrics",
  "library.exportBundle": "As a Hearth bundle",
  "library.exportHere": "Export here",
  "library.exportWhat.one": "{count} song, with every presentation and plan",
  "library.exportWhat.other": "{count} songs, with every presentation and plan",
  "usage.title": "CCLI report",
  "usage.from": "From",
  "usage.to": "To",
  "usage.export": "Export the report",
  "usage.counted.one": "{count} song",
  "usage.counted.other": "{count} songs",
  "usage.services.one": "across {count} service",
  "usage.services.other": "across {count} services",
  "usage.missing.one": "{count} song has no CCLI number",
  "usage.missing.other": "{count} songs have no CCLI number",
  "settings.name": "Name",
  "platform.darwin": "macOS",
  "platform.win32": "Windows",
  "platform.linux": "Linux",
  "platform.unknown": "Unknown",
  "settings.logo": "Logo",
  "settings.chooseLogo": "Choose a file",
  "settings.removeLogo": "Remove",

  // The looks
  "theme.hearth": "Hearth",
  "theme.plain": "Plain",
  "theme.daylight": "Daylight",
  "theme.strong": "Strong",
} as const;
