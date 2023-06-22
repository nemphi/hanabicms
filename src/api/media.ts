import { Hono } from "hono";
import { cache } from "hono/cache"
import { nanoid } from "nanoid";
import type { C } from ".";
import { signedIn } from "./auth";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";

export type Media = {
    name: string;
    altText: string;
    contentType: string;
    size: number;
    path: string;
    userId: string;
};

type MediaMetadata = {
    name: string;
    contentType: string;
    size: number;
    path: string;
    createdAt: number;
    updatedAt: number;
}

export type UploadToken = {
    id: string;
    completed: boolean;
    createdAt: number;
    updatedAt: number;
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
        const now = new Date().getTime();

        // Upload file to r2CMS
        // @ts-ignore
        const file = body.get("file") as File;
        const mediaId = nanoid();
        const filename = `${mediaId}.${file.name.replace(/\s/g, "")}`;
        const r2File = await c.env.r2CMS.put(filename, await file.arrayBuffer())

        const media: Media = {
            name: file.name,
            altText: file.name,
            contentType: file.type,
            size: r2File.size,
            path: r2File.key,
            userId: c.get("user").id
        }

        const metadata: MediaMetadata = {
            name: file.name,
            contentType: file.type,
            size: r2File.size,
            path: r2File.key,
            createdAt: now,
            updatedAt: now
        }

        await c.env.kvCMS.put(`media/${filename}`, JSON.stringify(media), { metadata })

        return c.json<ApiSimpleResponse<any>>({ message: "OK" });
    } catch (error) {
        console.error(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:id", async c => {
    const media = await c.env.kvCMS.getWithMetadata<Media, MediaMetadata>(`media/${c.req.param("id")}`, "json");

    if (!media) {
        return c.json<ApiError>({
            error: "Media not found"
        }, 404);
    }

    if (!media.metadata) {
        return c.json<ApiError>({
            error: "Media metadata not found"
        }, 404);
    }

    if (!media.value) {
        return c.json<ApiError>({
            error: "Media value not found"
        }, 404);
    }

    return c.json<ApiRecordResponse<Media>>({
        id: c.req.param("id"),
        data: media.value,
        createdAt: media.metadata.createdAt,
        updatedAt: media.metadata.updatedAt
    });
});

app.get("/:id/file", cache({
    cacheName: 'media',
    cacheControl: 'max-age=3600',
}), async c => {
    const media = await c.env.kvCMS.get<Media>(`media/${c.req.param("id")}`, "json");

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
        const now = new Date().getTime();
        const media = await c.env.kvCMS.getWithMetadata<Media, MediaMetadata>(`media/${c.req.param("id")}`, "json");

        if (!media) {
            return c.json<ApiError>({
                error: "Media not found"
            }, 404);
        }

        if (!media.metadata) {
            return c.json<ApiError>({
                error: "Media metadata not found"
            }, 404);
        }

        if (!media.value) {
            return c.json<ApiError>({
                error: "Media value not found"
            }, 404);
        }

        const newMedia: Media = {
            ...media.value,
            name: body.name,
            altText: body.altText,
        }

        const metadata: MediaMetadata = {
            name: body.name,
            contentType: media.metadata.contentType,
            size: media.metadata.size,
            path: media.value.path,
            createdAt: media.metadata.createdAt,
            updatedAt: now
        }

        await c.env.kvCMS.put(`media/${c.req.param("id")}`, JSON.stringify(newMedia), { metadata })

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

        const media = await c.env.kvCMS.getWithMetadata<Media, MediaMetadata>(`media/${c.req.param("id")}`, "json");

        if (!media) {
            return c.json<ApiError>({
                error: "Media not found"
            }, 404);
        }

        if (!media.metadata) {
            return c.json<ApiError>({
                error: "Media metadata not found"
            }, 404);
        }

        if (!media.value) {
            return c.json<ApiError>({
                error: "Media value not found"
            }, 404);
        }

        await c.env.r2CMS.delete(media.value.path);
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