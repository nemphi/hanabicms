import { Context, Hono, Next } from "hono";
import { nanoid } from "nanoid";
import type { C } from ".";
import type { Session } from "./auth";
import type { User } from "./users";
import type { ApiError, ApiRecordResponse, ApiRecordsResponse, ApiSimpleResponse } from "../lib/types";

export type Record = {
    id: string;
    slug: string;
    fields: { [key: string]: any };
    created_at: string;
    updated_at: string;
    deleted_at: string;
};

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
    const stmt = c.env.d1CMS.prepare("SELECT * FROM sessions WHERE token = ?");
    const session = await stmt.bind(token).first<Session>();

    if (!session) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }
    const userStmt = c.env.d1CMS.prepare("SELECT * FROM users WHERE id = ?");
    const user = await userStmt.bind(session.user_id).first<User>();

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
    const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE slug = ?");
    try {
        const result = await stmt.bind(
            c.req.param("slug")
        ).all<Record>();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
        }

        if (!result.results) {
            return c.json<ApiRecordsResponse<Record>>({
                records: []
            });
        }

        const records = result.results.map(r => ({
            id: r.id,
            data: r.fields,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));

        return c.json<ApiRecordsResponse<any>>({ records });
    } catch (error) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:slug/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE id = ?");
    try {
        const record = await stmt.bind(c.req.param("id")).first<Record>();

        if (!record) {
            return c.json<ApiError>({
                error: "Record not found"
            }, 404);
        }
        return c.json<ApiRecordResponse<any>>({
            id: record.id,
            data: record.fields,
            createdAt: record.created_at,
            updatedAt: record.updated_at
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

    const stmt = c.env.d1CMS.prepare("INSERT INTO records (id, slug, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    try {

        const now = new Date().toISOString();

        const record = {
            id: nanoid(),
            slug: c.req.param("slug"),
            data: body,
            createdAt: now,
            updatedAt: now
        }

        const result = await stmt.bind(record.id, record.slug, record.data, record.createdAt, record.updatedAt).run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
        }

        if (collection?.hooks?.afterCreate) {
            await collection.hooks.afterCreate(record);
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

    let oldRecord: Record | undefined = undefined;
    const collection = c.get("collection");
    if (collection?.hooks?.beforeUpdate) {

        const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE id = ?");
        try {
            oldRecord = await stmt.bind(c.req.param("id")).first<Record>();

            body = await collection.hooks.beforeUpdate({
                id: oldRecord.id,
                data: oldRecord.fields,
                createdAt: oldRecord.created_at,
                updatedAt: oldRecord.updated_at
            }, body);

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    const stmt = c.env.d1CMS.prepare("UPDATE records SET fields = ?, updated_at = ? WHERE id = ?");
    try {
        const now = new Date().toISOString();
        const result = await stmt
            .bind(
                body,
                now,
                c.req.param("id")
            )
            .run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
        }

        if (collection?.hooks?.afterUpdate) {
            await collection.hooks.afterUpdate({
                id: oldRecord!.id,
                data: oldRecord!.fields,
                createdAt: oldRecord!.created_at,
                updatedAt: oldRecord!.updated_at
            }, {
                id: c.req.param("id"),
                data: body,
                createdAt: oldRecord!.created_at,
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

    let oldRecord: Record | undefined = undefined;
    const collection = c.get("collection");
    if (collection?.hooks?.beforeDelete) {

        const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE id = ?");
        try {
            oldRecord = await stmt.bind(c.req.param("id")).first<Record>();

            await collection.hooks.beforeDelete({
                id: oldRecord.id,
                data: oldRecord.fields,
                createdAt: oldRecord.created_at,
                updatedAt: oldRecord.updated_at
            });

        } catch (error) {
            console.log(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }

    }

    const now = new Date().toISOString();
    const stmt = c.env.d1CMS.prepare("UPDATE records SET deleted_at = ? WHERE id = ?");
    try {
        const result = await stmt.bind(now, c.req.param("id")).run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
        }

        if (collection?.hooks?.afterDelete) {
            await collection.hooks.afterDelete({
                id: oldRecord!.id,
                data: oldRecord!.fields,
                createdAt: oldRecord!.created_at,
                updatedAt: oldRecord!.updated_at
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