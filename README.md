# PubSub RPC

A generic RPC mechanism for Pub/Sub transports based on MsgPack

Supports NodeJS and modern browsers.

### Why not JSON-RPC?

Native binary support for passing large binary payloads.

### Mechanism

0. Callee subscribe to `topic`
1. Caller subscribe to `topic/${base64(id)}`
2. Caller publish to `topic` with a binary `id` (default 16 byte) in the payload
3. Callee calls RPC handler with `params` in the payload to get `result` or `error` response
4. Callee publish response to `topic/${base64(id)}`
5. Caller unsubscribe from `topic/${base64(id)}`

## API

```js
await register(pubSubClient, topic, async (params, topic) => {
    return result;
});

const result = await call(pubSubClient, topic, params);
```
