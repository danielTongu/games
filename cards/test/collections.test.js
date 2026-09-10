import assert from "node:assert/strict";
import test from "node:test";
import { Card } from "../core/Card.js";
import { Deck } from "../core/Deck.js";
import { Hand } from "../core/Hand.js";
import { Card as Pick2Card } from "../../pick2/core/Card.js";
import { Deck as Pick2Deck } from "../../pick2/core/Deck.js";
import { Hand as Pick2Hand } from "../../pick2/core/Hand.js";

test("generic card identity has no Pick2 scoring or special effects", () => {
    const card = new Card("2", "clubs", 0);
    assert.equal(card.rank, 2);
    assert.equal(card.score, 2);
    assert.equal("isDrawTwo" in card, false);
    assert.equal(new Hand([card]).score, 2);
    assert.equal(new Deck(false).cards.length, 54);
});

test("Pick2 collections preserve specialized cards when creating and recycling", () => {
    const deck = new Pick2Deck(false);
    assert.ok(deck.cards.every(card => card instanceof Pick2Card));
    const hand = new Pick2Hand([{value: "2", suit: "clubs", rotation: 0}]);
    assert.equal(hand.score, 20);
    deck.putTop(hand.cards[0]);
    const card = deck.draw();
    assert.ok(card instanceof Pick2Card);
    assert.equal(card.isDrawTwo(), true);
    assert.equal(card.score, 20);
});
