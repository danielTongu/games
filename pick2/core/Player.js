import { Player as SharedPlayer } from "../../core/Player.js";
import { Hand } from "./Hand.js";

export class Player extends SharedPlayer {
    constructor(name) {
        super(name);
        this.hand = new Hand();
        this.drawAllowance = 1;
        this.isWinner = false;
        this.nextKey = this.key;
        this.prevKey = this.key;
    }
    /**
     * Sets circular turn links.
     *
     * @param {string|null|undefined} nextNameOrKey - Next player name or key.
     * @param {string|null|undefined} prevNameOrKey - Previous player name or key.
     */
    setTurnLinks(nextNameOrKey, prevNameOrKey) {
        this.nextKey = nextNameOrKey ? Player.normalizeKey(nextNameOrKey) : null;
        this.prevKey = prevNameOrKey ? Player.normalizeKey(prevNameOrKey) : null;
        this.recordActivity();
    }

    /**
     * Resets round state.
     */
    reset() {
        this.hand.clear();
        this.drawAllowance = 1;
        this.isWinner = false;
        this.recordActivity();
    }
}
