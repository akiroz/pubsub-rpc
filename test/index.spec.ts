import { strict as assert } from "assert";
import * as RPC from "../src/main";
import { EventEmitter2 } from "eventemitter2";

let pubSub: RPC.PubSubClient;

describe("RPC", () => {
    beforeEach(() => {
        const ee = new EventEmitter2({ wildcard: true, delimiter: "/" });
        pubSub = {
            async publish(topic, payload) {
                await ee.emitAsync(topic, payload, topic);
            },
            async subscribe(topic, handler) {
                ee.on(topic, handler);
            },
            async unsubscribe(topic) {
                ee.removeAllListeners(topic);
            },
        };
    });

    it("can call remote function", async () => {
        await RPC.register(pubSub, "topic/foo", async (param) => param);
        await RPC.call(pubSub, "topic/foo");
    });

    it("can send/recv params/result", async () => {
        await RPC.register(pubSub, "topic/foo", async ({ a, b }) => ({ c: a + b }));
        const { c } = await RPC.call(pubSub, "topic/foo", { a: 2, b: 3 });
        assert.equal(c, 5);
    });

    it("can register with wildcards", async () => {
        await RPC.register(pubSub, "*/foo", async (param) => param);
        const { test1 } = await RPC.call(pubSub, "1/foo", { test1: "test1" });
        const { test2 } = await RPC.call(pubSub, "2/foo", { test2: "test2" });
        assert.equal(test1, "test1");
        assert.equal(test2, "test2");
    });

    it("can read topic from handler", async () => {
        await RPC.register(pubSub, "topic/*", async (arg, topic) => ({ topic }));
        const { topic } = await RPC.call(pubSub, "topic/foo");
        assert.equal(topic, "topic/foo");
    });

    it("should timeout if call took too long", async () => {
        await RPC.register(pubSub, "topic/foo", () => new Promise(() => {}));
        try {
            await RPC.call(pubSub, "topic/foo", {}, { timeout: 50 });
        } catch (err) {
            assert(err.message, "timeout");
        }
    });
});

after(() => {
    if (typeof window === "undefined") process.exit(0);
});
