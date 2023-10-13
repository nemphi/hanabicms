import { Hono, MiddlewareHandler } from "hono";
import { ulid } from "ulidx";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { HTTPException } from "hono/http-exception";

export type Rec<T = Record<string, any>> = {
    id: string;
    collection: string;
    data: T;
    version: number;
    createdAt: number;
    updatedAt: number;
    deletedAt?: number;
}

const app = new Hono<C, {}, "/data">();

const checkRecordAccess: MiddlewareHandler<C> = async (c, next) => {
    const collections = c.get("collections");

    // @ts-expect-error
    const collectionSlug = c.req.param("slug") as string;

    const collection = collections[collectionSlug];

    if (!collection) {
        throw new HTTPException(404, { message: "Not found" });
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
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    const session = await c.env.dbCMS.prepare("SELECT * FROM sessions WHERE token = ?").
        bind(token).
        first<Session>();

    if (!session) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    const user = await c.env.dbCMS.prepare("SELECT * FROM users WHERE id = ?").
        bind(session.userId).
        first<User>();

    if (!user) {
        throw new HTTPException(401, { message: "Unauthorized" });
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

    throw new HTTPException(401, { message: "Unauthorized" });
}

type listRecordType = typeof listRecord;
const listRecord = app.get("/:slug",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
    })),
    zValidator("query", z.object({
        cursor: z.string().optional(),
        limit: z.string().optional(),
    })),
    async c => {
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
            throw new HTTPException(500, { message: "Database error" })
        }


        return c.jsonT({
            records: result.results,
        });
    });

type getRecordType = typeof getRecord;
const getRecord = app.get("/:slug/:id",
    checkRecordAccess,
    zValidator("param", z.object({
        slug: z.string(),
        id: z.string(),
    })),
    async c => {
        const { slug, id } = c.req.valid("param");

        const collection = c.get("collection")
        const recordId = collection?.unique ? "unique" : id;
        const record = await c.env.dbCMS.prepare("SELECT * FROM records WHERE collection = ? AND id = ?").
            bind(slug, recordId).
            first<Rec>();

        if (!record) {
            throw new HTTPException(404, { message: "Record not found" });
        }

        if (record.deletedAt) {
            throw new HTTPException(404, { message: "Record deleted" });
        }

        return c.jsonT({
            record,
        });
    });

type createRecordType = typeof createRecord;
const createRecord = app.post("/:slug",
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
            await collection.hooks.afterCreate(rec);
        }

        return c.jsonT({ message: "OK" });
    });

type updateRecordType = typeof updateRecord;
const updateRecord = app.put("/:slug/:id",
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
            throw new HTTPException(404, { message: "Record not found" });
        }

        if (oldRecord.version < collection?.version!) {
            if (collection?.hooks?.newVersion) {
                body.data = await collection.hooks.newVersion(oldRecord, oldRecord.version, collection.version!);
            }
        }

        if (collection?.hooks?.beforeUpdate) {
            body.data = await collection.hooks.beforeUpdate(oldRecord, body);
        }

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
            await collection.hooks.afterUpdate(oldRecord, rec);
        }

        return c.jsonT({ message: "OK" });
    });

type deleteRecordType = typeof deleteRecord;
const deleteRecord = app.delete("/:slug/:id",
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
            throw new HTTPException(404, { message: "Record not found" });
        }

        if (collection?.hooks?.beforeDelete) {
            await collection.hooks.beforeDelete(oldRecord);
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

        await c.env.dbCMS.prepare("UPDATE records SET deletedAt = ? WHERE collection = ? AND id = ?").
            bind(rec.deletedAt, rec.collection, rec.id).
            run();

        if (collection?.hooks?.afterDelete) {
            await collection.hooks.afterDelete(oldRecord);
        }

        return c.jsonT({ message: "OK" });
    });

export type recordType = listRecordType | getRecordType | createRecordType | updateRecordType | deleteRecordType;
export default app;