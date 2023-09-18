import { type Context, Hono, type Next } from "hono";
import { ulid } from "ulidx";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

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

    const session = await c.env.dbCMS.prepare("SELECT * FROM sessions WHERE token = ?").
        bind(token).
        first<Session>();

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


app.get("/:slug",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
    })),
    zValidator("query", z.object({
        cursor: z.string().optional(),
        limit: z.string().optional(),
    })),
    async c => {
        try {

            const { slug } = c.req.valid("param");
            const query = c.req.valid("query");

            const result = await c.env.dbCMS.prepare("SELECT * FROM records WHERE collection = ? AND id > ? ORDER BY id ASC LIMIT ?").
                bind(
                    slug,
                    query.cursor ? query.cursor : "",
                    query.limit ? +query.limit : 10
                ).
                all<Rec>();

            if (!result.success) {
                return c.json<ApiError>({
                    error: "Database error"
                }, 500);
            }


            return c.jsonT({
                records: result.results,
            });
        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.get("/:slug/:id",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
        id: z.string(),
    })),
    async c => {
        try {
            const { slug, id } = c.req.valid("param");

            const collection = c.get("collection")
            const recordId = collection?.unique ? "unique" : id;
            const record = await c.env.dbCMS.prepare("SELECT * FROM records WHERE collection = ? AND id = ?").
                bind(slug, recordId).
                first<Rec>();

            if (!record) {
                return c.json<ApiError>({
                    error: "Record not found"
                }, 404);
            }

            if (record.deletedAt) {
                return c.json<ApiError>({
                    error: "Record deleted"
                }, 404);
            }

            return c.jsonT({
                record,
            });

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.post("/:slug",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
    })),
    zValidator("json", z.object({
        data: z.record(z.any()),
    })),
    async c => {
        const { slug } = c.req.valid("param");
        let body = await c.req.valid("json");

        const collection = c.get("collection");
        if (collection?.hooks?.beforeCreate) {
            body.data = await collection.hooks.beforeCreate(body.data);
        }

        try {

            const now = Date.now();

            const recordId = collection?.unique ? "unique" : ulid();

            const rec: Rec = {
                id: recordId,
                collection: slug,
                data: body.data,
                version: collection?.version ?? 0,
                createdAt: now,
                updatedAt: now,
            }

            await c.env.dbCMS.prepare("INSERT INTO records (id, collection, data, version, createdAt, updatedAt) VALUES (?, ?, json(?), ?, ?, ?)").
                bind(rec.id, rec.collection, rec.data, rec.version, rec.createdAt, rec.updatedAt).
                run();

            if (collection?.hooks?.afterCreate) {
                await collection.hooks.afterCreate({
                    id: recordId,
                    createdAt: now,
                    updatedAt: now,
                    data: body
                });
            }

            return c.jsonT({ message: "OK" });
        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.put("/:slug/:id",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
        id: z.string(),
    })),
    zValidator("json", z.object({
        data: z.record(z.any()),
    })),
    async c => {
        const { slug, id } = c.req.valid("param");
        let body = await c.req.valid("json");

        const collection = c.get("collection");
        const recordId = collection?.unique ? "unique" : id;

        const oldRecord = await c.env.dbCMS.prepare("SELECT * FROM records WHERE collection = ? AND id = ?").
            bind(slug, recordId).
            first<Rec>();

        if (!oldRecord) {
            return c.json<ApiError>({
                error: "Record not found"
            }, 404);
        }

        if (oldRecord.version < collection?.version!) {
            if (collection?.hooks?.newVersion) {
                body.data = await collection.hooks.newVersion({
                    id: recordId,
                    data: oldRecord.data,
                    createdAt: oldRecord.createdAt,
                    updatedAt: oldRecord.updatedAt
                }, oldRecord.version, collection.version!);
            }
        }

        if (collection?.hooks?.beforeUpdate) {
            try {

                body.data = await collection.hooks.beforeUpdate({
                    id: recordId,
                    data: oldRecord.data,
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
            const now = Date.now();
            const rec: Rec = {
                id: recordId,
                collection: slug,
                data: body.data,
                version: collection?.version ?? oldRecord.version,
                createdAt: oldRecord.createdAt,
                updatedAt: now,
            }
            await c.env.dbCMS.prepare("UPDATE records SET data = json(?), version = ?, updatedAt = ? WHERE collection = ? AND id = ?").
                bind(rec.data, rec.version, rec.updatedAt, rec.collection, rec.id).
                run();

            if (collection?.hooks?.afterUpdate) {
                await collection.hooks.afterUpdate({
                    id: recordId,
                    data: oldRecord.data,
                    createdAt: oldRecord.createdAt,
                    updatedAt: oldRecord.updatedAt
                }, {
                    id: recordId,
                    data: body,
                    createdAt: oldRecord.createdAt,
                    updatedAt: now
                });
            }

            return c.jsonT({ message: "OK" });
        } catch (error) {
            console.error(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.delete("/:slug/:id",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
        id: z.string(),
    })),
    async c => {

        const { slug, id } = c.req.valid("param");

        const collection = c.get("collection");
        const recordId = collection?.unique ? "unique" : id;

        const oldRecord = await c.env.dbCMS.prepare("SELECT * FROM records WHERE collection = ? AND id = ?").
            bind(slug, recordId).
            first<Rec>();
        if (!oldRecord) {
            return c.json<ApiError>({
                error: "Record not found"
            }, 404);
        }

        if (collection?.hooks?.beforeDelete) {
            try {
                await collection.hooks.beforeDelete({
                    id: recordId,
                    data: oldRecord.data,
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

        const now = Date.now();

        const rec: Rec = {
            id: recordId,
            collection: slug,
            data: oldRecord.data,
            version: collection?.version ?? oldRecord.version,
            createdAt: oldRecord.createdAt,
            updatedAt: oldRecord.updatedAt,
            deletedAt: now
        }

        try {
            await c.env.dbCMS.prepare("UPDATE records SET deletedAt = ? WHERE collection = ? AND id = ?").
                bind(rec.deletedAt, rec.collection, rec.id).
                run();

            if (collection?.hooks?.afterDelete) {
                await collection.hooks.afterDelete({
                    id: recordId,
                    data: oldRecord.data,
                    createdAt: oldRecord.createdAt,
                    updatedAt: oldRecord.updatedAt
                });
            }

            return c.jsonT({ message: "OK" });
        } catch (error) {
            console.error(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

export default app;