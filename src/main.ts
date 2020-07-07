import { EventEmitter } from "events";
import * as MsgPack from "@msgpack/msgpack";
import DedupCache from "./dedupCache";
import { encodeBase64URL, generateCallId } from "./util";

export type RPCRequest = { id: Uint8Array; params: any };

export type RPCResponse = { result: any } & { error: { message: string; data?: any } };

export type PubSubClient = {
    publish(topic: string, payload: Uint8Array): Promise<void>;
    subscribe(topic: string, handler: (payload: Uint8Array, topic: string) => Promise<void>): Promise<void>;
    unsubscribe(topic: string): Promise<void>;
};

export type RPCParamResult = { [k: string]: any };

export type RPCHandler<P extends RPCParamResult, R extends RPCParamResult> = (
    param: P,
    topic: string
) => Promise<R | void>;

const idDedup = new DedupCache(100);

export async function register<P extends RPCParamResult, R extends RPCParamResult>(
    client: PubSubClient,
    topic: string,
    handler: RPCHandler<P, R>
) {
    await client.subscribe(topic, async (payload, msgTopic) => {
        if (!(payload instanceof Uint8Array)) throw Error(`Invalid payload: ${payload}`);
        const msg = MsgPack.decode(payload) as RPCRequest;
        if (!msg) throw Error(`Invalid payload: ${payload}`);
        const { id, params } = msg;
        if (!id) throw Error("Missing id in RPC call");
        const strId = encodeBase64URL(id);
        if (idDedup.has(strId)) throw Error("Duplicate call request");
        idDedup.put(strId);
        const response = await handler(params, msgTopic)
            .then((r) => ({ result: r || {} }))
            .catch((error) => ({ error }));
        await client.publish(`${msgTopic}/${strId}`, MsgPack.encode(response));
    });
}

export const defaultCallOptions = {
    timeout: 10000, // ms
    idSize: 16, // bytes
};

export async function call(
    client: PubSubClient,
    topic: string,
    params: RPCParamResult = {},
    opt: Partial<typeof defaultCallOptions> = defaultCallOptions
): Promise<any> {
    opt = Object.assign({}, defaultCallOptions, opt);
    const id = generateCallId(opt.idSize);
    const strId = encodeBase64URL(id);
    const ee = new EventEmitter();
    const responseTopic = `${topic}/${strId}`;
    const msg = (await Promise.race([
        (async () => {
            await client.subscribe(responseTopic, async (msg) => void ee.emit("resp", msg));
            client.publish(topic, MsgPack.encode({ id, params }));
            return await new Promise((rsov, rjct) =>
                ee.once("resp", (payload) => {
                    client.unsubscribe(responseTopic);
                    rsov(payload);
                })
            );
        })(),
        new Promise((rsov, rjct) =>
            setTimeout(() => {
                client.unsubscribe(responseTopic);
                rjct({ message: "timeout", data: { topic, params, opt, id } });
            }, opt.timeout)
        ),
    ])) as Uint8Array;
    const { result, error } = MsgPack.decode(msg) as RPCResponse;
    if (error) throw error;
    return result;
}
