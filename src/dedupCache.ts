
export default class DedupCache<T> {
    a = <T[]> [];
    s = new Set<T>();
    max = 0;

    constructor(size: number) {
        this.max = size;
    }

    put(k: T) {
        if(this.s.has(k)) return;
        this.s.add(k);
        this.a.push(k);
        if(this.a.length > this.max) {
            const e = this.a.shift();
            this.s.delete(e);
        }
    }

    has(k: T): boolean {
        return this.s.has(k);
    }
}