import * as MsgPack from "@msgpack/msgpack";
import { EventEmitter2 } from "eventemitter2";
import DedupCache from "./dedupCache";
import { encodeBase64URL, generateCallId } from "./util";

export type RPCRequest = { id: Uint8Array; params: any };

export type RPCResponse = { result: any } & { error: { message: string; data?: any } };

export type PubSubClient = {
    publish(topic: string, payload: Uint8Array): Promise<void>;
    subscribe(topic: string, handler: (payload: Uint8Array, topic: string) => void): Promise<void>;
    unsubscribe(topic: string): Promise<void>;
};

const idDedup = new DedupCache(100);

export async function register<T extends { [k: string]: any }, R extends { [k: string]: any }>(
    client: PubSubClient,
    topic: string,
    handler: (arg: T) => Promise<R>
) {
    await client.subscribe(topic, async (msg, msgTopic) => {
        try {
            const { id, params } = MsgPack.decode(msg) as RPCRequest;
            if (!id) throw Error("Missing id in RPC call");
            const strId = encodeBase64URL(id);
            if (idDedup.has(strId)) throw Error("Duplicate call request");
            idDedup.put(strId);
            const response = await handler(params)
                .then((result) => ({ result }))
                .catch((error) => ({ error }));
            await client.publish(`${msgTopic}/${strId}`, MsgPack.encode(response));
        } catch (err) {
            console.warn("RPC processing error", err);
        }
    });
}

export async function call(
    client: PubSubClient,
    topic: string,
    params: any = {},
    opt = { timeout: 10000 }
): Promise<any> {
    const id = generateCallId(16);
    const strId = encodeBase64URL(id);
    const ee = new EventEmitter2();
    const responseTopic = `${topic}/${strId}`;
    await client.subscribe(responseTopic, (msg) => ee.emit("resp", msg));
    client.publish(topic, MsgPack.encode({ id, params }));
    const msg = (await Promise.race([
        new Promise((rsov, rjct) =>
            ee.once("resp", (payload) => {
                client.unsubscribe(responseTopic);
                rsov(payload);
            })
        ),
        new Promise((rsov, rjct) =>
            setTimeout(() => {
                client.unsubscribe(responseTopic);
                rjct({ message: "timeout", data: { topic, params, opt } });
            }, opt.timeout)
        ),
    ])) as Uint8Array;
    const { result, error } = MsgPack.decode(msg) as RPCResponse;
    if (error) throw error;
    return result;
}
