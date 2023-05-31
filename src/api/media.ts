import { Hono } from "hono";
import { C } from ".";
import { nanoid } from "nanoid";
import { signedIn } from "./auth";
import { ApiError, ApiRecordResponse, ApiRecordsResponse, ApiSimpleResponse } from "../lib/types";

export type Media = {
    id: string;
    name: string;
    alt_text: string;
    content_type: string;
    size: number;
    path: string;
    user_id: string;
    created_at: string;
    updated_at: string;
};

const app = new Hono<C>();

app.use("*", signedIn);

app.get("/", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media");
    const result = await stmt.all<Media>();

    if (!result.success) {
        return c.json<ApiError>({
            error: result.error
        }, 500);
    }

    if (!result.results) {
        return c.json<ApiRecordsResponse<Media>>({
            records: []
        });
    }

    const records = result.results.map(r => ({
        id: r.id,
        data: {
            name: r.name,
            alt_text: r.alt_text,
            content_type: r.content_type,
            size: r.size,
            path: r.path,
            user_id: r.user_id,
        },
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));

    return c.json<ApiRecordsResponse<any>>({ records });
});

app.post("/", async c => {
    const body = await c.req.formData();

    const stmt = c.env.d1CMS.prepare(
        "INSERT INTO media (name, alt_text, content_type, size, path, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        const now = new Date().toISOString();

        // Upload file to r2CMS
        // @ts-ignore
        const file = body.get("file") as File;
        const filename = `${nanoid()}.${file.name.replace(/\s/g, "")}`;
        const r2File = await c.env.r2CMS.put(filename, await file.arrayBuffer())

        // Insert media into d1CMS
        const result = await stmt
            .bind(
                file.name,
                file.name,
                file.type,
                r2File.size,
                r2File.key,
                c.get("user").id,
                now,
                now
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

app.get("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media WHERE id = ?");
    const media = await stmt.bind(c.req.param("id")).first<Media>();

    if (!media) {
        return c.json<ApiError>({
            error: "Media not found"
        }, 404);
    }

    return c.json<ApiRecordResponse<any>>({
        id: media.id,
        data: {
            name: media.name,
            alt_text: media.alt_text,
            content_type: media.content_type,
            size: media.size,
            path: media.path,
            user_id: media.user_id,
        },
        createdAt: media.created_at,
        updatedAt: media.updated_at
    });
});

app.get("/:id/file", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media WHERE id = ?");
    const media = await stmt.bind(c.req.param("id")).first<Media>();

    if (!media) {
        return c.json<ApiError>({
            error: "Media not found"
        }, 404);
    }

    const r2File = await c.env.r2CMS.get(media.path);

    if (!r2File) {
        return c.json<ApiError>({
            error: "File not found"
        }, 404);
    }

    return c.newResponse(await r2File.arrayBuffer(), 200, {
        "Content-Disposition": `inline; filename="${media.name}"`,
        "Content-Type": media.content_type,
    })
});

app.put("/:id", async c => {
    const body = await c.req.json<Media>();

    const stmt = c.env.d1CMS.prepare("UPDATE media SET name = ?, alt_text = ?, updated_at = ? WHERE id = ?");
    try {
        const now = new Date().toISOString();
        const result = await stmt
            .bind(
                body.name,
                body.alt_text,
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

app.delete("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("DELETE FROM media WHERE id = ?");
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