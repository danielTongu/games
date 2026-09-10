/** Game-independent timing and protocol constants. */
export class Constants {
    static MAX_IDLE_MS = 30 * 1000;
    static COUNTDOWN_SECONDS = 5;
    static NETWORK_CONNECTION_TIMEOUT_MS = 3 * 1000;
    static ROOM_PLAYER_LIMIT = 4;
    static STATUS = Object.freeze({
        WAITING: "waiting",
        STARTING: "starting",
        PLAYING: "playing",
        PENDING: "pending",
        FINISHED: "finished",

        CONNECTING: "connecting",
        CONNECTED: "connected",
        DISCONNECTED: "disconnected",

        INFO: "info",
        WARNING: "warning",
        ERROR: "error"
    });

    // ============================================================
    // Views
    // ============================================================

    /**
     * Application views.
     * Home lists available rooms and provides room creation and joining controls.
     * Room displays the active room and its game-specific player controls.
     */
    static VIEWS = Object.freeze({
        HOME: "home",
        ROOM: "room"
    });

    // ============================================================
    // Actions
    // ============================================================

    /**
     * User actions dispatched by the client.
     * These actions are also sent to the server.
     */
    static ACTIONS = Object.freeze({
        LIST: "list",
        CREATE: "create",
        VIEW: "view",
        JOIN: "join",
        LEAVE: "leave",
        START: "start",
    });

    // ============================================================
    // Server Responses
    // ============================================================

    /**
     * Top-level fields included in every server response.
     */
    static RESPONSE_KEYS = Object.freeze({
        VIEW: "view",
        MESSAGE: "message",
        DATA: "data"
    });
}
