"use strict";

import { Constants } from "./Constants.js";
import { Serializable } from "./Serializable.js";
import { ValidationUtils } from "./ValidationUtils.js";

/**
 * Represents a game player.
 */
export class Player extends Serializable {
    /** @type {Function|null} */
    #idleHandler = null;

    /** @type {*|null} */
    #idleTimeoutId = null;

    /**
     * Creates a player.
     *
     * @param {string} name - Player display name.
     * @throws {Error}
     */
    constructor(name) {
        super();

        this.name = Player.normalizeName(name);
        this.key = Player.normalizeKey(this.name);

        this.createdAt = Date.now();
        this.lastActiveAt = this.createdAt;


    }

    /**
     * Normalizes player name.
     *
     * @param {*} value - Raw player name.
     * @returns {string} Normalized name.
     * @throws {Error}
     */
    static normalizeName(value) {
        return ValidationUtils.namedString(
            value,
            "Player name",
            ValidationUtils.playerNameMaxLength
        );
    }

    /**
     * Normalizes stable player key.
     *
     * @param {*} value - Raw player name or key.
     * @returns {string} Normalized key.
     * @throws {Error}
     */
    static normalizeKey(value) {
        return ValidationUtils.requiredString(value, "Player name")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\p{L}\p{N}_-]/gu, "");
    }


    /**
     * Sets idle callback.
     *
     * @param {Function|null} callback - Idle callback.
     */
    set onIdle(callback) {
        this.#idleHandler = typeof callback === "function" ? callback : null;
    }

    /**
     * Updates activity timestamp and restarts idle timer when enabled.
     *
     * @returns {number} Last active timestamp.
     */
    recordActivity() {
        this.lastActiveAt = Date.now();
        this.#clearIdleTimeout();

        if (this.#idleHandler !== null) {
            this.#idleTimeoutId = globalThis.setTimeout(this.#handleIdleTimeout.bind(this), Constants.MAX_IDLE_MS);
        }

        return this.lastActiveAt;
    }

    /**
     * Clears the idle timer.
     */
    #clearIdleTimeout() {
        if (this.#idleTimeoutId !== null) {
            globalThis.clearTimeout(this.#idleTimeoutId);
            this.#idleTimeoutId = null;
        }
    }

    /**
     * Handles idle timeout by firing the idle callback.
     */
    #handleIdleTimeout() {
        this.#idleTimeoutId = null;

        if (this.#idleHandler !== null) {
            this.#idleHandler(this);
        }
    }

    /**
     * Stops idle monitoring.
     */
    stopIdleMonitoring() {
        this.#clearIdleTimeout();
        this.#idleHandler = null;
    }

}
