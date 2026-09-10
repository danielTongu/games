export class Constants {
    static CARD = Object.freeze({

        /**
         * Available card sorting options.
         */
        SORT_OPTIONS: Object.freeze(["none", "score", "rank", "value", "suit"]),

        /**
         * Card values and their natural rank.
         */
        VALUE: Object.freeze({
            TWO: Object.freeze({
                id: "2",
                rank: 2
            }),
            THREE: Object.freeze({
                id: "3",
                rank: 3
            }),
            FOUR: Object.freeze({
                id: "4",
                rank: 4
            }),
            FIVE: Object.freeze({
                id: "5",
                rank: 5
            }),
            SIX: Object.freeze({
                id: "6",
                rank: 6
            }),
            SEVEN: Object.freeze({
                id: "7",
                rank: 7
            }),
            EIGHT: Object.freeze({
                id: "8",
                rank: 8
            }),
            NINE: Object.freeze({
                id: "9",
                rank: 9
            }),
            TEN: Object.freeze({
                id: "10",
                rank: 10
            }),
            JACK: Object.freeze({
                id: "j",
                rank: 11
            }),
            QUEEN: Object.freeze({
                id: "q",
                rank: 12
            }),
            KING: Object.freeze({
                id: "k",
                rank: 13
            }),
            ACE: Object.freeze({
                id: "a",
                rank: 14
            }),
            JOKER: Object.freeze({
                id: "joker",
                rank: 15
            })
        }),

        /**
         * Card suits.
         */
        SUIT: Object.freeze({
            CLUBS: "clubs",
            DIAMONDS: "diamonds",
            HEARTS: "hearts",
            SPADES: "spades",

            BLACK: "black",
            RED: "red"
        }),

        /**
         * Standard suits used by non-joker cards.
         */
        STANDARD_SUITS: Object.freeze(["clubs", "diamonds", "hearts", "spades"]),

        /**
         * Suits reserved for joker cards.
         */
        JOKER_SUITS: Object.freeze(["black", "red"]),

        /**
         * Values used by standard, non-joker cards.
         */
        STANDARD_VALUES: Object.freeze([
            "2", "3", "4", "5", "6", "7", "8", "9", "10", "j", "q", "k", "a"
        ])
    });

    /**
     * Checks whether a value identifies a standard non-joker suit.
     *
     * @param {*} suit - Value to inspect.
     * @returns {boolean} Whether the value is a standard suit.
     */
    static isStandardSuit(suit) {
        return Constants.CARD.STANDARD_SUITS.includes(suit);
    }

    /**
     * Checks whether a value identifies a joker suit.
     *
     * @param {*} suit - Value to inspect.
     * @returns {boolean} Whether the value is a joker suit.
     */
    static isJokerSuit(suit) {
        return Constants.CARD.JOKER_SUITS.includes(suit);
    }

    /**
     * Normalizes and validates a standard non-joker suit.
     *
     * @param {*} value - Suit value.
     * @returns {string} Normalized standard suit.
     * @throws {Error} When the value is not a standard suit.
     */
    static normalizeStandardSuit(value) {
        const suit = typeof value === "string" ? value.trim().toLowerCase() : "";

        if (!Constants.isStandardSuit(suit)) {
            throw new Error(`Invalid suit: ${suit}`);
        }

        return suit;
    }

    /**
     * Gets the card definition for a card id.
     *
     * @param {string} id - Card value id.
     * @returns {{id:string, rank:number}}
     * @throws {Error}
     */
    static getCardValue(id) {
        let cardValue = null;

        for (const card of Object.values(Constants.CARD.VALUE)) {
            if (card.id === id) {
                cardValue = card;
                break;
            }
        }

        if (cardValue === null) {
            throw new Error(`Invalid card value: ${id}`);
        }

        return cardValue;
    }

}
