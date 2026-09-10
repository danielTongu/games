import { Constants } from "./core/Constants.js";
import { Room } from "./core/Room.js";
import { Card } from "./core/Card.js";
import { BotPlayer } from "./core/BotPlayer.js";
import { StateMapper } from "./core/StateMapper.js";
import { ValidationUtils } from "../core/ValidationUtils.js";

/** Pick2's explicit contract with the shared hosting infrastructure. */
export class Game {
    id = "pick2";
    constants = Constants;
    stateMapper = StateMapper;
    welcomeMessage = "Your hand is below the discard pile.\nGood luck!";
    actions = Object.freeze({
        draw: Object.freeze({player: 400, room: 100}),
        discard: Object.freeze({player: 250, room: 100}),
        return: Object.freeze({player: 250, room: 100}),
        pass: Object.freeze({player: 250, room: 100}),
        declare: Object.freeze({player: 250, room: 100})
    });

    createRoom(name, playerLimit) {
        return new Room(name, playerLimit);
    }

    async act(room, playerName, action, data) {
        let drawn = [];
        let mocked = true;
        switch (action) {
            case Constants.ACTIONS.DRAW:
                drawn = await room.drawCards(playerName, data.sortKey);
                mocked = room.status === Constants.STATUS.PLAYING && drawn.length > 1;
                break;
            case Constants.ACTIONS.DISCARD: {
                const card = Card.from(data.card);
                drawn = await room.discardCard(playerName, card.value, card.suit, data.sortKey);
                break;
            }
            case Constants.ACTIONS.RETURN: {
                const card = Card.from(data.card);
                await room.returnCard(playerName, card.value, card.suit, data.sortKey);
                break;
            }
            case Constants.ACTIONS.PASS:
                drawn = await room.passTurn(playerName, data.sortKey);
                break;
            case Constants.ACTIONS.DECLARE:
                await room.declareSuit(Constants.normalizeStandardSuit(ValidationUtils.requiredString(data.suit, "Suit")));
                break;
        }
        if (drawn.length === 0) return null;
        const emoji = mocked ? `\n\n${Constants.EMOJIS.silly.random}` : "";
        return {status: Constants.STATUS.INFO, title: "Cards Drawn", message: `+${drawn.length} ${emoji}`};
    }

    async runAutomatedTurn(room) {
        const turnOwner = room.circle.getTurnOwner();
        if (!(turnOwner instanceof BotPlayer)) return false;
        if (room.status === Constants.STATUS.PENDING) {
            await turnOwner.chooseSuit(room);
            return true;
        }
        if (room.status === Constants.STATUS.PLAYING) {
            await turnOwner.takeTurn(room);
            return true;
        }
        return false;
    }
}
