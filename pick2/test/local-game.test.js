import { Game } from "../Game.js";
"use strict";

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { Constants } from "../core/Constants.js";
import { Client } from "../Client.js";
import { ClientEvents } from "../../runtime/Client.js";
import { Host, HostChannel, HostConfig } from "../../runtime/Host.js";

function createPeer(host, tabId = "test-tab") {
    const responses = [];
    const connection = host.open(new HostChannel(
        (response) => responses.push(response),
        () => {}
    ));
    return {
        connection,
        responses,
        async request(action, data = {}) {
            const firstResponse = responses.length;
            await connection.request({
                action,
                data: {tabId, sortKey: "none", ...data}
            });
            return responses.slice(firstResponse);
        }
    };
}

function latestGame(responses) {
    return responses.findLast((response) => response.view === Constants.VIEWS.ROOM)?.data;
}

for (const mode of ["direct", "hosted"]) {
    test(`${mode} returns use authenticated membership and broadcast the updated hand`, async t => {
        const host = new Host(new HostConfig(mode, 0, false, false, false, null), new Game());
        t.after(() => host.shutdown());
        const owner = createPeer(host, "owner");
        const viewer = createPeer(host, "viewer");
        await owner.request(Constants.ACTIONS.CREATE, {roomName: "Return Flow", playerName: "Alice", playerLimit: 2});
        await viewer.request(Constants.ACTIONS.VIEW, {roomName: "Return Flow"});
        const drawn = latestGame(await owner.request(Constants.ACTIONS.DRAW));
        const card = drawn.circle.players.find(player => player.name === "Alice").hand.cards[0];
        await owner.request(Constants.ACTIONS.DISCARD, {card});

        const rejected = await viewer.request(Constants.ACTIONS.RETURN, {card, playerName: "Alice"});
        assert.match(rejected.findLast(response => response.message)?.message.message ?? "", /Join the room/);
        const spectatorStart = viewer.responses.length;
        const result = latestGame(await owner.request(Constants.ACTIONS.RETURN, {card, playerName: "Someone Else"}));
        const player = result.circle.players.find(entry => entry.name === "Alice");
        assert.equal(player.hand.cards.length, 1);
        assert.deepEqual(player.hand.cards[0], card);
        assert.equal(player.hand.score, card.score);
        assert.equal(result.discardPile.some(entry => entry.value === card.value && entry.suit === card.suit), false);
        const spectator = latestGame(viewer.responses.slice(spectatorStart));
        assert.ok(spectator);
        assert.equal(spectator.localPlayerName, null);
        assert.equal(spectator.circle.players.find(entry => entry.name === "Alice").hand.cards.length, 1);
        assert.deepEqual(spectator.discardPile, result.discardPile);
    });
}

function readJavaScriptSources(directory) {
    const sources = [];

    for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const entryUrl = new URL(entry.name, directory);

        if (entry.isDirectory()) {
            sources.push(...readJavaScriptSources(new URL(`${entry.name}/`, directory)));
        } else if (entry.name.endsWith(".js")) {
            sources.push(readFileSync(entryUrl, "utf8"));
        }
    }

    return sources;
}

test("Host seeds configured bot players and leaves every remaining seat open", async () => {
    const host = new Host(new HostConfig("direct", 0, false, false, true, null), new Game());
    const peer = createPeer(host);
    const home = (await peer.request(Constants.ACTIONS.LIST))
        .findLast((response) => response.view === Constants.VIEWS.HOME).data;

    assert.deepEqual(
        home.rooms.map(({roomName, playerLimit, playerCount}) => ({roomName, playerLimit, playerCount})),
        Constants.DEFAULT_ROOMS.map(({roomName, playerLimit, botCount}) => ({
            roomName,
            playerLimit,
            playerCount: botCount
        }))
    );
    assert.equal(home.mode, "direct");
    assert.equal(home.capabilities.botFill, true);
    await peer.connection.close();
    await host.shutdown();
});

test("a custom local game fills its open seats with bots immediately", async () => {
    const host = new Host(new HostConfig("direct", "fill", false, false, true, null), new Game());
    const peer = createPeer(host);
    const responses = await peer.request(Constants.ACTIONS.CREATE, {
        roomName: "Local Game",
        playerName: "Daniel",
        playerLimit: 4
    });
    const game = latestGame(responses);

    assert.equal(game.playerCount, 4);
    assert.equal(game.localPlayerName, "Daniel");
    assert.deepEqual(
        game.circle.players.map((player) => player.name),
        ["Daniel", ...Constants.DIRECT_OPPONENT_NAMES]
    );
    await peer.connection.close();
    await host.shutdown();
});

test("the shared Host rejects every join while a room is playing", async () => {
    const host = new Host(new HostConfig("hosted", 0, false, false, false, null), new Game());
    const owner = createPeer(host, "owner");
    const guest = createPeer(host, "guest");
    const lateGuest = createPeer(host, "late");

    await owner.request(Constants.ACTIONS.CREATE, {
        roomName: "Network Game",
        playerName: "Daniel",
        playerLimit: 3
    });
    await guest.request(Constants.ACTIONS.JOIN, {
        roomName: "Network Game",
        playerName: "Casey"
    });
    await owner.request(Constants.ACTIONS.START);
    const rejected = await lateGuest.request(Constants.ACTIONS.JOIN, {
        roomName: "Network Game",
        playerName: "Jordan"
    });

    assert.match(rejected.findLast((response) => response.message)?.message?.message ?? "", /in progress/i);
    await owner.connection.close();
    await guest.connection.close();
    await lateGuest.connection.close();
    await host.shutdown();
});

test("a player can leave a hosted room while it is playing", async () => {
    const host = new Host(new HostConfig("hosted", 0, false, false, false, null), new Game());
    const owner = createPeer(host, "owner");
    const guest = createPeer(host, "guest");

    await owner.request(Constants.ACTIONS.CREATE, {
        roomName: "Active Room",
        playerName: "Daniel",
        playerLimit: 3
    });
    await guest.request(Constants.ACTIONS.JOIN, {
        roomName: "Active Room",
        playerName: "Casey"
    });
    await owner.request(Constants.ACTIONS.START);

    const homeResponses = await guest.request(Constants.ACTIONS.LEAVE);
    const home = homeResponses.findLast((response) => response.view === Constants.VIEWS.HOME);

    assert.ok(home);
    const activeRoom = home.data.rooms.find((room) => room.roomName === "Active Room");

    assert.ok(activeRoom);
    assert.equal(activeRoom.playerCount, 1);
    await owner.connection.close();
    await guest.connection.close();
    await host.shutdown();
});

test("Host persistence stores only custom definitions through one small API", async () => {
    const calls = [];
    const store = {
        async load() {
            calls.push(["load"]);
            return [];
        },
        async save(definition) {
            calls.push(["save", definition]);
        },
        async remove(key) {
            calls.push(["remove", key]);
        }
    };
    const host = new Host(new HostConfig("direct", "fill", false, false, true, store), new Game());
    const peer = createPeer(host, "owner");

    await peer.request(Constants.ACTIONS.CREATE, {
        roomName: "Saved Game",
        playerName: "Daniel",
        playerLimit: 3
    });
    const home = (await peer.request(Constants.ACTIONS.LEAVE))
        .findLast((response) => response.view === Constants.VIEWS.HOME).data;
    await peer.connection.close();

    assert.equal(home.rooms.some((room) => room.roomName === "Saved Game"), false);
    assert.deepEqual(calls[0], ["load"]);
    assert.deepEqual(calls.find(([type]) => type === "save")?.[1], {
        roomName: "Saved Game",
        playerLimit: 3,
        botCount: 2
    });
    assert.deepEqual(calls.find(([type]) => type === "remove"), ["remove", "saved-game"]);
    await host.shutdown();
});

test("Client adds shared fields to every endpoint request", () => {
    let callbacks;
    let request;
    const endpoint = {
        open(nextCallbacks) {
            callbacks = nextCallbacks;
            return {
                request(nextRequest) {
                    request = nextRequest;
                    return true;
                },
                close() {}
            };
        }
    };
    const client = new Client(endpoint);
    const statuses = [];
    const dataEvents = [];
    client.sortKey = "rank";
    client.open(new ClientEvents(
        {handleData() {}},
        (status) => statuses.push(status),
        (view, data) => dataEvents.push({view, data})
    ));

    assert.equal(client.request(Constants.ACTIONS.CREATE, {roomName: "Test"}), true);
    assert.equal(request.action, Constants.ACTIONS.CREATE);
    assert.equal(request.data.roomName, "Test");
    assert.equal(request.data.sortKey, "rank");
    assert.equal(typeof request.data.tabId, "string");

    callbacks.status("reconnecting", "Reconnecting…");
    callbacks.receive({view: Constants.VIEWS.ROOM, message: null, data: {version: 2}});
    assert.deepEqual(statuses, ["reconnecting"]);
    assert.deepEqual(dataEvents, [{view: Constants.VIEWS.ROOM, data: {version: 2}}]);
});

test("browser and Node runtime import graphs stay separate", () => {
    const host = readFileSync(new URL("../../runtime/Host.js", import.meta.url), "utf8");
    const browser = readFileSync(new URL("../../runtime/Browser.js", import.meta.url), "utf8");
    const networkClient = readFileSync(new URL("../../runtime/NetworkClient.js", import.meta.url), "utf8");
    const network = readFileSync(new URL("../../runtime/Network.js", import.meta.url), "utf8");

    assert.doesNotMatch(host, /from ["'](?:node:|express|ws)/);
    assert.doesNotMatch(host, /\b(?:document|localStorage|sessionStorage|WebSocket)\b/);
    assert.match(browser, /from "\.\/Host\.js"/);
    assert.doesNotMatch(browser, /from ["'](?:node:|express|ws)/);
    assert.doesNotMatch(networkClient, /from ["'](?:node:|express|ws)/);
    assert.match(network, /from "\.\/Host\.js"/);
    assert.match(network, /from "node:/);
    assert.match(network, /from "ws"/);
    assert.doesNotMatch(network, /\.\/Browser\.js|\.\/NetworkClient\.js/);
});

test("application source uses explicit, named control flow", () => {
    const source = [
        readFileSync(new URL("../main.js", import.meta.url), "utf8"),
        readJavaScriptSources(new URL("../../core/", import.meta.url)).join("\n"),
        readJavaScriptSources(new URL("../../runtime/", import.meta.url)).join("\n"),
        readJavaScriptSources(new URL("../../ui/", import.meta.url)).join("\n")
    ].join("\n");

    assert.doesNotMatch(source, /=>/);
    assert.doesNotMatch(source, /\boptions\s*=\s*\{\}/);
});

test("Direct and Hosted modes share one Home page and one Room page", () => {
    const homeHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const gameHtml = readFileSync(new URL("../room.html", import.meta.url), "utf8");
    const main = readFileSync(new URL("../main.js", import.meta.url), "utf8");
    const network = readFileSync(new URL("../../runtime/Network.js", import.meta.url), "utf8");
    const homeCss = readFileSync(
        new URL("../../ui/styles/home.css", import.meta.url),
        "utf8"
    );

    assert.match(homeHtml, /<body data-game="pick2" data-page="home">/);
    assert.doesNotMatch(homeHtml, /pick-2-shared-root/);
    assert.match(homeHtml, /id="registration-form"/);
    assert.match(homeHtml, /id="list-table-body"/);
    const homeDecoration = readFileSync(new URL("../ui/controllers/HomeController.js", import.meta.url), "utf8");
    const sharedHeaderPattern = /<header id="app-header">\s*<h1>\s*<a id="app-home-link"[\s\S]*?<span class="brand-mark"[\s\S]*?<span class="brand-copy">[\s\S]*?<\/h1>\s*<aside id="connection-status"/;

    assert.match(homeHtml, sharedHeaderPattern);
    assert.match(gameHtml, sharedHeaderPattern);
    assert.equal(homeHtml.match(/id="app-header"/g)?.length, 1);
    assert.equal(homeHtml.match(/id="app-footer"/g)?.length, 1);
    assert.equal(gameHtml.match(/id="app-header"/g)?.length, 1);
    assert.equal(gameHtml.match(/id="app-footer"/g)?.length, 1);
    assert.match(homeHtml, /<aside[^>]+id="connection-status"[^>]+class="toggle-switch"[^>]+data-status="connecting"/);
    assert.match(homeHtml, /<aside[^>]+id="connection-status"[^>]*>\s*<label>\s*<input id="direct-mode-input"/);
    assert.match(homeHtml, /id="direct-mode-input"[^>]+value="direct"/);
    assert.match(homeHtml, /id="hosted-mode-input"[^>]+value="hosted"/);
    assert.doesNotMatch(homeHtml, /id="connection-status-indicator"/);
    assert.doesNotMatch(homeHtml, /id="play-mode-group"|id="local-room-note"|id="connection-status-label"/);
    assert.match(homeHtml, /id="request-mode-control"[^>]+class="toggle-switch"[^>]+role="radiogroup"/);
    assert.doesNotMatch(homeHtml, /<fieldset|id="mode-group"/);
    assert.match(homeHtml, /id="list-panel"/);
    assert.doesNotMatch(homeHtml, /id="(?:request-mode-control|list-panel)" hidden/);
    assert.match(homeHtml, /<tbody id="list-table-body">[\s\S]*?class="empty-row"/);
    assert.doesNotMatch(homeHtml, /id="guide-section"/);
    assert.match(gameHtml, /<body data-game="pick2" data-page="room">/);
    assert.doesNotMatch(gameHtml, /pick-2-shared-root/);
    assert.match(homeHtml, /<article id="network-connection-view"[^>]+hidden>/);
    assert.match(gameHtml, /id="play-area"[^>]+data-status="waiting"[^>]+data-is-player-view="false"/);
    assert.match(gameHtml, /id="player-area"[^>]+data-is-turn-owner="false"[^>]+data-is-winner="false"/);
    assert.match(gameHtml, /id="player-summary"[\s\S]*?<span data-card-count="0"><\/span>/);
    assert.match(gameHtml, /class="playing-card-area" id="player-hand"/);
    assert.match(gameHtml, /class="playing-card-area" id="discard-pile"/);
    assert.doesNotMatch(gameHtml, /id="local-player-region"/);
    assert.match(gameHtml, /id="guide-section"/);
    assert.match(gameHtml, /<tr class="placeholder-row"[^>]*>[\s\S]*?<td>--<\/td>/);
    assert.doesNotMatch(gameHtml, /id="room-mode-label"|id="connection-status-indicator"/);
    assert.match(homeHtml, /src="main\.js"/);
    assert.doesNotMatch(homeHtml, /network-connection\.js/);
    assert.match(homeHtml, /<aside>\s*<div class="card-fan" aria-hidden="true"><\/div>\s*<\/aside>/);
    assert.match(
        homeHtml,
        /<header class="hero">\s*<section class="eyebrow">[\s\S]*?<section>\s*<aside>[\s\S]*?<aside>\s*<div class="card-fan"/
    );
    assert.match(
        homeCss,
        /\.hero > section:last-child\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:/
    );
    const cardCss = readFileSync(new URL("../ui/styles/home.css", import.meta.url), "utf8");
    assert.match(cardCss, /\.card-fan\s*\{[\s\S]*?position:\s*relative;/);
    assert.match(cardCss, /\.card-fan > playing-card\s*\{[\s\S]*?position:\s*absolute;/);
    assert.match(cardCss, /--card-rotation:\s*-24deg;/);
    assert.doesNotMatch(homeCss, /\.card-fan/);
    assert.doesNotMatch(homeHtml, /class="[^"]*card-fan[^"]*playing-card-area/);
    assert.match(homeDecoration, /new Card\(VALUE\.TWO\.id, SUIT\.CLUBS, 0\)/);
    assert.match(homeDecoration, /new Card\(VALUE\.EIGHT\.id, SUIT\.DIAMONDS, 0\)/);
    assert.match(homeDecoration, /new Card\(VALUE\.JACK\.id, SUIT\.SPADES, 0\)/);
    assert.match(homeDecoration, /new Card\(VALUE\.ACE\.id, SUIT\.HEARTS, 0\)/);
    assert.match(homeDecoration, /\.sort\(compareCardScores\)/);
    assert.match(homeDecoration, /PlayingCard\.create\(card\)/);
    assert.match(homeDecoration, /element\.rotation = null/);
    assert.match(gameHtml, /src="main\.js"/);
    assert.match(homeHtml, /href="ui\/styles\/home\.css"/);
    assert.match(gameHtml, /href="ui\/styles\/room\.css"/);
    assert.match(homeHtml, /href="\.\.\/ui\/styles\/base\.css"/);
    assert.match(gameHtml, /href="\.\.\/ui\/styles\/base\.css"/);
    assert.match(homeHtml, /href="\.\.\/ui\/styles\/table\.css"/);
    assert.match(gameHtml, /href="\.\.\/ui\/styles\/table\.css"/);
    assert.ok(homeHtml.indexOf("styles/table.css") < homeHtml.indexOf("styles/home.css"));
    assert.ok(gameHtml.indexOf("styles/table.css") < gameHtml.indexOf("styles/room.css"));
    assert.doesNotMatch(homeHtml, /table-data\.css/);
    assert.doesNotMatch(gameHtml, /table-data\.css/);
    assert.doesNotMatch(homeHtml + gameHtml, /<caption\b/);
    assert.match(homeHtml, /<button id="enter-button">Enter room<\/button>/);
    assert.match(homeHtml, /<button id="alert-ok-button">OK<\/button>/);
    assert.match(gameHtml, /<button id="room-play-button">Play<\/button>/);
    assert.match(gameHtml, /<button id="room-invite-button" type="button" hidden>Invite<\/button>/);
    assert.match(gameHtml, /<button id="countdown-ok-button">OK<\/button>/);
    assert.match(gameHtml, /<button id="suit-selection-timeout-button">timeout<\/button>/);
    assert.match(gameHtml, /<button id="suit-selection-submit-button">Submit<\/button>/);
    assert.match(gameHtml, /<button id="results-dismiss-button">dismiss<\/button>/);
    assert.doesNotMatch(homeHtml + gameHtml, /id="(?:quick-start|core-rules|special-cards)"/);
    assert.match(main, /new Browser\(new Game\(\)\)/);
    assert.match(main, /new NetworkClient/);
    assert.match(network, /app\.use\(express\.static\(repositoryPath\)\)/);
    assert.doesNotMatch(network, /network\/index\.html/);
    assert.doesNotMatch(network, /\["\/network", "\/network\/", "\/network\/index\.html"\]/);
    assert.doesNotMatch(network, /response\.redirect\([^)]*\/(?:room|game)/);
    assert.doesNotMatch(network, /web\/network/);
});

test("the finished dialog opens once per finish and clears for a new game", () => {
    const controller = readFileSync(new URL("../ui/controllers/RoomController.js", import.meta.url), "utf8");
    const resultsController = readFileSync(new URL("../ui/controllers/ResultsController.js", import.meta.url), "utf8");

    assert.match(
        controller,
        /previousStatus !== Constants\.STATUS\.FINISHED[\s\S]*?nextStatus === Constants\.STATUS\.FINISHED[\s\S]*?#resultsController\.show\(room\)/
    );
    assert.match(
        controller,
        /localPlayer === null \|\| nextStatus !== Constants\.STATUS\.FINISHED[\s\S]*?#resultsController\.hide\(\)/
    );
    assert.match(
        resultsController,
        /hide\(\)\s*\{[\s\S]*?#players = \[\];[\s\S]*?#statsBody\.replaceChildren\(\);[\s\S]*?#selectedPlayerCards\.replaceChildren\(\);[\s\S]*?super\.hide\(\)/
    );
});

test("the shared table stylesheet owns foundational row states", () => {
    const baseCss = readFileSync(new URL("../../ui/styles/base.css", import.meta.url), "utf8");
    const homeCss = readFileSync(new URL("../../ui/styles/home.css", import.meta.url), "utf8");
    const gameCss = readFileSync(new URL("../ui/styles/room.css", import.meta.url), "utf8");
    const overlaysCss = (readFileSync(new URL("../../ui/styles/overlays.css", import.meta.url), "utf8") + readFileSync(new URL("../ui/styles/overlays.css", import.meta.url), "utf8"));
    const tableCss = readFileSync(new URL("../../ui/styles/table.css", import.meta.url), "utf8");

    assert.doesNotMatch(baseCss, /^(?:table|th|td|tbody tr|\.table-container)\b/m);
    for (const componentCss of [homeCss, gameCss, overlaysCss]) {
        assert.doesNotMatch(componentCss, /\b(?:th|td)\s*\{[^}]*\bborder(?:-\w+)?:/);
        assert.doesNotMatch(componentCss, /tbody tr(?::is\([^)]*\)|:(?:hover|focus-visible)|\[data-is-selected="true"\])\s*\{/);
    }
    assert.match(tableCss, /table:has\(> tbody:empty\)::after\s*\{/);
    assert.match(tableCss, /tr\s*\{[\s\S]*?border-bottom:\s*1px solid color-mix\(in srgb, var\(--white\) 8%, transparent\)/);
    assert.match(tableCss, /tbody tr:is\(:hover, :focus-visible\)\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--cyan\) 12%, transparent\)/);
    assert.match(tableCss, /tbody tr:focus-visible\s*\{[\s\S]*?outline-offset:\s*-3px/);
    assert.match(tableCss, /tbody tr\[data-is-selected="true"\]\s*\{\s*color:\s*var\(--cyan\);\s*\}/);
    assert.match(tableCss, /th\s*\{[\s\S]*?font-size:\s*9px;[\s\S]*?font-weight:\s*800;[\s\S]*?letter-spacing:\s*\.1em;/);
    assert.doesNotMatch(homeCss + gameCss + overlaysCss, /--table-heading-(?:color|font-size|font-weight|letter-spacing)/);
});

test("responsive styles are mobile-first with one tablet and desktop stage", () => {
    const styleNames = [
        "../../ui/styles/base.css",
        "../../ui/styles/home.css",
        "../../ui/styles/dashboard.css",
        "../ui/styles/room.css"
    ];

    for (const styleName of styleNames) {
        const css = readFileSync(new URL(styleName, import.meta.url), "utf8");
        assert.doesNotMatch(css, /@media\s*\(max-width:/);
        assert.equal(css.match(/@media\s*\(min-width:\s*721px\)/g)?.length, 1);
    }

    const html = ["../room.html"]
        .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
        .join("\n");
    const baseCss = readFileSync(new URL("../../ui/styles/base.css", import.meta.url), "utf8");

    assert.doesNotMatch(html, /styles\/(?:tokens|app-footer|app-header)\.css/);
    assert.match(baseCss, /:root\s*\{[\s\S]*?--container-spacing:/);
    assert.match(baseCss, /#app-header\s*\{/);
    assert.match(baseCss, /#app-footer\s*\{/);
});

test("shared controllers depend on Client vocabulary rather than runtime services", () => {
    const homeController = readFileSync(new URL("../../ui/controllers/HomeController.js", import.meta.url), "utf8");
    const gameController = readFileSync(new URL("../../ui/controllers/RoomController.js", import.meta.url), "utf8");

    for (const source of [homeController, gameController]) {
        assert.doesNotMatch(source, /Static|ConnectionService|LocalGameService|ServerSessionController/);
        assert.match(source, /this\.client/);
    }

    assert.match(homeController, /row\.addEventListener\("click"/);
    assert.match(homeController, /row\.addEventListener\("keydown"/);
    assert.match(homeController, /row\.tabIndex = 0/);
    assert.match(homeController, /Constants\.ACTIONS\.VIEW, \{roomName\}/);
    assert.doesNotMatch(homeController, /this\.#capabilities\.viewers === true/);
    assert.match(homeController, /cell\.textContent = "No rooms available\."/);
    assert.match(homeController, /for \(const input of \[this\.#directModeInput, this\.#hostedModeInput\]\)/);
    assert.match(homeController, /input\.value/);
    assert.match(homeController, /registrationMode === "join" && !isGameListed/);
    assert.match(homeController, /title: "Room not found"/);
    assert.match(gameController, /this\.room === null && !this\.#isLeaving/);
});

test("the landing page keeps canonical search metadata", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const sitemap = readFileSync(new URL("../../sitemap.xml", import.meta.url), "utf8");
    const canonicalUrl = "https://danieltongu.github.io/games/";

    assert.match(html, /<title>Card &amp; Dice Games \| Choose your next game<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonicalUrl}">`));
    assert.match(sitemap, new RegExp(`<loc>${canonicalUrl}<\\/loc>`));
});

test("the shared game preserves touch-friendly card presentation", () => {
    const html = readFileSync(new URL("../room.html", import.meta.url), "utf8");
    const cardCss = readFileSync(new URL("../../cards/ui/playing-card.css", import.meta.url), "utf8") + readFileSync(new URL("../ui/styles/room.css", import.meta.url), "utf8");
    const gameCss = readFileSync(new URL("../ui/styles/room.css", import.meta.url), "utf8");
    const homeCss = readFileSync(new URL("../../ui/styles/home.css", import.meta.url), "utf8");
    const controller = readFileSync(new URL("../ui/controllers/LocalPlayerController.js", import.meta.url), "utf8");

    assert.doesNotMatch(html, /id="card-size-range"/);
    assert.match(cardCss, /--card-height:\s*max\(100cqh, var\(--card-height-min\)\)/);
    assert.match(cardCss, /\.playing-card-drag-handle\s*\{[\s\S]*?width:\s*100%/);
    assert.match(cardCss, /\.playing-card-area:not\(#discard-pile\)[\s\S]*overflow-x:\s*auto/);
    assert.match(gameCss, /@keyframes turn-owner-border-strobe/);
    assert.match(gameCss, /\[data-is-player-view="false"\] > #player-area/);
    assert.match(homeCss, /\.toggle-switch > label:has\(input:checked\) > span/);
    assert.match(controller, /setBooleanState\(this\.#playArea, "isPlayerView", true\)/);
    assert.match(controller, /setBooleanState\(this\.#playArea, "isPlayerView", false\)/);
    assert.doesNotMatch(controller, /#local-player|isTurnBound/);
});
