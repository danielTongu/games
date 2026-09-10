import { Constants as SharedConstants } from "../../core/Constants.js";
import { Constants as CardConstants } from "../../cards/core/Constants.js";

export class Constants extends SharedConstants {
    static PLAYER_INITIAL_CARD_COUNT = 7;

    /**
     * Maximum number of players allowed in a room.
     */
    static ROOM_PLAYER_LIMIT = 4;

    /**
     * Ordered display names for Direct bot opponents.
     */
    static DIRECT_OPPONENT_NAMES = Object.freeze(["CM", "XC", "VI"]);

    /**
     * Default rooms available in Direct and Hosted registries.
     */
    static DEFAULT_ROOMS = Object.freeze([
        Object.freeze({roomName: "Default-S0", playerLimit: 4, botCount: 3}),
        Object.freeze({roomName: "Default-S1", playerLimit: 4, botCount: 2}),
        Object.freeze({roomName: "Default-S2", playerLimit: 4, botCount: 1}),
    ]);

    /**
     * Emoji groups used by room messages.
     */
    static EMOJIS = Object.freeze({
        silly: this.#createEmojiGroup(["😈","😂","😝","🙃","🤪"]),
        winner: this.#createEmojiGroup(["🎉","🏆","🎊"])
    });

    /**
     * Creates an immutable emoji group with random selection.
     *
     * @param {string[]} emojis - Emoji values.
     * @returns {{values:readonly string[], readonly random:string}} Emoji group.
     */
    static #createEmojiGroup(emojis) {
        const values = Object.freeze([...emojis]);
        return Object.freeze({ values, get random(){
            return values[Math.floor(Math.random() * values.length)];
        }});
    }

    static CARD = Object.freeze({...CardConstants.CARD, SCORE: Object.freeze({TWO: 20, SEVEN_OF_HEARTS: 30, JOKER: 40, ACE_OF_SPADES: 50})});
    static ACTIONS = Object.freeze({...SharedConstants.ACTIONS, PASS: "pass", DRAW: "draw", DISCARD: "discard", RETURN: "return", DECLARE: "declare"});
    static getCardValue(value) { return CardConstants.getCardValue(value); }
    static isStandardSuit(suit) { return CardConstants.isStandardSuit(suit); }
    static isJokerSuit(suit) { return CardConstants.isJokerSuit(suit); }
    static normalizeStandardSuit(suit) { return CardConstants.normalizeStandardSuit(suit); }
    static getCardScore(value, suit) {
        let score = Constants.getCardValue(value).rank;

        if (value === Constants.CARD.VALUE.JOKER.id) {
            score = Constants.CARD.SCORE.JOKER;
        } else if (value === Constants.CARD.VALUE.TWO.id) {
            score = Constants.CARD.SCORE.TWO;
        } else if (value === Constants.CARD.VALUE.SEVEN.id && suit === Constants.CARD.SUIT.HEARTS) {
            score = Constants.CARD.SCORE.SEVEN_OF_HEARTS;
        } else if (value === Constants.CARD.VALUE.ACE.id && suit === Constants.CARD.SUIT.SPADES) {
            score = Constants.CARD.SCORE.ACE_OF_SPADES;
        }

        return score;
    }

}
