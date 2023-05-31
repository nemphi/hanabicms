import { Hono } from "hono";
import { C } from ".";
import { nanoid } from "nanoid";
import type { ApiError, ApiRecordResponse, ApiRecordsResponse, ApiSimpleResponse } from "../lib/types";

export type Record = {
    id: string;
    slug: string;
    fields: { [key: string]: any };
    created_at: string;
    updated_at: string;
};

const app = new Hono<C>();

// app.use("*", signedIn);

app.get("/:slug", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE slug = ?");
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
});

app.post("/:slug", async c => {
    const body = await c.req.json();

    const stmt = c.env.d1CMS.prepare("INSERT INTO records (id, slug, fields) VALUES (?, ?, ?)");
    try {
        const result = await stmt.bind(nanoid(), c.req.param("slug"), body).run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
        }

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:slug/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM records WHERE id = ?");
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
});

app.put("/:slug/:id", async c => {
    const body = await c.req.json();

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

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.delete("/:slug/:id", async c => {
    const stmt = c.env.d1CMS.prepare("DELETE FROM records WHERE id = ?");
    try {
        const result = await stmt.bind(c.req.param("id")).run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error
            }, 500);
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