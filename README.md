# Games

The root dashboard presents card and dice games. Pick 2 is playable;
Poker and Yahtzee are marked as coming soon.

Pick 2 is a shedding card game with two play modes built from the same pages,
controllers, protocol, and game rules:

- **Direct:** browser-owned rooms; custom rooms fill their open seats with bots.
- **Hosted:** shared rooms for people, configured bot players, and viewers over WebSockets.

Shared infrastructure lives in `core/`, `runtime/`, and `ui/`. The optional
`cards/` library contains card identity, collections, sorting, and presentation.
Pick2 rules, scoring, bots, pages, and game-specific UI live in `pick2/`.

## Requirements

- Node.js 22
- npm

## Install

```bash
npm install
```

## Run the Hosted host

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080). Development watch mode is
available through `npm run dev`.

## Use static hosting

The game dashboard starts at the root `index.html`. Pick 2's Home page and room
directory live at `pick2/index.html`; an active Room and its guide live at
`pick2/room.html`. Serve the repository root with any static
web server. Direct play is always available. The Home page
enables Hosted mode when its configured WebSocket host is reachable.

Publish the static deployment manually using the hosting provider and release
process of your choice. This repository does not automatically publish changes
when `main` is pushed.

The published page declares its canonical URL and includes a root-level
`sitemap.xml`. After the first deployment, add
`https://danieltongu.github.io/games/` as a URL-prefix property in Google
Search Console, submit `https://danieltongu.github.io/games/sitemap.xml`, and
request indexing for the canonical page. Search engines decide when and whether
to index a page, so publication alone does not guarantee immediate appearance.

Direct and Hosted registries use the same `Constants.DEFAULT_ROOMS` definitions.
Each browser tab runs its own Direct match. User-created Direct rooms appear in
the Home room directory while active and are removed when their player leaves;
rooms backed by the default `Room` definitions remain available with only
their configured bot players, so any other seats remain open for humans. Player limit
ranges from two to four and includes the human seat. A static host cannot share
live state across browsers without Hosted mode.

## Test

```bash
npm test
```

Coverage reporting is available through `npm run test:coverage`.

## Project structure

```text
games/
├── index.html              All-games catalog
├── dashboard.js            Catalog entry point
├── server.js               Hosted server; selects a game implementation
├── core/                   Shared Room, Player, validation, and protocol
├── runtime/                Host, Client, Browser, Network, NetworkClient
├── ui/                     Shared Home/Room controllers and foundations
├── cards/                  Optional card models, collections, UI, and tests
├── pick2/
│   ├── index.html          Pick2 Home
│   ├── room.html           Pick2 Room
│   ├── main.js             Page entry point
│   ├── Game.js             Rules/hosting integration
│   ├── Client.js           Pick2 request preferences
│   ├── core/               Rules, scoring, players, bots, and state mapping
│   ├── ui/                 Pick2 controllers, styles, and templates
│   └── test/               Pick2 behavior tests
├── test/                   Shared architecture and catalog tests
└── docs/                   Design and maintenance documentation
```

The Home and Room controllers use one `Client` API. Direct play connects it
directly to the transport-neutral `Host`; Hosted play connects it through the
browser-only `NetworkClient` and Node-only `Network` boundary. Both return the
same `{ view, message, data }` envelope.

`Host.js` never imports browser or Node infrastructure. `Browser.js` and
`NetworkClient.js` are browser leaves, while `Network.js` is the only Node
networking leaf. This keeps incompatible runtime imports out of shared graphs.

The Node server and static hosts serve the exact same HTML, JavaScript, styles,
templates, and artwork. Nothing is copied or generated.

## Technology

- JavaScript ES modules
- Node.js, Express 5, and WebSockets through `ws`
- Semantic HTML and mobile-first CSS
- Node's built-in test runner
- Static hosting with Direct play and optional Hosted availability

## Documentation

See [Software documentation](docs/software-documentation.md) for room flow,
protocol details, data contracts, and extension guidance.

## License and copyright

Copyright © Pick 2. All rights reserved.

This software is proprietary and is not free or open-source software. No
permission is granted to copy, modify, distribute, sublicense, or use it outside
the terms provided by its owner.

## Adding another game

Create a sibling of `pick2/` with its own Home and Room pages. Reuse the shared
controllers and styles, and import `cards/` only if the game needs cards.
Shared code never imports an individual game.

`Host(config, game)`, `Browser(game)`, and `Network(config, game)` receive an
explicit game implementation. `pick2/Game.js` demonstrates room creation,
state mapping, move throttles, move dispatch, automated turns, and room defaults.
The current server hosts Pick2; serving multiple games concurrently will require
routing each connection to its selected game host. Room registries are per host,
and Direct storage and page intent are namespaced by game ID (`data-game`).

Templates resolve relative to their owning utility module, so shared and
game-specific assets work beneath a static hosting subdirectory. Configure a
separate WebSocket server with the `game-server-origin` meta tag.
