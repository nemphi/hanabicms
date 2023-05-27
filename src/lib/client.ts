import { CollectionConfig, CollectionValues } from "./collections";
import { ApiResponse } from "./types";


export class Client {

    constructor(private url: string, private token: string, private collections: CollectionConfig[]) { }

    collection(name: string) {

        const collection = this.collections.find(c => c.name === name);

        if (!collection) {
            throw new Error(`Collection ${name} not found`);
        }

        return new Collection<CollectionValues<typeof collection>>(this.url, name, this.token);
    }
}

export class Collection<T> {

    constructor(private url: string, private name: string, private token: string) { }

    async get(id: string): Promise<ApiResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return await res.json();
    }

    async list(): Promise<ApiResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return await res.json();
    }

    async create(data: T) {
        const req = new Request(`${this.url}/data/${this.name}`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        return await fetch(req);
    }

    async update(id: string, data: T) {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        return await fetch(req);
    }

    async delete(id: string) {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        return await fetch(req);
    }
}
