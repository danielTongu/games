"use strict";

import { Constants } from "../../core/Constants.js";
import { ValidationUtils } from "../../../core/ValidationUtils.js";
import { TurnUtils } from "../../core/TurnUtils.js";
import { CountdownController } from "./CountdownController.js";
import { DomUtils } from "../../../ui/utilities/DomUtils.js";
import { ResultsController } from "./ResultsController.js";
import { LocalPlayerController } from "./LocalPlayerController.js";
import { OpponentUtils } from "../utilities/OpponentUtils.js";
import { PlayerDisplayUtils } from "../utilities/PlayerDisplayUtils.js";
import { PlayingCard } from "../../../cards/ui/PlayingCard.js";
import { SuitSelectionController } from "./SuitSelectionController.js";
import { RoomController as SharedRoomController } from "../../../ui/controllers/RoomController.js";

/** Controls the active Room for both Direct and Hosted play. */
export class RoomController extends SharedRoomController {
    #previousStatus = "";
    #playerController = new LocalPlayerController("#player-area", false);
    #suitController = new SuitSelectionController("#suit-selection-dialog");
    #countdownController = new CountdownController("#countdown-dialog");
    #resultsController = new ResultsController("#results-dialog");

    async initialize() {
        await super.initialize();
        await OpponentUtils.load();
        this.#playerController.initialize();
        this.#playerController.setActionHandler(this.#handlePlayerAction.bind(this));
        this.#playerController.setSortHandler(this.#handleSortChange.bind(this));
        this.#suitController.setSubmitHandler(this.#handleSuitSelection.bind(this));
        DomUtils.require("#discard-pile", HTMLElement).addEventListener("card_drop", this.#handleCardDrop.bind(this));
        DomUtils.require("#player-hand", HTMLElement).addEventListener("card_drop", this.#handleCardReturn.bind(this));
    }

    #handlePlayerAction(action) {
        if (RoomController.#isCardMove(action)) {
            this.#sendCardMove(action, {});
        } else {
            this.client?.request(action, {});
        }
    }

    #handleSortChange(sortKey) {
        this.client.sortKey = ValidationUtils.requiredString(sortKey, "Sort key");
        this.render(this.room);
    }

    #handleSuitSelection(suit) {
        this.client?.request(Constants.ACTIONS.DECLARE, {suit});
    }

    #handleCardDrop(event) {
        if (event instanceof CustomEvent && event.detail?.card) {
            this.#sendCardMove(Constants.ACTIONS.DISCARD, {card: event.detail.card});
        }
    }

    #handleCardReturn(event) {
        if (event instanceof CustomEvent && event.detail?.card &&
            this.room?.status === Constants.STATUS.WAITING) {
            this.#sendCardMove(Constants.ACTIONS.RETURN, {card: event.detail.card});
        }
    }

    render(room) {
        if (room === null) {
            return;
        }

        const previousStatus = this.#previousStatus;
        const nextStatus = ValidationUtils.optionalString(room.status, "");
        const localPlayer = RoomController.#getLocalPlayer(room);

        this.room = room;
        this.#previousStatus = nextStatus;
        super.render(room);
        DomUtils.require("#play-area", HTMLElement).dataset.status = room.status;
        this.#renderPlayers(room);
        this.#renderDiscardPile(room, localPlayer);
        this.#renderLocalPlayer(localPlayer, room);

        if (
            localPlayer !== null &&
            previousStatus === Constants.STATUS.WAITING &&
            nextStatus === Constants.STATUS.PLAYING
        ) {
            this.#countdownController.show(Constants.COUNTDOWN_SECONDS);
        }

        const requiresSuitSelection =
            room.status === Constants.STATUS.PENDING &&
            localPlayer !== null &&
            TurnUtils.isTurnOwner(room.circle?.turnOwnerKey, localPlayer.key);

        if (requiresSuitSelection) {
            this.#suitController.show();
        } else {
            this.#suitController.hide();
        }

        if (
            localPlayer !== null &&
            previousStatus !== Constants.STATUS.FINISHED &&
            nextStatus === Constants.STATUS.FINISHED
        ) {
            this.#resultsController.show(room);
        } else if (localPlayer === null || nextStatus !== Constants.STATUS.FINISHED) {
            this.#resultsController.hide();
        }
    }

    #sendCardMove(action, data) {
        if (this.client?.request(action, data)) {
            this.client.sortKey = Constants.CARD.SORT_OPTIONS[0];
            this.render(this.room);
        }
    }

    static #isCardMove(action) {
        return action === Constants.ACTIONS.DRAW ||
            action === Constants.ACTIONS.DISCARD ||
            action === Constants.ACTIONS.RETURN ||
            action === Constants.ACTIONS.PASS;
    }

    #renderPlayers(room) {
        const container = DomUtils.require("#opponent-list", HTMLElement);
        const localName = room.localPlayerName ?? null;
        container.replaceChildren();

        const players = PlayerDisplayUtils.localFirst(
            RoomController.#getPlayers(room),
            localName
        );

        for (const player of players) {
            if (player.name !== localName) {
                container.appendChild(OpponentUtils.create(player, room.circle));
            }
        }
    }

    #renderDiscardPile(room, localPlayer) {
        const cards = Array.isArray(room.discardPile) ? room.discardPile : [];
        const destination = room.status === Constants.STATUS.WAITING && localPlayer !== null && !room.isBusy
            ? DomUtils.require("#player-hand", HTMLElement)
            : null;
        const elements = [];

        for (const card of cards) {
            elements.push(PlayingCard.create(card, card.value ? destination : null));
        }

        DomUtils.require("#discard-pile", HTMLElement).replaceChildren(...elements);
    }

    #renderLocalPlayer(player, room) {
        if (player === null) {
            this.#playerController.hide();
            return;
        }

        this.#playerController.setCanRestartFinishedGame(this.capabilities.restart === true);
        this.#playerController.show(player, room, this.client.sortKey);
        const idleWarning = document.querySelector("#player-idle-warning");

        if (idleWarning instanceof HTMLElement) {
            idleWarning.hidden = room.mode === "direct";
        }
    }

    static #getPlayers(room) {
        return Array.isArray(room?.circle?.players) ? room.circle.players : [];
    }

    static #getLocalPlayer(room) {
        const playerName = room?.localPlayerName ?? null;

        for (const player of RoomController.#getPlayers(room)) {
            if (player.name === playerName) {
                return player;
            }
        }

        return null;
    }

}
