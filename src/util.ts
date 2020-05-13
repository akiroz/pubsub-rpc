
export function encodeBase64URL(data: Uint8Array): string {
    const base64 = Buffer
        ? Buffer.from(data).toString("base64")
        : btoa(String.fromCharCode(...data));
    return base64
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export function generateCallId(size: number): Uint8Array {
    if(window) {
        const id = new Uint8Array(size);
        if(window.crypto) window.crypto.getRandomValues(id);
        else for(let i = 0; i < size; i++) {
            id[i] = Math.floor(Math.random() * 265);
        }
        return id;
    } else {
        return require("crypto").randomBytes(size);
    }
}