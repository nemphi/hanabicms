import { type Context, Hono, type Next } from "hono";
import { ulid } from "ulidx";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";

export type Rec = {
    id: string;
    collection: string;
    data: Record<string, any>;
    version: number;
    createdAt: number;
    updatedAt: number;
    deletedAt?: number;
}

const app = new Hono<C>();

const checkRecordAccess = async (c: Context<C>, next: Next) => {
    const collections = c.get("collections");

    const collectionSlug = c.req.param("slug");

    const collection = collections[collectionSlug];

    if (!collection) {
        return c.json<ApiError>({ error: "Not found" }, 404);
    }

    c.set("collection", collection);

    // Check if public access is allowed
    switch (c.req.method.toUpperCase()) {
        case "GET":
            if ((collection.access?.read ?? []).includes("public")) {
                return await next();
            }
            break;
        case "POST":
            if ((collection.access?.create ?? []).includes("public")) {
                return await next();
            }
            break;
        case "PUT":
            if ((collection.access?.update ?? []).includes("public")) {
                return await next();
            }
            break;
        case "DELETE":
            if ((collection.access?.delete ?? []).includes("public")) {
                return await next();
            }
            break;
    }

    // If no public access is allowed, check if user is signed in

    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const session = await c.env.kvCMS.get<Session>(`sessions/${token}`, "json");

    if (!session) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const user = await c.env.dbCMS.prepare("SELECT * FROM users WHERE id = ?").
        bind(session.userId).
        first<User>();

    if (!user) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    c.set("user", user);


    // Allow if admin
    if (user.roles.includes("admin")) {
        return await next();
    }

    switch (c.req.method.toUpperCase()) {
        case "GET":
            for (const role of collection.access?.read ?? []) {
                if (user.roles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "POST":
            for (const role of collection.access?.create ?? []) {
                if (user.roles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "PUT":
            for (const role of collection.access?.update ?? []) {
                if (user.roles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "DELETE":
            for (const role of collection.access?.delete ?? []) {
                if (user.roles.includes(role)) {
                    return await next();
                }
            }
            break;
    }

    return c.json<ApiError>({ error: "Unauthorized" }, 401);
}

app.use("*", checkRecordAccess);

app.get("/:slug", async c => {
    try {

        const result = await c.env.kvCMS.list<RecordMetadata>({
            prefix: `records/${c.req.param("slug")}/`,
            limit: Number(c.req.query("limit")) ?? 50,
            cursor: c.req.query("cursor")
        })


        if (result.list_complete) {
            return c.json<ApiSimpleResponse<{
                keys: typeof result.keys;
            }>>({
                data: {
                    keys: result.keys
                }
            });
        }

        return c.json<ApiSimpleResponse<{
            keys: typeof result.keys;
            cursor: string;
        }>>({
            data: {
                keys: result.keys,
                cursor: result.cursor
            }
        });
    } catch (error) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:slug/:id", async c => {
    try {
        const collection = c.get("collection")
        const recordId = collection?.unique ? "unique" : c.req.param("id");
        const record = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${recordId}`, "json");

        if (!record) {
            return c.json<ApiError>({
                error: "Record not found"
            }, 404);
        }

        if (!record.metadata) {
            return c.json<ApiError>({
                error: "Record metadata not found"
            }, 404);
        }

        if (!record.value) {
            return c.json<ApiError>({
                error: "Record value not found"
            }, 404);
        }

        if (record.metadata.deletedAt) {
            return c.json<ApiError>({
                error: "Record deleted"
            }, 404);
        }

        return c.json<ApiRecordResponse<any>>({
            id: c.req.param("id"),
            data: record.value,
            createdAt: record.metadata.createdAt,
            updatedAt: record.metadata.updatedAt
        });

    } catch (error) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.post("/:slug", async c => {
    let body = await c.req.json();

    const collection = c.get("collection");
    if (collection?.hooks?.beforeCreate) {
        body = await collection.hooks.beforeCreate(body);
    }

    try {

        const now = Date.now();

        const recordId = collection?.unique ? "unique" : ulid();
        const slug = c.req.param("slug");

        const metadata: RecordMetadata = {
            title: recordId,
            version: collection?.version ?? 0,
            createdAt: now,
            updatedAt: now,
        }

        await c.env.kvCMS.put(`records/${slug}/${recordId}`, JSON.stringify(body), { metadata });

        if (collection?.hooks?.afterCreate) {
            await collection.hooks.afterCreate({
                id: recordId,
                createdAt: now,
                updatedAt: now,
                data: body
            });
        }

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.put("/:slug/:id", async c => {
    let body = await c.req.json();

    const collection = c.get("collection");
    const recordId = collection?.unique ? "unique" : c.req.param("id");

    const oldRecord = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${recordId}`, "json");

    if (!oldRecord) {
        return c.json<ApiError>({
            error: "Record not found"
        }, 404);
    }

    if (!oldRecord.value) {
        return c.json<ApiError>({
            error: "Record value not found"
        }, 404);
    }

    if (!oldRecord.metadata) {
        return c.json<ApiError>({
            error: "Record metadata not found"
        }, 404);
    }

    if (oldRecord.metadata.version < collection?.version!) {
        if (collection?.hooks?.newVersion) {
            body = await collection.hooks.newVersion({
                id: recordId,
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            }, oldRecord.metadata.version, collection.version!);
        }
    }

    if (collection?.hooks?.beforeUpdate) {
        try {

            body = await collection.hooks.beforeUpdate({
                id: recordId,
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            }, body);

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    try {
        const now = Date.now();
        const metadata: RecordMetadata = {
            title: recordId,
            version: collection?.version ?? oldRecord.metadata.version,
            createdAt: oldRecord.metadata.createdAt,
            updatedAt: now,
        }
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${recordId}`, JSON.stringify(body), { metadata });

        if (collection?.hooks?.afterUpdate) {
            await collection.hooks.afterUpdate({
                id: recordId,
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            }, {
                id: recordId,
                data: body,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: now
            });
        }

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.delete("/:slug/:id", async c => {

    const collection = c.get("collection");
    const recordId = collection?.unique ? "unique" : c.req.param("id");

    const oldRecord = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${recordId}`, "json");
    if (!oldRecord) {
        return c.json<ApiError>({
            error: "Record not found"
        }, 404);
    }

    if (!oldRecord.value) {
        return c.json<ApiError>({
            error: "Record value not found"
        }, 404);
    }

    if (!oldRecord.metadata) {
        return c.json<ApiError>({
            error: "Record metadata not found"
        }, 404);
    }

    if (collection?.hooks?.beforeDelete) {
        try {
            await collection.hooks.beforeDelete({
                id: recordId,
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            });

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    const now = Date.now();

    const metadata: RecordMetadata = {
        title: recordId,
        version: collection?.version ?? oldRecord.metadata.version,
        createdAt: oldRecord.metadata.createdAt,
        updatedAt: oldRecord.metadata.updatedAt,
        deletedAt: now
    }

    try {
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${recordId}`, JSON.stringify(oldRecord.value), {
            expirationTtl: 1000 * 60 * 60 * 24 * 30, // 30 days
            metadata
        });

        if (collection?.hooks?.afterDelete) {
            await collection.hooks.afterDelete({
                id: recordId,
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            });
        }

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

export default app;