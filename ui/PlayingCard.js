"use strict";

import { Constants } from "../core/Constants.js";
import { Card } from "../core/Card.js";
import { ValidationUtils } from "../core/ValidationUtils.js";

/**
 * Card presentation with optional flipping and pointer dragging.
 * A destination supplied at creation enables interaction.
 * Controllers own destination selection, game legality, and requests to the room host.
 */
export class PlayingCard extends HTMLElement {
    /** @type {string} */
    static elementName = "playing-card";

    static observedAttributes = ["data-is-face-up", "data-value", "data-suit"];

    /** @type {HTMLElement|null} */
    #dropTarget = null;

    /** @type {PlayingCard|null} */
    static #activeCard = null;

    /** @type {number} */
    static #dragThreshold = 6;

    /** @type {HTMLElement|null} */
    #dragHandle = null;

    /** @type {boolean} */
    #isInitialized = false;

    /** @type {boolean} */
    #areEventsBound = false;

    /** @type {number|null} */
    #dragResetTimeoutId = null;

    /** @type {Function} */
    #onClick;

    /** @type {Function} */
    #onKeyDown;

    /** @type {Function} */
    #onPointerDown;

    /** @type {Function} */
    #onPointerMove;

    /** @type {Function} */
    #onPointerUp;

    /** @type {Function} */
    #onPointerCancel;

    /** @type {{
     *     clone:HTMLElement|null,
     *     pointerId:number|null,
     *     startX:number,
     *     startY:number,
     *     offsetX:number,
     *     offsetY:number,
     *     didDrag:boolean
     * }}
     */
    #dragState = {
        clone: null,
        pointerId: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        didDrag: false
    };

    /** Initializes card internals; the factory supplies data and destination. */
    constructor() {
        super();
        this.#onClick = this.#handleClick.bind(this);
        this.#onKeyDown = this.#handleKeyDown.bind(this);
        this.#onPointerDown = this.#handlePointerDown.bind(this);
        this.#onPointerMove = this.#handlePointerMove.bind(this);
        this.#onPointerUp = this.#handlePointerUp.bind(this);
        this.#onPointerCancel = this.#handlePointerCancel.bind(this);
    }

    /**
     * Creates and populates a playing-card element.
     *
     * @param {Object} card - Card data.
     * @param {HTMLElement|null} dropTarget - Destination; omit for a static card.
     * @returns {PlayingCard} Created card element.
     * @throws {Error}
     */
    static create(card, dropTarget = null) {
        if (dropTarget !== null && !(dropTarget instanceof HTMLElement)) {
            throw new Error("Playing-card drop destination must be an element.");
        }

        const element = document.createElement(PlayingCard.elementName);

        if (!(element instanceof PlayingCard)) {
            throw new Error("PlayingCard is not registered.");
        }

        element.#dropTarget = dropTarget;
        element.update(card);

        return element;
    }

    /**
     * Initializes structure and behavior when connected.
     */
    connectedCallback() {
        if (!this.#isInitialized) {
            this.#initialize();
        }

        if (this.#dropTarget !== null && !this.#areEventsBound) {
            this.#bindEvents();
        }

        this.#updateAccessibility();
    }

    /**
     * Releases document state and listeners when disconnected.
     */
    disconnectedCallback() {
        if (this.#areEventsBound) {
            this.#unbindEvents();
        }

        this.#clearDragResetTimeout();
        this.#resetDrag(false);
    }

    /** Keeps attribute-driven state, interaction, and accessibility synchronized. */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) {
            return;
        }

        this.#updateAccessibility();
    }

    /** @returns {string} Card value, or an empty string for a suit-only card. */
    get value() {
        return this.dataset.value ?? "";
    }

    /** @returns {string} Card suit. */
    get suit() {
        return this.dataset.suit ?? "";
    }

    /** @returns {number|null} Derived rank, or null for a suit-only card. */
    get rank() {
        return this.value ? Constants.getCardValue(this.value).rank : null;
    }

    /** @returns {number|null} Derived score, or null for a suit-only card. */
    get score() {
        return this.value ? Constants.getCardScore(this.value, this.suit) : null;
    }

    /** @returns {number|null} Explicit rotation in degrees, or null to use CSS. */
    get rotation() {
        const rotation = this.style.getPropertyValue("--card-rotation");
        return rotation ? Number.parseFloat(rotation) : null;
    }

    /** @param {number|null|undefined} rotation - Finite degrees, or null/undefined to use CSS. */
    set rotation(rotation) {
        if (rotation === undefined || rotation === null) {
            this.style.removeProperty("--card-rotation");
        } else {
            const value = ValidationUtils.number(rotation, "Card.rotation");
            this.style.setProperty("--card-rotation", `${value}deg`);
        }
    }

    /** @returns {boolean} Whether a drag is currently active. */
    get isDragging() {
        return this.#dragState.clone !== null;
    }

    /** @returns {boolean} Whether the card face is visible. */
    get isFaceUp() {
        return this.dataset.isFaceUp !== "false";
    }

    /** @param {boolean} isFaceUp - Whether the card face is visible. */
    set isFaceUp(isFaceUp) {
        this.dataset.isFaceUp = String(ValidationUtils.boolean(isFaceUp, "PlayingCard.isFaceUp"));
    }

    /**
     * Updates card presentation and interaction state.
     *
     * @param {Object} card - Card data.
     * @param {string} [card.value] - Card value.
     * @param {string} card.suit - Card suit.
     * @param {number} [card.rotation] - Rotation in degrees.
     * @throws {Error}
     */
    update(card) {
        const data = PlayingCard.#normalizeCard(card);
        const rotation = card.rotation == null ? null : ValidationUtils.number(card.rotation, "Card.rotation");

        if (this.#dragState.pointerId !== null) {
            this.#resetDrag(this.isDragging);
        }

        this.dataset.value = data.value;
        this.dataset.suit = data.suit;

        this.rotation = rotation;
        this.#updateAccessibility();
    }

    /**
     * Creates presentation and, when a destination exists, interaction markup.
     */
    #initialize() {
        const center = document.createElement("div");
        center.className = "playing-card-center";

        if (this.#dropTarget !== null) {
            this.#dragHandle = document.createElement("div");
            this.#dragHandle.className = "playing-card-drag-handle";
            this.replaceChildren(this.#dragHandle, center);
            this.tabIndex = 0;
            this.dataset.isDragging = "false";
            this.setAttribute("role", "button");
        } else {
            this.replaceChildren(center);
            this.setAttribute("role", "img");
        }

        this.#isInitialized = true;
        this.isFaceUp = this.isFaceUp;
    }

    /**
     * Binds element events.
     */
    #bindEvents() {
        if (this.#dragHandle === null) {
            throw new Error("Playing-card drag handle is missing.");
        }

        this.addEventListener("click", this.#onClick);
        this.addEventListener("keydown", this.#onKeyDown);
        this.#dragHandle.addEventListener("pointerdown", this.#onPointerDown);

        this.#areEventsBound = true;
    }

    /**
     * Unbinds element events.
     */
    #unbindEvents() {
        this.removeEventListener("click", this.#onClick);
        this.removeEventListener("keydown", this.#onKeyDown);

        if (this.#dragHandle !== null) {
            this.#dragHandle.removeEventListener("pointerdown", this.#onPointerDown);
        }

        this.#unbindDragEvents();

        this.#areEventsBound = false;
    }

    /**
     * Handles click-to-flip behavior.
     *
     * @param {MouseEvent} event - Click event.
     */
    #handleClick(event) {
        if (this.#dragState.didDrag) {
            this.#dragState.didDrag = false;
            this.#clearDragResetTimeout();
            event.preventDefault();
        } else {
            this.isFaceUp = !this.isFaceUp;
        }
    }

    /**
     * Handles keyboard face toggling.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #handleKeyDown(event) {
        const shouldToggle = event.key === "Enter" || event.key === " ";

        if (shouldToggle) {
            event.preventDefault();
            this.isFaceUp = !this.isFaceUp;
        }
    }

    /**
     * Begins tracking a possible drag.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #handlePointerDown(event) {
        const canStart = event.button === 0 && PlayingCard.#activeCard === null;

        if (canStart && this.#dragHandle !== null) {
            const bounds = this.getBoundingClientRect();

            PlayingCard.#activeCard = this;
            this.#dragState.pointerId = event.pointerId;
            this.#dragState.startX = event.clientX;
            this.#dragState.startY = event.clientY;
            this.#dragState.offsetX = event.clientX - bounds.left;
            this.#dragState.offsetY = event.clientY - bounds.top;
            this.#dragState.didDrag = false;

            document.addEventListener("pointermove", this.#onPointerMove);
            document.addEventListener("pointerup", this.#onPointerUp);
            document.addEventListener("pointercancel", this.#onPointerCancel);
            this.#dragHandle.setPointerCapture(event.pointerId);
        }
    }

    /**
     * Starts or updates an active drag.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #handlePointerMove(event) {
        if (event.pointerId === this.#dragState.pointerId) {
            const distance = Math.hypot(
                event.clientX - this.#dragState.startX,
                event.clientY - this.#dragState.startY
            );

            if (this.#dragState.clone === null && distance >= PlayingCard.#dragThreshold) {
                this.#startDrag();
            }

            if (this.#dragState.clone !== null) {
                event.preventDefault();
                this.#moveDrag(event.clientX, event.clientY);
                this.#updateDropTarget(event.clientX, event.clientY);
            }
        }
    }

    /**
     * Finishes an active pointer interaction.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #handlePointerUp(event) {
        if (event.pointerId === this.#dragState.pointerId) {
            const didDrag = this.#dragState.clone !== null;

            try {
                if (didDrag) {
                    this.#dispatchDrop(event.clientX, event.clientY);
                }
            } finally {
                this.#resetDrag(didDrag && this.isConnected);
            }
        }
    }

    /**
     * Cancels an active pointer interaction.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #handlePointerCancel(event) {
        if (event.pointerId === this.#dragState.pointerId) {
            this.#resetDrag(false);
        }
    }

    /**
     * Creates the visual drag clone.
     */
    #startDrag() {
        const clone = PlayingCard.create(this);
        clone.isFaceUp = this.isFaceUp;
        clone.setAttribute("aria-hidden", "true");

        const bounds = this.getBoundingClientRect();
        const scale = Constants.CARD.DRAG_CLONE_SCALE;

        clone.dataset.dragClone = "true";
        clone.style.setProperty("--card-size", `${bounds.height * scale}px`);
        clone.style.setProperty("--card-min-height", "0px");

        this.#dragState.clone = clone;
        this.#dragState.offsetX *= scale;
        this.#dragState.offsetY *= scale;
        this.dataset.isDragging = "true";

        this.#moveDrag(this.#dragState.startX, this.#dragState.startY);
        document.body.appendChild(clone);
    }

    /**
     * Moves the visual drag clone.
     *
     * @param {number} clientX - Pointer X coordinate.
     * @param {number} clientY - Pointer Y coordinate.
     */
    #moveDrag(clientX, clientY) {
        const clone = this.#dragState.clone;

        if (clone !== null) {
            clone.style.left = `${clientX - this.#dragState.offsetX}px`;
            clone.style.top = `${clientY - this.#dragState.offsetY}px`;
        }
    }

    /**
     * Updates drop-target hover state.
     *
     * @param {number} clientX - Pointer X coordinate.
     * @param {number} clientY - Pointer Y coordinate.
     */
    #updateDropTarget(clientX, clientY) {
        const target = this.#dropTarget;
        const clone = this.#dragState.clone;

        if (target !== null) {
            const isOver = PlayingCard.#containsPoint(target, clientX, clientY);
            const wasOver = target.dataset.isDragOver === "true";

            target.dataset.isDragOver = String(isOver);

            if (clone !== null) {
                clone.style.transform = isOver ? "rotate(0deg)" : "rotate(2deg)";
            }

            if (isOver && !wasOver) {
                target.dispatchEvent(new CustomEvent("drag_over", {
                    bubbles: true
                }));
            } else if (!isOver && wasOver) {
                target.dispatchEvent(new CustomEvent("drag_leave", {
                    bubbles: true
                }));
            }
        }
    }

    /**
     * Dispatches a card-drop event when released over the drop target.
     *
     * @param {number} clientX - Pointer X coordinate.
     * @param {number} clientY - Pointer Y coordinate.
     */
    #dispatchDrop(clientX, clientY) {
        const target = this.#dropTarget;

        if (target !== null && PlayingCard.#containsPoint(target, clientX, clientY)) {
            target.dispatchEvent(new CustomEvent("card_drop", {
                bubbles: true,
                detail: {
                    card: {value: this.value, suit: this.suit},
                    source: this,
                    target
                }
            }));
        }
    }

    /**
     * Clears the active drag and target state.
     *
     * @param {boolean} didDrag - Whether the interaction became a drag.
     */
    #resetDrag(didDrag) {
        const target = this.#dropTarget;
        const pointerId = this.#dragState.pointerId;

        this.#unbindDragEvents();

        if (target !== null && target.dataset.isDragOver === "true") {
            target.dataset.isDragOver = "false";
            target.dispatchEvent(new CustomEvent("drag_leave", {
                bubbles: true
            }));
        }

        if (this.#dragState.clone !== null) {
            this.#dragState.clone.remove();
        }

        if (this.#dragHandle !== null && pointerId !== null && this.#dragHandle.hasPointerCapture(pointerId)) {
            this.#dragHandle.releasePointerCapture(pointerId);
        }

        if (PlayingCard.#activeCard === this) {
            PlayingCard.#activeCard = null;
        }

        if (this.#dropTarget !== null) {
            this.dataset.isDragging = "false";
        }
        this.#dragState.clone = null;
        this.#dragState.pointerId = null;
        this.#dragState.startX = 0;
        this.#dragState.startY = 0;
        this.#dragState.offsetX = 0;
        this.#dragState.offsetY = 0;
        this.#dragState.didDrag = didDrag;

        this.#clearDragResetTimeout();

        if (didDrag) {
            this.#dragResetTimeoutId = window.setTimeout(this.#clearDidDrag.bind(this), 0);
        }
    }

    /** Clears click suppression after a completed drag. */
    #clearDidDrag() {
        this.#dragState.didDrag = false;
        this.#dragResetTimeoutId = null;
    }

    /**
     * Stops tracking the active pointer outside the card.
     */
    #unbindDragEvents() {
        document.removeEventListener("pointermove", this.#onPointerMove);
        document.removeEventListener("pointerup", this.#onPointerUp);
        document.removeEventListener("pointercancel", this.#onPointerCancel);
    }

    /**
     * Clears the pending click-suppression timeout.
     */
    #clearDragResetTimeout() {
        if (this.#dragResetTimeoutId !== null) {
            window.clearTimeout(this.#dragResetTimeoutId);
            this.#dragResetTimeoutId = null;
        }
    }

    /**
     * Updates the accessible card description.
     */
    #updateAccessibility() {
        const value = this.value;
        const suit = this.suit;
        const identity = value ? `${value} of ${suit}` : suit;
        const face = this.isFaceUp ? "face up" : "face down";

        this.setAttribute("aria-label", `${identity}, ${face}`);
    }

    /**
     * Checks whether a viewport point is inside an element.
     *
     * @param {HTMLElement} element - Element bounds to inspect.
     * @param {number} clientX - Pointer X coordinate.
     * @param {number} clientY - Pointer Y coordinate.
     * @returns {boolean} True when the point is inside.
     */
    static #containsPoint(element, clientX, clientY) {
        const bounds = element.getBoundingClientRect();

        return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
    }

    /**
     * Normalizes playing-card model data.
     *
     * Suit-only cards are allowed; value-only cards are not.
     *
     * @param {*} card - Card model.
     * @returns {{value:string,suit:string}} Normalized card.
     * @throws {Error}
     */
    static #normalizeCard(card) {
        const source = ValidationUtils.object(card, "Card");
        const suit = ValidationUtils.requiredString(source.suit, "Card.suit").toLowerCase();
        let value = "";

        if (source.value !== undefined && source.value !== null && source.value !== "") {
            value = ValidationUtils.requiredString(source.value, "Card.value").toLowerCase();
        }

        if (value) {
            const identity = new Card(value, suit, 0);
            return {value: identity.value, suit: identity.suit};
        }

        if (!Constants.isStandardSuit(suit) && !Constants.isJokerSuit(suit)) {
            throw new Error(`Invalid card suit: ${suit}`);
        }

        return {value, suit};
    }
}

if (!customElements.get(PlayingCard.elementName)) {
    customElements.define(PlayingCard.elementName, PlayingCard);
}
