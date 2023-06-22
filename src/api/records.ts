import { type Context, Hono, type Next } from "hono";
import { nanoid } from "nanoid";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";

export type Record = {
    id: string;
    slug: string;
    fields: { [key: string]: any };
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
};

export type RecordMetadata = {
    title: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
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

    // c.set("session", session);
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
            limit: 50,
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
        const record = await c.env.kvCMS.get<Record>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");

        if (!record) {
            return c.json<ApiError>({
                error: "Record not found"
            }, 404);
        }
        return c.json<ApiRecordResponse<any>>({
            id: record.id,
            data: record.fields,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
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

        const now = new Date().toISOString();

        const record: Record = {
            id: nanoid(),
            slug: c.req.param("slug"),
            fields: body,
            createdAt: now,
            updatedAt: now,
            deletedAt: ""
        }

        await c.env.kvCMS.put(`records/${record.slug}/${record.id}`, JSON.stringify(record), {
            metadata: {
                title: record.id,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                deletedAt: ""
            }
        });

        if (collection?.hooks?.afterCreate) {
            await collection.hooks.afterCreate({
                ...record,
                data: record.fields
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

    let oldRecord: Record | null = null;
    const collection = c.get("collection");
    if (collection?.hooks?.beforeUpdate) {

        try {
            oldRecord = await c.env.kvCMS.get<Record>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");

            if (!oldRecord) {
                return c.json<ApiError>({
                    error: "Record not found"
                }, 404);
            }

            body = await collection.hooks.beforeUpdate({
                id: oldRecord.id,
                data: oldRecord.fields,
                createdAt: oldRecord.createdAt,
                updatedAt: oldRecord.updatedAt
            }, body);

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    try {
        const now = new Date().toISOString();
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${c.req.param("id")}`, JSON.stringify({
            ...oldRecord,
            fields: body,
            updatedAt: now
        }), {
            metadata: {
                title: oldRecord!.id,
                createdAt: oldRecord!.createdAt,
                updatedAt: now,
                deletedAt: ""
            }
        });

        if (collection?.hooks?.afterUpdate) {
            await collection.hooks.afterUpdate({
                id: oldRecord!.id,
                data: oldRecord!.fields,
                createdAt: oldRecord!.createdAt,
                updatedAt: oldRecord!.updatedAt
            }, {
                id: c.req.param("id"),
                data: body,
                createdAt: oldRecord!.createdAt,
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

    const oldRecord = await c.env.kvCMS.get<Record>(`records/${c.req.param("slug")}/${c.req.param("id")}`, "json");
    const collection = c.get("collection");
    if (collection?.hooks?.beforeDelete) {
        try {

            if (!oldRecord) {
                return c.json<ApiError>({
                    error: "Record not found"
                }, 404);
            }

            await collection.hooks.beforeDelete({
                id: oldRecord.id,
                data: oldRecord.fields,
                createdAt: oldRecord.createdAt,
                updatedAt: oldRecord.updatedAt
            });

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    const now = new Date().toISOString();

    try {
        await c.env.kvCMS.put(`records/${c.req.param("slug")}/${c.req.param("id")}`, JSON.stringify({
            ...oldRecord,
            deletedAt: now,
        }), {
            metadata: {
                title: oldRecord!.id,
                createdAt: oldRecord!.createdAt,
                updatedAt: oldRecord!.updatedAt,
                deletedAt: now
            }
        });

        if (collection?.hooks?.afterDelete) {
            await collection.hooks.afterDelete({
                id: oldRecord!.id,
                data: oldRecord!.fields,
                createdAt: oldRecord!.createdAt,
                updatedAt: oldRecord!.updatedAt
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