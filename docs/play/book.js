/* book.js — "The Fifth Mile", the book that ships with the Story Engine.
 *
 * A book is DATA: nodes, choices, and the state those choices carry. No code,
 * no conditions written as strings — a gate is a {var, op, value} triple and a
 * consequence is {var, op, value}. Everything the reader can do is visible in
 * this file, which is the point: the state is the story, so the story is legible.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.THE_FIFTH_MILE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "the-fifth-mile",
    title: "The Fifth Mile",
    author: "Story Engine",
    vars: { oil: 3, nerve: 0, knows: 0, promise: 0 },
    start: "watch",
    nodes: {
      watch: {
        title: "The lamp room",
        text: "The tide is two hours out and the lamp is drinking faster than the gauge likes. Three measures of oil in the reservoir, a ship due past the fifth mile before midnight, and a wind that has been getting personal since dusk. The last keeper left a page in the log and did not say why.",
        choices: [
          { label: "Trim the wick and bank what oil is left", to: "trim", effects: [{ var: "oil", op: "add", value: 1 }] },
          { label: "Open the valve wide and let the whole sky see", to: "flare", effects: [{ var: "oil", op: "sub", value: 2 }, { var: "nerve", op: "add", value: 1 }] }
        ]
      },
      trim: {
        title: "A small, honest flame",
        text: "The wick comes back to a clean edge and the flame settles to a fist of light. Four measures now, and time enough to think. The log lies open on the shelf, its last entry half-finished in a hand that was hurrying.",
        choices: [
          { label: "Read the page the last keeper left", to: "logbook", effects: [{ var: "knows", op: "add", value: 1 }] },
          { label: "Take the dinghy down to the water", to: "boat", effects: [{ var: "promise", op: "add", value: 1 }] }
        ]
      },
      flare: {
        title: "The whole sky",
        text: "The flame roars up and the glass goes white. For a minute the fifth mile is as bright as a room. Then the gauge drops to one measure and the light starts to lean, the way a tired man leans on a door.",
        choices: [
          { label: "Take the dinghy while the light still holds", to: "boat", effects: [{ var: "promise", op: "add", value: 1 }] },
          { label: "Stay and feed the flame by hand", to: "keep" }
        ]
      },
      logbook: {
        title: "The last keeper's page",
        text: "Two lines, and the second one pressed hard enough to tear: the bell buoy at the fifth mile has drifted off its mooring, and the causeway stone is the only mark a ship can steer by. There is a storm lantern by the door, full and heavy.",
        choices: [
          { label: "Take the storm lantern out to the causeway", to: "causeway", requires: [{ var: "oil", op: ">=", value: 1 }] },
          { label: "Close the book and keep the light", to: "keep" }
        ]
      },
      boat: {
        title: "The slip",
        text: "The dinghy is wet to the thwart and the water is doing its old trick of looking calmer than it is. Somewhere out past the point, a bell is ringing that should not be ringing.",
        choices: [
          { label: "Row out to the bell buoy", to: "causeway", requires: [{ var: "nerve", op: ">=", value: 1 }] },
          { label: "Turn the boat back to the slip", to: "keep" }
        ]
      },
      causeway: {
        title: "The causeway stone",
        text: "The stone is knee-deep and the wind takes the lantern flame sideways and will not let it stand. Out in the dark, a hull is feeling its way along the fifth mile, slow, listening for a mark.",
        choices: [
          { label: "Raise the lantern and signal the ship", to: "e_seen", requires: [{ var: "oil", op: ">=", value: 1 }] },
          { label: "Sit down on the wet stone and wait", to: "e_wait" }
        ]
      },
      keep: {
        title: "The lamp room, again",
        text: "Back under the glass with the flame in front of you. The gauge says what it says. Below, the sea keeps working the point, and the ship keeps coming, and the night is longer than the oil.",
        choices: [
          { label: "Keep the flame until the grey light comes", to: "e_keeper" },
          { label: "Let it go out and sleep", to: "e_dark" },
          { label: "Go back down and read the last keeper's page again", to: "logbook" }
        ]
      },
      e_seen: {
        title: "Seen",
        ending: true,
        endingTitle: "Seen from the fifth mile",
        text: "The lantern answers three times — short, short, long — and the hull swings a point to starboard and holds. By the time the flame gutters out in your hand, the ship is past the point and someone aboard is ringing the bell for no reason at all except that they are alive. You walk back up the causeway with an empty lantern and a full account of yourself."
      },
      e_wait: {
        title: "The long wait",
        ending: true,
        endingTitle: "The long wait",
        text: "You wait on the stone with the lantern low and the flame small. The ship feels its way past, close enough to hear the water along its side, and does not see you. Nobody is lost and nobody is found. In the morning the log gets one more line in a hand that is not hurrying at all."
      },
      e_keeper: {
        title: "Dawn",
        ending: true,
        endingTitle: "The keeper's dawn",
        text: "You feed the flame a measure at a time and count the hours by the gauge instead of the clock. The light holds until the grey comes up behind the point and the ship goes past the fifth mile in plain daylight, unbothered, never knowing what it cost. That is the whole job, and it is enough."
      },
      e_dark: {
        title: "Dark",
        ending: true,
        endingTitle: "The dark",
        text: "You let it go out and lie down on the bench with your coat over your face. In the morning there is a ship aground on the far side of the point, all hands safe, and a page in the log with nothing written on it. The light was yours to keep and you did not keep it."
      }
    }
  };
});
