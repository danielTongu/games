import { Card as PlayingCard } from "../../cards/core/Card.js";
import { Constants } from "./Constants.js";

/** Pick2 scoring and special-card rules. */
export class Card extends PlayingCard {
    get score() { return Constants.getCardScore(this.value, this.suit); }

    /**
     * Checks whether this card immediately ends the game.
     *
     * @returns {boolean} True when this card ends the game.
     */
    isRoundEndingCard() {
        return this.value === Constants.CARD.VALUE.SEVEN.id && this.suit === Constants.CARD.SUIT.HEARTS;
    }

    /**
     * Checks whether this is a draw-four card.
     *
     * @returns {boolean} True when this is a draw-four card.
     */
    isDrawFour() {
        return this.value === Constants.CARD.VALUE.JOKER.id;
    }

    /**
     * Checks whether this is a draw-two card.
     *
     * @returns {boolean} True when this is a draw-two card.
     */
    isDrawTwo() {
        return this.value === Constants.CARD.VALUE.TWO.id;
    }

    /**
     * Checks whether this is any draw card.
     *
     * @returns {boolean} True when this is any draw card.
     */
    isDrawCard() {
        return this.isDrawFour() || this.isDrawTwo();
    }

    /**
     * Checks whether this is the ace of spades.
     *
     * @returns {boolean} True when this is the ace of spades.
     */
    isAceOfSpades() {
        return this.value === Constants.CARD.VALUE.ACE.id && this.suit === Constants.CARD.SUIT.SPADES;
    }

    /**
     * Checks whether this card changes suit.
     *
     * @returns {boolean} True when this card changes suit.
     */
    isSuitChange() {
        return this.value === Constants.CARD.VALUE.ACE.id && this.suit !== Constants.CARD.SUIT.SPADES;
    }

    /**
     * Checks whether this card is wild.
     *
     * @returns {boolean} True when this card is wild.
     */
    isWild() {
        return this.isDrawFour() || this.isAceOfSpades();
    }

    /**
     * Checks whether this card has a special rule.
     *
     * @returns {boolean} True when this card has a special rule.
     */
    isSpecial() {
        return this.isRoundEndingCard() ||
            this.value === Constants.CARD.VALUE.TWO.id ||
            this.value === Constants.CARD.VALUE.EIGHT.id ||
            this.value === Constants.CARD.VALUE.JACK.id ||
            this.value === Constants.CARD.VALUE.ACE.id ||
            this.value === Constants.CARD.VALUE.JOKER.id;
    }

    /**
     * Checks whether this card skips the next player.
     *
     * @param {number} playerCount - Number of players.
     * @returns {boolean} True when this card skips.
     */
    isSkip(playerCount) {
        return this.value === Constants.CARD.VALUE.EIGHT.id ||
            (this.value === Constants.CARD.VALUE.JACK.id && playerCount === 2);
    }

    /**
     * Checks whether this card is any ace.
     *
     * @returns {boolean} True when this card is an ace.
     */
    isAce() {
        return this.value === Constants.CARD.VALUE.ACE.id;
    }

    /**
     * Checks whether this card reverses direction.
     *
     * @param {number} playerCount - Number of players.
     * @returns {boolean} True when this card reverses direction.
     */
    isReverse(playerCount) {
        return this.value === Constants.CARD.VALUE.JACK.id && playerCount > 2;
    }

    /**
     * Checks whether playing this card ends the Game.
     *
     * @param {number} remaining - Remaining cards.
     * @returns {boolean} True when playing this card ends the Game.
     */
    isRoundEndingMove(remaining) {
        return remaining === 0 || this.isRoundEndingCard();
    }

    /**
     * Checks whether this card may be played on the current discard.
     *
     * Rules:
     * - No top discard: any card is legal.
     * - Active draw penalty: only draw cards may be stacked, and only with an equal or higher rank.
     * - Declared suit: any card matching the declared suit, any ace, or any joker may be played.
     * - Otherwise: normal compatibility rules apply.
     *
     * @param {*|null} topDiscard - Current top discard card.
     * @param {string|null} declaredSuit - Currently declared suit, if any.
     * @param {number} drawAllowance - Current draw allowance.
     * @returns {boolean} True when this card may be played.
     * @throws {Error}
     */
    isLegalOn(topDiscard, declaredSuit = null, drawAllowance = 1) {
        let isLegal = true;

        if (topDiscard !== null && topDiscard !== undefined) {
            const top = Card.from(topDiscard);

            if (drawAllowance > 1) {
                isLegal = (this.isDrawCard() && this.rank >= top.rank) || this.isAceOfSpades();
            } else if (declaredSuit) {
                isLegal = this.suit === declaredSuit || this.isAce() || this.isDrawFour();
            } else {
                isLegal = this.isCompatibleWith(top);
            }
        }

        return isLegal;
    }

    /**
     * Checks compatibility with another card.
     *
     * @param {Card} other - Other card.
     * @returns {boolean} True when this card is compatible.
     */
    isCompatibleWith(other) {
        return this.value === other.value || this.suit === other.suit || this.isWild() || other.isWild();
    }

}
