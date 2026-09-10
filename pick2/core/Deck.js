import { Deck as CardDeck } from "../../cards/core/Deck.js";
import { Card } from "./Card.js";

export class Deck extends CardDeck {
    static Card = Card;
}
