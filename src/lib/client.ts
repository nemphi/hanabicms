import type { CollectionFields, FieldValues } from "./collections";
import type { ApiRecordResponse, ApiRecordsResponse, ApiSimpleResponse } from "./types";


export class Client<T extends { [K in keyof T]: T[K] extends { fields: CollectionFields } ? (T[K] & { fields: CollectionFields }) : never }> {

    constructor(private url: string, private token: string, private collections: T) { }

    collection<K extends keyof T>(name: K) {
        return new Collection<FieldValues<Extract<T[K], { fields: CollectionFields }>["fields"]>>(this.url, name.toString(), this.token);
    }
}

export class Collection<T> {

    constructor(private url: string, private name: string, private token: string) { }

    async get(id: string): Promise<ApiRecordResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return res.json();
    }

    async list(): Promise<ApiRecordsResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return res.json();
    }

    async create(data: T): Promise<ApiSimpleResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req)
        return res.json();
    }

    async update(id: string, data: T): Promise<ApiSimpleResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req)
        return res.json();
    }

    async delete(id: string): Promise<ApiSimpleResponse<T>> {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req)
        return res.json();
    }
}
