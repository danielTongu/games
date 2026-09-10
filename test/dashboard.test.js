"use strict";

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { Card } from "../pick2/core/Card.js";
import { Constants } from "../pick2/core/Constants.js";

const root = new URL("../", import.meta.url);

test("the dashboard offers Pick 2 and clearly marks future games without dead links", () => {
    const html = readFileSync(new URL("index.html", root), "utf8");
    assert.match(html, /<body data-page="games">/);
    assert.match(html, /<a class="game-tile" href="pick2\/index.html"/);
    assert.equal(html.match(/class="game-tile"/g)?.length, 3);
    assert.equal(html.match(/Coming soon/g)?.length, 2);
    assert.doesNotMatch(html, /<(?:button|input|select)\b|tabindex=|href="#"/);
    assert.doesNotMatch(html, /src="main.js"/);
    for (const title of ["Poker", "Yahtzee"]) {
        assert.match(html, new RegExp(`<article class="game-tile"[\\s\\S]*?<h3[^>]*>${title}</h3>[\\s\\S]*?Coming soon[\\s\\S]*?</article>`));
    }
    for (const match of html.matchAll(/<playing-card data-value="([^"]+)" data-suit="([^"]+)"/g)) {
        assert.doesNotThrow(() => new Card(match[1], match[2], 0));
    }
});

test("dashboard, lobby, and room resolve their local assets and navigation under a subdirectory", () => {
    for (const page of ["index.html", "pick2/index.html", "pick2/room.html"]) {
        const html = readFileSync(new URL(page, root), "utf8");
        for (const [, target] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            if (/^(?:https?:|#)/.test(target)) continue;
            assert.ok(existsSync(new URL(target, new URL(page, root))), `${page}: missing ${target}`);
            const url = new URL(target, `https://example.test/games/${page}`);
            assert.ok(url.pathname.startsWith("/games/"), `${page}: lost base path`);
        }
    }
    const lobby = readFileSync(new URL("pick2/index.html", root), "utf8");
    assert.match(lobby, /href="\.\.">All games<\/a>/);
    assert.match(lobby, /rel="canonical" href="https:\/\/danieltongu.github.io\/games\/pick2\/"/);
});

/** Runs the real page entry point with a controlled transport and browser location. */
async function startRoomPage(basePath, mode, validIntent) {
    const state = {redirects: [], errors: [], cleared: false, closed: false, notice: null};
    let homeHandler;
    class FakeRoomController {
        setClient() {}
        setIntent() {}
        setReadyHandler() {}
        setHomeHandler(handler) { homeHandler = handler; }
        async initialize() {}
    }
    class FakeClient {
        open() {}
        close() { state.closed = true; }
    }
    const context = {
        Constants,
        URL,
        URLSearchParams,
        renderYear() {},
        document: {body: {dataset: {page: "room"}}},
        location: {
            href: `https://example.test${basePath}room.html?mode=${mode}`,
            search: `?mode=${mode}`,
            assign(url) { state.redirects.push({method: "assign", url}); },
            replace(url) { state.redirects.push({method: "replace", url}); }
        },
        window: {addEventListener() {}},
        console: {error(...args) { state.errors.push(args); }},
        PageState: {
            getMode() { return mode; },
            getIntent() {
                return validIntent ? {mode, action: Constants.ACTIONS.JOIN, data: {roomName: "Test"}} : null;
            },
            getHostedUrl() { return "wss://example.test/"; },
            clearIntent() { state.cleared = true; },
            setNotice(notice) { state.notice = notice; }
        },
        Game: class {},
        Browser: class {},
        NetworkClient: class {},
        Client: FakeClient,
        ClientEvents: class {},
        RoomController: FakeRoomController,
        GuideController: class { initialize() {} }
    };
    const source = readFileSync(new URL("pick2/main.js", root), "utf8").replace(/^import .+;\n/gm, "");
    await runInNewContext(`(async function () { ${source} })()`, context);
    assert.deepEqual(state.errors, []);
    return {state, returnHome: homeHandler};
}

test("room exits, failed admissions, and missing intents return to the lobby with mode and base path intact", async () => {
    for (const basePath of ["/pick2/", "/games/pick2/"]) {
        for (const mode of ["direct", "hosted"]) {
            const url = `https://example.test${basePath}index.html?mode=${mode}`;
            const invalid = await startRoomPage(basePath, mode, false);
            assert.deepEqual(invalid.state.redirects, [{method: "replace", url}]);

            const leaving = await startRoomPage(basePath, mode, true);
            leaving.returnHome(null);
            assert.deepEqual(leaving.state.redirects, [{method: "assign", url}]);
            assert.equal(leaving.state.cleared, true);
            assert.equal(leaving.state.closed, true);

            const failed = await startRoomPage(basePath, mode, true);
            const notice = {status: "error", message: "Room not found"};
            failed.returnHome(notice);
            assert.deepEqual(failed.state.redirects, [{method: "replace", url}]);
            assert.equal(failed.state.notice, notice);
            assert.equal(failed.state.cleared, true);
            assert.equal(failed.state.closed, true);
        }
    }
});
