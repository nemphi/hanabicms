import { type Context, Hono, type Next } from "hono";
import { nanoid } from "nanoid";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";

type Rec = Record<string, any>;

export type RecordMetadata = {
    title: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    deletedAt?: number;
}

const app = new Hono<C>();

const checkRecordAccess = async (c: Context<C>, next: Next) => {
    const collections = c.get("collections");

    // If no collections are defined, allow access to everything
    if (!collections) {
        return await next();
    }

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
        console.error("no token");
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const session = await c.env.kvCMS.get<Session>(`sessions/${token}`, "json");

    if (!session) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const user = await c.env.kvCMS.get<User>(`users/${session.user_id}`, "json");

    if (!user) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    c.set("user", user);

    const userRoles = user.roles.split(",");

    // Allow if admin
    if (userRoles.includes("admin")) {
        return await next();
    }

    switch (c.req.method.toUpperCase()) {
        case "GET":
            for (const role of collection.access?.read ?? []) {
                if (userRoles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "POST":
            for (const role of collection.access?.create ?? []) {
                if (userRoles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "PUT":
            for (const role of collection.access?.update ?? []) {
                if (userRoles.includes(role)) {
                    return await next();
                }
            }
            break;
        case "DELETE":
            for (const role of collection.access?.delete ?? []) {
                if (userRoles.includes(role)) {
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
        const record = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");

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

        const now = new Date().getTime();

        const recordId = nanoid();
        const slug = c.req.param("slug");

        await c.env.kvCMS.put(`records/${slug}/${recordId}`, JSON.stringify(body), {
            metadata: {
                title: recordId,
                createdAt: now,
                updatedAt: now,
            } as RecordMetadata
        });

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

    const oldRecord = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");

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

    const collection = c.get("collection");

    if (oldRecord.metadata.version < collection?.version!) {
        if (collection?.hooks?.newVersion) {
            body = await collection.hooks.newVersion({
                id: c.req.param("id"),
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            }, oldRecord.metadata.version, collection.version!);
        }
    }

    if (collection?.hooks?.beforeUpdate) {
        try {

            body = await collection.hooks.beforeUpdate({
                id: c.req.param("id"),
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
        const now = new Date().getTime();
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${c.req.param("id")}`, JSON.stringify(body), {
            metadata: {
                title: c.req.param("id"),
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: now,
            } as RecordMetadata
        });

        if (collection?.hooks?.afterUpdate) {
            await collection.hooks.afterUpdate({
                id: c.req.param("id"),
                data: oldRecord.value,
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt
            }, {
                id: c.req.param("id"),
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

    const oldRecord = await c.env.kvCMS.getWithMetadata<Rec, RecordMetadata>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");
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

    const collection = c.get("collection");
    if (collection?.hooks?.beforeDelete) {
        try {
            await collection.hooks.beforeDelete({
                id: c.req.param("id"),
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

    const now = new Date().getTime();

    try {
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${c.req.param("id")}`, JSON.stringify(oldRecord.value), {
            expirationTtl: 1000 * 60 * 60 * 24 * 30, // 30 days
            metadata: {
                title: c.req.param("id"),
                createdAt: oldRecord.metadata.createdAt,
                updatedAt: oldRecord.metadata.updatedAt,
                deletedAt: now
            } as RecordMetadata
        });

        if (collection?.hooks?.afterDelete) {
            await collection.hooks.afterDelete({
                id: c.req.param("id"),
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