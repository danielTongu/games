import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import test from "node:test";
import { Room } from "../core/Room.js";
import { Player } from "../core/Player.js";
import { Constants } from "../core/Constants.js";
import { Host, HostConfig, HostChannel } from "../runtime/Host.js";

const root = new URL("../", import.meta.url);

function sources(directory) {
    const result = [];
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const url = new URL(entry.name, directory);
        if (entry.isDirectory()) result.push(...sources(new URL(`${entry.name}/`, directory)));
        else if (entry.name.endsWith(".js")) result.push(url);
    }
    return result;
}

test("shared infrastructure and the optional card library never import a specific game", () => {
    for (const directory of ["core/", "runtime/", "ui/", "cards/core/", "cards/ui/"]) {
        for (const file of sources(new URL(directory, root))) {
            const source = readFileSync(file, "utf8");
            for (const match of source.matchAll(/(?:from\s*|import\s*\()?["'](\.[^"']+\.js)["']/g)) {
                const dependency = new URL(match[1], file);
                assert.ok(existsSync(dependency), `${file.pathname}: missing ${match[1]}`);
                assert.ok(!dependency.pathname.includes("/pick2/"), `${file.pathname} imports Pick2`);
                if (!directory.startsWith("cards/")) {
                    assert.ok(!dependency.pathname.includes("/cards/"), `${file.pathname} requires cards`);
                }
            }
        }
    }
});

class CounterRoom extends Room {
    players = new Map();
    value = 0;
    isEmpty() { return this.players.size === 0; }
    isPlayerPresent(name) { return this.players.has(Player.normalizeKey(name)); }
    async join(name) {
        const player = new Player(name);
        this.players.set(player.key, player);
        return player;
    }
    async leavePlayer(name) { this.players.delete(Player.normalizeKey(name)); }
}

class CounterGame {
    constants = {DEFAULT_ROOMS: [], DIRECT_OPPONENT_NAMES: [], ROOM_PLAYER_LIMIT: 2};
    welcomeMessage = "Ready to count.";
    actions = {increment: {player: 0, room: 0}};
    stateMapper = {
        toHomeData(rooms) { return {rooms: Array.from(rooms, room => ({roomName: room.name}))}; },
        toRoomData(room, playerName) { return {roomName: room.name, localPlayerName: playerName, value: room.value}; },
        toResponse(view, message, data) { return {view, message, data}; },
        toMessage(status, title, message) { return {status, title, message}; }
    };
    createRoom(name, limit) { return new CounterRoom(name, limit); }
    async act(room) {
        room.value += 1;
        room.notifyStateChange();
        return null;
    }
    async runAutomatedTurn() { return false; }
}

test("Host creates and runs a room with no cards or circular turns", async t => {
    const host = new Host(new HostConfig("direct", 0, false, false, false, null), new CounterGame());
    t.after(() => host.shutdown());
    const responses = [];
    const peer = host.open(new HostChannel(response => responses.push(response), () => {}));
    await peer.request({action: Constants.ACTIONS.CREATE, data: {tabId: "counter", roomName: "Counter", playerName: "Tester", playerLimit: 2}});
    assert.equal(responses.findLast(response => response.view === "room")?.data.value, 0);
    await peer.request({action: "increment", data: {tabId: "counter"}});
    assert.equal(responses.findLast(response => response.view === "room")?.data.value, 1);
    assert.equal(responses.some(response => response.message?.status === "error"), false);
});

test("shared Room tracks viewers without card state", () => {
    const room = new Room("Dice", 6);
    let changes = 0;
    room.onAnyChange = () => { changes += 1; };
    assert.equal(room.view("viewer"), true);
    assert.equal(room.view("viewer"), false);
    assert.equal(room.leaveViewer("viewer"), true);
    assert.equal(changes, 2);
    assert.equal("deck" in room, false);
    assert.equal("hand" in new Player("Tester"), false);
});
