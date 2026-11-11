# Story Engine — reader's guide

**Version 1.0.0 · PolyForm Noncommercial 1.0.0 · 141 assertions**

A book you move through: choices, carried state, and a map of where you have been — offline, no
accounts, no telemetry.

Read it: <https://drsamonline.github.io/app-story-engine/play/>

## Why it is not the usual choose-your-own-adventure

That kind of app usually forgets what you chose: the branches are a tree of screens and the reader is
a click. Here **the state is the story**. What you pick changes what you carry; what you carry decides
which doors are still open; and the trail shows every passage you have been through, in the order you
went through them — return visits included.

The book that ships with it is *The Fifth Mile*.

## The four promises, and what each one means when it breaks

1. **A choice leads to a different passage.** Two choices at one passage go to two different passages.
   A choice that does not exist is refused **with the passage still shown** — you are never dumped back
   at the start.
2. **The same choices produce the same ending.** No clock, no dice, no `eval`. Replay and you get the
   same state, the same trail, the same ending.
3. **The trail is every passage, in order.** A return visit is recorded again, not collapsed into a set.
4. **A failure is reported, never smoothed over.** A full disk stops the *saving*, not the reading. A
   corrupt save is reported with the passage it claims and offered for export — the app never resumes
   at the beginning and calls it your place.

The fourth is the one worth reading twice: most apps lose your place and start over, which reads as
your mistake rather than theirs.

## For anyone writing a book for it

The engine is a module — `compile`, `newGame`, `choicesFor`, `advance`, `trail`, `save`, `load`,
`createStore` — and the book is data. `docs/play/book.js` is a complete example of the shape. Test it
with `node test-node.js`, which runs the real engine over the real book.

## Licence

PolyForm Noncommercial 1.0.0. See [LICENSE](../LICENSE).
