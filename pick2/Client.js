import { Client as SharedClient } from "../runtime/Client.js";
import { Constants } from "./core/Constants.js";
import { ValidationUtils } from "../core/ValidationUtils.js";

/** Pick2 request preferences layered over the shared connection client. */
export class Client extends SharedClient {
    #sortKey = Constants.CARD.SORT_OPTIONS[0];
    get sortKey() { return this.#sortKey; }
    set sortKey(value) { this.#sortKey = ValidationUtils.requiredString(value, "Sort key"); }
    request(action, data) {
        return super.request(action, {...data, sortKey: this.#sortKey});
    }
}
