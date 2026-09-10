import { HomeController as SharedHomeController } from "../../../ui/controllers/HomeController.js";
import { Card } from "../../core/Card.js";
import { Constants } from "../../core/Constants.js";
import { PlayingCard } from "../../../cards/ui/PlayingCard.js";

function compareCardScores(left, right) {
    return left.score - right.score;
}

function createFanCard(card) {
    const element = PlayingCard.create(card);
    element.rotation = null;
    return element;
}

function renderSpecialCardFan() {
    const fan = document.querySelector(".card-fan");

    if (!(fan instanceof HTMLElement)) {
        return;
    }

    const {SUIT, VALUE} = Constants.CARD;
    const specialCards = [
        new Card(VALUE.TWO.id, SUIT.CLUBS, 0),
        new Card(VALUE.EIGHT.id, SUIT.DIAMONDS, 0),
        new Card(VALUE.JACK.id, SUIT.SPADES, 0),
        new Card(VALUE.ACE.id, SUIT.HEARTS, 0),
        new Card(VALUE.SEVEN.id, SUIT.HEARTS, 0),
        new Card(VALUE.JOKER.id, SUIT.BLACK, 0),
        new Card(VALUE.ACE.id, SUIT.SPADES, 0)
    ].sort(compareCardScores);

    fan.replaceChildren(...specialCards.map(createFanCard));
}

/** Pick2 Home decoration layered over the shared room directory. */
export class HomeController extends SharedHomeController {
    async initialize() {
        renderSpecialCardFan();
        await super.initialize();
    }
}
