import { strict as assert } from "assert";
import * as RPC from "../src/main";
import { EventEmitter } from "events";

let pubSub: RPC.PubSubClient;

describe("RPC", () => {
    beforeEach(() => {
        const ee = new EventEmitter();
        pubSub = {
            publish(topic, payload) {
                return new Promise(r => {
                    setTimeout(() => (ee.emit(topic, payload), r()), 0);
                });
            },
            subscribe(topic, handler) {
                return new Promise(r => {
                    setTimeout(() => (ee.on(topic, handler), r()), 0);
                });
            },
            unsubscribe(topic) {
                return new Promise(r => {
                    setTimeout(() => (ee.removeAllListeners(topic), r()), 0);
                });
            }
        };
    });

    it("can call remote function", async () => {
        await RPC.register(pubSub, "topic/foo", async () => ({}));
        await RPC.call(pubSub, "topic/foo");
    });

    it("can send/recv params/result", async () => {
        await RPC.register(pubSub, "topic/foo", async ({ a, b }) => ({ c: a+b }));
        const { c } = await RPC.call(pubSub, "topic/foo", { a:2, b:3 });
        assert.equal(c, 5);
    });

    it("should timeout if call took too long", async () => {
        await RPC.register(pubSub, "topic/foo", () => new Promise(() => {}));
        try {
            await RPC.call(pubSub, "topic/foo", {}, { timeout: 50 });
        } catch(err) {
            assert(err.message, "timeout");
        }
    });

});

after(() => { if(typeof window === 'undefined') process.exit(0) });