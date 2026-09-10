"use strict";

import { Constants } from "./Constants.js";
import { Serializable } from "../../core/Serializable.js";

/**
 * Card representation used by server-side rules, deck logic, and snapshots.
 */
export class Card extends Serializable {
    /**
     * Creates a validated card.
     *
     * @param {string} value - Card value.
     * @param {string} suit - Card suit.
     * @param {number} rotation - Visual rotation in degrees.
     * @throws {Error}
     */
    constructor(value, suit, rotation = Math.random() * 360) {
        super();

        this.value = Card.#normalizeText(value, "Card.value");
        this.suit = Card.#normalizeText(suit, "Card.suit");

        Card.#validateIdentity(this.value, this.suit);

        this.rotation = Card.#normalizeRotation(rotation);
        Object.freeze(this);
    }

    /** @returns {number} Natural rank derived from the card value. */
    get rank() {
        return Constants.getCardValue(this.value).rank;
    }

    /** @returns {number} Score derived from the card identity. */
    get score() {
        return this.rank;
    }

    /**
     * Preserves the saved card format; rank is derived when read.
     * @param {string[]|string|null} include - Field allow-list, or the key supplied by JSON.stringify.
     * @param {string[]} exclude - Optional field deny-list.
     * @returns {Object} JSON-safe card data.
     */
    toJSON(include = null, exclude = []) {
        return new Serializable({
            value: this.value,
            suit: this.suit,
            score: this.score,
            rotation: this.rotation
        }).toJSON(typeof include === "string" ? null : include, exclude);
    }

    /**
     * Creates a card from a Card instance or card-like object.
     *
     * @param {*} source - Card or card-like object.
     * @returns {Card} Card instance.
     * @throws {Error}
     */
    static from(source) {
        let card;

        if (source instanceof Card) {
            card = new this(source.value, source.suit, source.rotation);
        } else if (typeof source === "object" && source !== null) {
            card = new this(source.value, source.suit, Number.isFinite(source.rotation) ? source.rotation : Math.random() * 360);
        } else {
            throw new Error("Card source must be an object.");
        }

        return card;
    }

    /**
     * Creates a stable card id.
     *
     * @param {string} value - Card value.
     * @param {string} suit - Card suit.
     * @returns {string} Stable card id.
     * @throws {Error}
     */
    static #createId(value, suit) {
        const normalizedValue = Card.#normalizeText(value, "Card.value");
        const normalizedSuit = Card.#normalizeText(suit, "Card.suit");

        Card.#validateIdentity(normalizedValue, normalizedSuit);

        return `${normalizedValue}-${normalizedSuit}`;
    }

    /**
     * Validates card attributes.
     *
     * @param {string} value - Card value.
     * @param {string} suit - Card suit.
     * @throws {Error}
     */
    static #validateIdentity(value, suit) {
        const isJoker = value === Constants.CARD.VALUE.JOKER.id;

        if (!Card.#isValueValid(value)) {
            throw new Error(`Invalid card value: ${value}`);
        }

        if (isJoker && !Constants.isJokerSuit(suit)) {
            throw new Error("Joker must use red or black suit.");
        }

        if (!isJoker && !Constants.isStandardSuit(suit)) {
            throw new Error(`Invalid card suit: ${suit}`);
        }
    }

    /**
     * Checks whether a card value is valid.
     *
     * @param {string} value - Card value.
     * @returns {boolean} True when the value exists.
     */
    static #isValueValid(value) {
        let isValueValid = true;

        try {
            Constants.getCardValue(value);
        } catch (_error) {
            isValueValid = false;
        }

        return isValueValid;
    }

    /**
     * Gets stable card id.
     *
     * @returns {string} Stable card id.
     */
    getId() {
        return Card.#createId(this.value, this.suit);
    }

    /**
     * Stringifies the card as its stable id.
     *
     * @returns {string} Stable card id.
     */
    toString() {
        return this.getId();
    }

    /**
     * Normalizes required card text.
     *
     * @param {*} value - Text value.
     * @param {string} label - Error label.
     * @returns {string} Normalized text.
     * @throws {Error}
     */
    static #normalizeText(value, label) {
        if (typeof value !== "string") {
            throw new Error(`${label} must be a string.`);
        }

        const text = value.trim().toLowerCase();

        if (!text) {
            throw new Error(`${label} cannot be empty.`);
        }

        return text;
    }

    /**
     * Normalizes rotation.
     *
     * @param {*} rotation - Rotation value.
     * @returns {number} Normalized rotation.
     * @throws {Error}
     */
    static #normalizeRotation(rotation) {
        if (!Number.isFinite(rotation)) {
            throw new Error("Card.rotation must be a finite number.");
        }

        return rotation;
    }
}
