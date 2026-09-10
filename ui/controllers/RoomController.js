import { Constants } from "../../core/Constants.js";
import { ValidationUtils } from "../../core/ValidationUtils.js";
import { ViewController } from "./ViewController.js";
import { AlertController } from "./AlertController.js";
import { DomUtils } from "../utilities/DomUtils.js";
import { RoomRowUtils } from "../utilities/RoomRowUtils.js";
import { NotificationUtils } from "../utilities/NotificationUtils.js";

/** Shared Room navigation, membership controls, metadata, and connection state. */
export class RoomController extends ViewController {
    room = null;
    capabilities = {};
    #intent = null;
    #homeHandler = null;
    #readyHandler = null;
    #hasOpened = false;
    #isLeaving = false;
    #alertController = new AlertController("#alert-dialog");

    async initialize() {
        await RoomRowUtils.load();
        DomUtils.require("#room-leave-button", HTMLButtonElement).addEventListener("click", this.#leave.bind(this));
        DomUtils.require("#app-home-link", HTMLAnchorElement).addEventListener("click", this.#leave.bind(this));
        DomUtils.require("#room-join-button", HTMLButtonElement).addEventListener("click", this.#join.bind(this));
        DomUtils.require("#room-invite-button", HTMLButtonElement).addEventListener("click", this.#handleInvite.bind(this));
    }

    render(room) {
        if (room === null) return;
        this.room = room;
        this.renderRoomInformation(room);
        this.renderGameActions(room.localPlayerName === null ? null : room.localPlayerName);
    }

    constructor() {
        super("#room-view");
    }

    setClient(client) {
        this.client = client;
    }

    setIntent(intent) {
        this.#intent = intent;
    }

    setHomeHandler(handler) {
        this.#homeHandler = handler;
    }

    setReadyHandler(handler) {
        this.#readyHandler = handler;
    }

    #leave(event) {
        event.preventDefault();
        this.#isLeaving = true;
        const requestAccepted = this.client?.request(Constants.ACTIONS.LEAVE, {}) === true;

        if (requestAccepted) {
            this.#homeHandler?.(null);
        } else {
            this.#isLeaving = false;
        }
    }

    #handleInvite() {
        void this.#copyInvite();
    }

    handleClientOpen() {
        if (this.#intent === null) {
            this.#homeHandler?.(null);
            return;
        }

        let action = this.#intent.action;

        if (this.#hasOpened && action === Constants.ACTIONS.CREATE) {
            action = Constants.ACTIONS.JOIN;
        }

        this.#hasOpened = true;
        this.client?.request(action, this.#intent.data);
    }

    handleData(view, data, message = null) {
        if (view === Constants.VIEWS.ROOM) {
            this.capabilities = ValidationUtils.object(data.capabilities, "Capabilities");
            this.#readyHandler?.(data);
            this.render(data);
        } else if (view === Constants.VIEWS.HOME && (this.#isLeaving || message !== null)) {
            this.#homeHandler?.(message);
        }
    }

    handleNotification(message) {
        if (this.room === null && !this.#isLeaving) {
            this.#homeHandler?.(message);
            return;
        }

        this.#alertController.show(NotificationUtils.normalize(message));
    }

    handleConnectionStatus(status, label) {
        const root = DomUtils.require("#connection-status", HTMLElement);
        root.dataset.status = status;
        DomUtils.require("#connection-status-label", HTMLElement).textContent = label;
    }

    renderRoomInformation(room) {
        DomUtils.require("#info-table-body", HTMLTableSectionElement)
            .replaceChildren(RoomRowUtils.create(room));
    }

    renderGameActions(localPlayer) {
        DomUtils.require("#room-leave-button", HTMLButtonElement).hidden = false;
        DomUtils.require("#room-join-button", HTMLButtonElement).hidden =
            localPlayer !== null || this.capabilities.join !== true;
        DomUtils.require("#room-invite-button", HTMLButtonElement).hidden =
            this.capabilities.invite !== true;
    }

    #join() {
        const playerName = window.prompt("Enter your name:");

        if (playerName?.trim() && this.room?.roomName) {
            this.client?.request(Constants.ACTIONS.JOIN, {
                roomName: this.room.roomName,
                playerName
            });
        }
    }

    async #copyInvite() {
        if (!this.room?.roomName) {
            return;
        }

        const url = new URL("./room.html", location.href);
        url.searchParams.set("mode", "hosted");
        url.searchParams.set("room", this.room.roomName);

        try {
            await navigator.clipboard.writeText(url.href);
            this.handleNotification({status: Constants.STATUS.INFO, title: "Invite copied", message: "The room link is ready to share."});
        } catch (_error) {
            this.handleNotification({status: Constants.STATUS.ERROR, title: "Copy failed", message: "Copy the address from your browser instead."});
        }
    }
}
