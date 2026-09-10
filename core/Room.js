import { Serializable } from "./Serializable.js";
import { Constants } from "./Constants.js";
import { ValidationUtils } from "./ValidationUtils.js";

/** Shared room identity, viewer membership, activity, and lifecycle state. */
export class Room extends Serializable {
    constructor(roomName, playerLimit) {
        super();
        this.name = ValidationUtils.namedString(roomName, "Room name", ValidationUtils.roomNameMaxLength);
        this.playerLimit = ValidationUtils.nonNegativeInteger(playerLimit, "Player limit");
        this.status = Constants.STATUS.WAITING;
        this.createdAt = Date.now();
        this.lastActiveAt = this.createdAt;
        this.viewers = new Set();
        this.onAnyChange = null;
        this.onPlayerIdle = null;
    }
    /**
     * Updates room activity timestamp.
     *
     * @returns {number} Last active timestamp.
     */
    recordActivity() {
        this.lastActiveAt = Date.now();

        return this.lastActiveAt;
    }

    /**
     * Notifies the host of a room state change.
     */
    notifyStateChange() {
        if (typeof this.onAnyChange === "function") {
            this.onAnyChange(this);
        }
    }

    /**
     * Checks whether the room is playing or awaiting a required decision.
     *
     * @returns {boolean} Whether the room is active.
     */
    isActive() {
        return this.status === Constants.STATUS.PLAYING || this.status === Constants.STATUS.PENDING;
    }

    /**
     * Checks whether the current room state prevents Player changes.
     *
     * @returns {boolean} Whether membership is locked.
     */
    isMembershipLocked() {
        return this.isActive();
    }

    /**
     * Adds a viewer.
     *
     * @param {string} tabId - Viewer tab ID.
     * @returns {boolean} True when the viewer was added.
     */
    view(tabId) {
        const normalizedTabId = typeof tabId === "string" ? tabId.trim() : "";
        let wasAdded = false;

        if (normalizedTabId.length > 0) {
            const previousViewerCount = this.viewers.size;

            this.viewers.add(normalizedTabId);
            wasAdded = this.viewers.size > previousViewerCount;

            if (wasAdded) {
                this.recordActivity();
                this.notifyStateChange();
            }
        }

        return wasAdded;
    }

    /**
     * Removes a viewer.
     *
     * @param {string} tabId - Viewer tab ID.
     * @returns {boolean} True when the viewer was removed.
     */
    leaveViewer(tabId) {
        const normalizedTabId = typeof tabId === "string" ? tabId.trim() : "";
        let wasRemoved = false;

        if (normalizedTabId.length > 0) {
            wasRemoved = this.viewers.delete(normalizedTabId);

            if (wasRemoved) {
                this.recordActivity();
                this.notifyStateChange();
            }
        }

        return wasRemoved;
    }

}
