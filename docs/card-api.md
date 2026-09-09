# Card data and interaction

`Card` is immutable initial game data. Its ordinary `value`, `suit`, and `rotation`
fields are validated during construction. Only `rank` and `score` need getters,
since they are derived from identity. Create another `Card` to change its data.
Rotation defaults to a random angle when omitted. `toJSON()` preserves the saved
format `{value, suit, score, rotation}`.

`PlayingCard` displays this data. Supplying a destination enables both user
flipping and dragging; omitting it creates a static card:

```js
const card = new Card("a", "spades", 15);
const handCard = PlayingCard.create(card, discardPile);
const guideCard = PlayingCard.create(card);

// Presentation can be updated programmatically for either kind.
guideCard.isFaceUp = false;
guideCard.rotation = null; // Let CSS choose the angle.
```

The destination must be an HTML element or `null`. It is stored privately for the
lifetime of that element. There is no shared destination and no separate
`isInteractive`, `isDraggable`, `data-interactive`, or `data-decorative` setting.
Controllers recreate cards when room state changes.

| Destination and state | Drop target | User interaction |
| --- | --- | --- |
| Local hand while waiting | Discard pile | Flip and drag |
| Local hand during an allowed playing turn | Discard pile | Flip and drag |
| Discard pile while waiting, with a local player | Local hand | Flip and drag |
| Other discard states, spectators, guide, fan, results | None | None |

Pending/busy states disable interaction. A suit-only declared-suit display always
remains static. Waiting players may take any real card in the discard pile into
their own hand; this is not restricted to their own earlier discards.

## Element properties and markup

The element's `value` and `suit` getters read its presentation attributes. `rank`
and `score` are calculated, returning `null` for suit-only cards. The `rotation`
and `isFaceUp` setters validate changes and synchronize CSS or accessibility.
`isDragging` reads the active drag state, with no separate stored boolean.

All cards use `data-value`, `data-suit`, and `data-is-face-up`. An explicit rotation
uses `--card-rotation`; clearing it makes the getter return `null`. Static cards
use `role="img"` and a descriptive accessible name. Interactive cards additionally
have a drag handle, `role="button"`, `tabindex="0"`, and `data-is-dragging`.
Static cards omit drag state attributes, handles, and interaction listeners.
The decorative Home fan is hidden through its containing element's `aria-hidden`.

`update(card)` validates before changing identity or rotation, cancels any active
drag, and preserves face state. Assign `isFaceUp` directly to flip programmatically.
Drag previews are freshly constructed static cards, preserving face and rotation.
At drag start, the source computed height is captured in pixels as the preview's
`--card-height`. It stays fixed throughout the drag, with width and visual details
derived from that height. The destination resumes its own responsive sizing after
the transfer. Rotated bounding rectangles and viewport size do not set preview height.

## Card transfers

A release inside the configured target dispatches `card_drop` there with
`{card: {value, suit}, source, target}`. Releasing elsewhere restores the source.
The element never moves cards between game collections itself.

The Room controller routes a hand drop to `discard` and a waiting discard return
to `return`. Both Direct and Hosted modes use the same authenticated Host handler.
`Room.returnCard()` validates membership, waiting state, card presence, and sorting
inside its operation queue, then moves the card, updates hand score and activity,
and broadcasts the new state. Invalid, duplicate, or stale returns cannot move a
card. Returning does not consume a draw allowance or apply playing-card effects.
