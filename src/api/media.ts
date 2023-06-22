import { Hono } from "hono";
import { cache } from "hono/cache"
import { nanoid } from "nanoid";
import type { C } from ".";
import { signedIn } from "./auth";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";

export type Media = {
    id: string;
    name: string;
    altText: string;
    contentType: string;
    size: number;
    path: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
};

type MediaMetadata = {
    name: string;
    contentType: string;
    size: number;
    path: string;
    createdAt: string;
}

export type UploadToken = {
    id: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

const app = new Hono<C>();

app.use("*", signedIn);

app.get("/", async c => {
    const results = await c.env.kvCMS.list<MediaMetadata>({
        prefix: "media/",
        limit: 100
    });

    if (results.list_complete) {
        return c.json<ApiSimpleResponse<{
            keys: typeof results.keys;
            list_complete: true;
        }>>({
            data: {
                keys: results.keys,
                list_complete: true
            }
        })
    }

    return c.json<ApiSimpleResponse<{
        keys: typeof results.keys;
        list_complete: false;
        cursor: string;
    }>>({
        data: {
            keys: results.keys,
            list_complete: false,
            cursor: results.cursor
        }
    })
});

app.post("/", async c => {
    const body = await c.req.formData();

    try {
        const now = new Date().toISOString();

        // Upload file to r2CMS
        // @ts-ignore
        const file = body.get("file") as File;
        const mediaId = nanoid();
        const filename = `${mediaId}.${file.name.replace(/\s/g, "")}`;
        const r2File = await c.env.r2CMS.put(filename, await file.arrayBuffer())

        await c.env.kvCMS.put(`media/${filename}`, JSON.stringify({
            id: mediaId,
            name: file.name,
            altText: file.name,
            contentType: file.type,
            size: r2File.size,
            path: r2File.key,
            userId: c.get("user").id,
            createdAt: now,
            updatedAt: now
        }), {
            metadata: {
                name: file.name,
                contentType: file.type,
                size: r2File.size,
                path: r2File.key,
                createdAt: now
            }
        })

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:id", async c => {
    const media = await c.env.kvCMS.get<Media>(`media/${c.req.param("id")}`);

    if (!media) {
        return c.json<ApiError>({
            error: "Media not found"
        }, 404);
    }

    return c.json<ApiRecordResponse<any>>({
        id: media.id,
        data: {
            name: media.name,
            altText: media.altText,
            contentType: media.contentType,
            size: media.size,
            path: media.path,
            userId: media.userId,
        },
        createdAt: media.createdAt,
        updatedAt: media.updatedAt
    });
});

app.get("/:id/file", cache({
    cacheName: 'media',
    cacheControl: 'max-age=3600',
}), async c => {
    const media = await c.env.kvCMS.get<Media>(`media/${c.req.param("id")}`);

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
        "Content-Type": media.contentType,
    })
});

app.put("/:id", async c => {
    const body = await c.req.json<Media>();

    try {
        const now = new Date().toISOString();
        const media = await c.env.kvCMS.get<Media>(`media/${c.req.param("id")}`);

        if (!media) {
            return c.json<ApiError>({
                error: "Media not found"
            }, 404);
        }

        await c.env.kvCMS.put(`media/${c.req.param("id")}`, JSON.stringify({
            ...media,
            name: body.name,
            altText: body.altText,
            updatedAt: now
        }), {
            metadata: {
                name: body.name,
                contentType: media.contentType,
                size: media.size,
                path: media.path,
                createdAt: media.createdAt
            }
        })

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.delete("/:id", async c => {
    try {
        await c.env.kvCMS.delete(`media/${c.req.param("id")}`);

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

export default app;