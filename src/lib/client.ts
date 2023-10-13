import { AppType } from "../api";
import { type CollectionFields, type FieldValues } from "./collections";
import { hc } from "hono/client";

type collections = {
    [K: string]: {
        fields: CollectionFields,
        unique: boolean
    }
}


export class Client<T extends collections> {

    private client: ReturnType<typeof hc<AppType>>;

    constructor(private url: string, token: string, private collections: T) {
        this.client = hc<AppType>(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    collection<K extends keyof T>(name: K) {
        const collection = this.collections[name];
        if (!collection) {
            throw new Error(`Collection ${name.toString()} not found`);
        }
        return new Collection<T[K]["fields"]>(this.client, name.toString(), collection);
    }

    async signIn(email: string, password: string): Promise<boolean> {
        try {
            const res = await this.client.auth.signin.$post({
                json: {
                    email,
                    password
                }
            });

            if (!res.ok) {
                return false;
            }

            const token = res.headers.get("X-Auth-Token")

            if (!token) {
                return false;
            }

            this.client = hc<AppType>(this.url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            return true;
        } catch (e) {
            return false;
        }
    }

    async signOut(): Promise<boolean> {
        try {
            const res = await this.client.auth.signout.$post();

            if (res.status !== 200) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }
}

export class Collection<T extends CollectionFields> {

    constructor(private client: ReturnType<typeof hc<AppType>>, private name: string, private collection: { fields: T, unique: boolean }) { }

    async get(id: string) {
        if (this.collection.unique) {
            id = "unique"
        }
        const res = await this.client.data[":slug"][":id"].$get({
            param: {
                slug: this.name,
                id: id
            }
        });
        if (!res.ok) {
            return {
                data: null,
                error: new Error(await res.text())
            };
        }
        const data = await res.json();
        return {
            data: {
                ...data.record,
                data: data.record.data as FieldValues<T>
            },
            error: null
        }
    }

    async list(cursor?: string, limit?: number) {
        const res = await this.client.data[":slug"].$get({
            param: {
                slug: this.name,
            },
            query: {
                cursor,
                limit: limit?.toString()
            }
        });
        if (!res.ok) {
            return {
                data: null,
                error: new Error(await res.text())
            };
        }
        const data = await res.json();
        return {
            data: data.records.map(r => ({
                ...r,
                data: r.data as FieldValues<T>
            })),
            error: null
        }
    }

    async create(data: FieldValues<T>) {

        // Check if collections fields contain an upload field
        const hasUpload = Object.values(this.collection.fields).filter((field) => field.type === "upload");

        // If there is an upload field, we need to upload the file first
        if (hasUpload.length > 0) {
            const formData = new FormData();

        }

        const res = await this.client.data[":slug"].$post({
            param: {
                slug: this.name,
            },
            json: {
                data
            }
        });
        if (!res.ok) {
            return {
                data: null,
                error: new Error(await res.text())
            };
        }
        return {
            data: {
                success: true
            },
            error: null
        }
    }

    async update(id: string, data: FieldValues<T>) {
        const res = await this.client.data[":slug"][":id"].$put({
            param: {
                slug: this.name,
                id: id,
            },
            json: {
                data
            }
        });
        if (!res.ok) {
            return {
                data: null,
                error: new Error(await res.text())
            };
        }
        return {
            data: {
                success: true
            },
            error: null
        }
    }

    async delete(id: string) {
        const res = await this.client.data[":slug"][":id"].$delete({
            param: {
                slug: this.name,
                id: id,
            },
        });
        if (!res.ok) {
            return {
                data: null,
                error: new Error(await res.text())
            };
        }
        return {
            data: {
                success: true
            },
            error: null
        }
    }
}
