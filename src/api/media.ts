import { Hono } from "hono";
import { cache } from "hono/cache"
import { ulid } from "ulidx";
import type { C } from ".";
import { isSignedIn } from "./auth";
import type { ApiError, ApiRecordResponse, ApiSimpleResponse } from "../lib/types";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

export type Media = {
    id: string;
    userId: string;
    name: string;
    altText: string;
    contentType: string;
    size: number;
    path: string;
    createdAt: number;
    updatedAt: number;
};

export type UploadToken = {
    id: string;
    completed: boolean;
    createdAt: number;
    updatedAt: number;
}

const app = new Hono<C>();

app.get("/",
    isSignedIn,
    zValidator("query", z.object({
        cursor: z.string().optional(),
        limit: z.string().optional(),
    })),
    async c => {
        const query = c.req.valid("query");

        const results = await c.env.dbCMS.prepare("SELECT * FROM media WHERE id > ? LIMIT ?").
            bind(
                query.cursor ? query.cursor : "",
                query.limit ? +query.limit : 10
            ).
            all<Media>();

        if (!results.success) {
            console.log(results.error);
            return c.jsonT<ApiError>({
                error: "Database error"
            }, 500);
        }

        return c.jsonT({
            media: results.results,
            cursor: results.results.length > 0 ? results.results[results.results.length - 1]?.id : null
        })
    });

app.post("/",
    isSignedIn,
    async c => {
        const body = await c.req.formData();

        try {
            const now = Date.now();

            // Upload file to r2CMS
            // @ts-ignore
            const file = body.get("file") as File;
            const mediaId = ulid();
            const filename = `${mediaId}.${file.name.replace(/\s/g, "")}`;
            const r2File = await c.env.r2CMS.put(filename, await file.arrayBuffer())

            if (!r2File) {
                return c.json<ApiError>({
                    error: "Failed to upload file"
                }, 500);
            }

            const media: Media = {
                id: mediaId,
                name: file.name,
                altText: file.name,
                contentType: file.type,
                size: r2File.size,
                path: r2File.key,
                userId: c.get("user")!.id,
                createdAt: now,
                updatedAt: now,
            }

            await c.env.dbCMS.prepare("INSERT INTO media VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").
                bind(media.id, media.name, media.altText, media.contentType, media.size, media.path, media.userId, media.createdAt, media.updatedAt).
                run();

            return c.json<ApiSimpleResponse<any>>({ message: "OK" });
        } catch (error) {
            console.error(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.get("/:id",
    isSignedIn,
    zValidator("param", z.object({
        id: z.string(),
    })),
    async c => {
        const { id: mediaId } = c.req.valid("param");

        const media = await c.env.dbCMS.prepare("SELECT * FROM media WHERE id = ?").
            bind(mediaId).
            first<Media>();

        if (!media) {
            return c.json<ApiError>({
                error: "Media not found"
            }, 404);
        }

        return c.jsonT({
            media
        });
    });

app.get("/:id/file",
    cache({
        cacheName: 'media',
        cacheControl: 'max-age=3600',
    }),
    zValidator("param", z.object({
        id: z.string(),
    })),
    async c => {
        const { id: mediaId } = c.req.valid("param");

        const media = await c.env.dbCMS.prepare("SELECT * FROM media WHERE id = ?").
            bind(mediaId).
            first<Media>();

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

app.put("/:id",
    isSignedIn,
    zValidator("json", z.object({
        name: z.string(),
        altText: z.string(),
    })),
    async c => {
        const body = await c.req.valid("json");

        try {
            const now = Date.now();
            const media = await c.env.dbCMS.prepare("SELECT * FROM media WHERE id = ?").
                bind(c.req.param("id")).
                first<Media>();

            if (!media) {
                return c.json<ApiError>({
                    error: "Media not found"
                }, 404);
            }

            const newMedia: Media = {
                ...media,
                name: body.name,
                altText: body.altText,
                updatedAt: now,
            }


            await c.env.dbCMS.prepare("UPDATE media SET name = ?, altText = ?, updatedAt = ? WHERE id = ?").
                bind(newMedia.name, newMedia.altText, newMedia.updatedAt, newMedia.id).
                run();

            return c.jsonT({ message: "OK" });
        } catch (error) {
            console.error(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

app.delete("/:id",
    isSignedIn,
    zValidator("param", z.object({
        id: z.string(),
    })),
    async c => {
        try {

            const { id: mediaId } = c.req.valid("param");

            const media = await c.env.dbCMS.prepare("SELECT * FROM media WHERE id = ?").
                bind(mediaId).
                first<Media>();

            if (!media) {
                return c.json<ApiError>({
                    error: "Media not found"
                }, 404);
            }

            await c.env.r2CMS.delete(media.path);
            await c.env.dbCMS.prepare("DELETE FROM media WHERE id = ?").
                bind(mediaId).
                run();

            return c.jsonT({ message: "OK" });
        } catch (error) {
            console.error(error);
            return c.json<ApiError>({
                error: error as string
            }, 500);
        }
    });

export default app;