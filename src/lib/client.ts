import { RecordMetadata } from "../api/records";
import { type CollectionFields, type FieldValues } from "./collections";
import type { ApiRecordResponse, ApiSimpleResponse } from "./types";

type collections = {
    [K: string]: {
        fields: CollectionFields,
        unique: boolean
    }
}


export class Client<T extends collections> {

    constructor(private url: string, private token: string, private collections: T) { }

    collection<K extends keyof T>(name: K) {
        const collection = this.collections[name];
        if (!collection) {
            throw new Error(`Collection ${name.toString()} not found`);
        }
        return new Collection<T[K]["fields"]>(this.url, name.toString(), this.token, collection);
    }

    async signIn(email: string, password: string): Promise<boolean> {
        try {
            const res = await fetch(`${this.url}/auth/signin`, {
                method: "POST",
                body: JSON.stringify({ email, password }),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (res.status !== 200) {
                return false;
            }

            const token = res.headers.get("X-Auth-Token")

            if (!token) {
                return false;
            }

            this.token = token;
            return true;
        } catch (e) {
            return false;
        }
    }

    async signOut(): Promise<boolean> {
        try {
            const res = await fetch(`${this.url}/auth/signout`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (res.status !== 200) {
                return false;
            }

            this.token = "";
            return true;
        } catch (e) {
            return false;
        }
    }
}

export class Collection<T extends CollectionFields> {

    constructor(private url: string, private name: string, private token: string, private collection: { fields: T, unique: boolean }) { }

    async get(id: string): Promise<ApiRecordResponse<FieldValues<T>>> {
        if (this.collection.unique) {
            id = "unique"
        }
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return res.json();
    }

    async list(): Promise<ApiSimpleResponse<{
        keys: KVNamespaceListResult<RecordMetadata>,
        cursor?: string,
    }>> {
        const req = new Request(`${this.url}/data/${this.name}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });
        const res = await fetch(req);
        return res.json();
    }

    async create(data: FieldValues<T>): Promise<ApiSimpleResponse<FieldValues<T>>> {

        // Check if collections fields contain an upload field
        const hasUpload = Object.values(this.collection.fields).some((field) => field.type === "upload");

        // If there is an upload field, we need to upload the file first
        if (hasUpload) {
            const formData = new FormData();

        }

        const req = new Request(`${this.url}/data/${this.name}`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
        });
        const res = await fetch(req)
        return res.json();
    }

    async update(id: string, data: FieldValues<T>): Promise<ApiSimpleResponse<FieldValues<T>>> {
        const req = new Request(`${this.url}/data/${this.name}/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
        });
        const res = await fetch(req)
        return res.json();
    }

    async delete(id: string): Promise<ApiSimpleResponse<FieldValues<T>>> {
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
