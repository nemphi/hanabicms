import { Hono } from "hono";
import { type Env } from ".";
import { nanoid } from "nanoid";
import { signedIn } from "./auth";

export type Media = {
    id: number;
    name: string;
    alt_text: string;
    content_type: string;
    size: number;
    path: string;
    created_at: string;
    updated_at: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", signedIn);

app.get("/", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media");
    const result = await stmt.all<Media>();

    if (!result.success) {
        return c.text("Error: " + result.error, 500);
    }
    return c.json({ media: result.results });
});

app.post("/", async c => {
    const body = await c.req.formData();

    const stmt = c.env.d1CMS.prepare(
        "INSERT INTO media (name, alt_text, content_type, size, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        const now = new Date().toISOString();

        // Upload file to r2CMS
        // @ts-ignore
        const file = body.get("file") as File;
        const filename = `${nanoid()}.${file.name}`;
        const r2File = await c.env.r2CMS.put(filename, file)

        // Insert media into d1CMS
        const result = await stmt
            .bind(
                body.get("name") as string,
                body.get("alt_text") as string,
                file.type,
                r2File.size,
                body.get("path") as string,
                now,
                now
            )
            .run();

        if (!result.success) {
            return c.text("Error: " + result.error, 500);
        }

        return c.text("OK");
    } catch (error) {
        console.error(error);
        return c.text("Error: " + error, 500);
    }
});

app.get("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media WHERE id = ?");
    const media = await stmt.bind(c.req.param("id")).first<Media>();

    if (!media) {
        return c.text("Media not found", 404);
    }
    return c.json({ media });
});

app.get("/:id/file", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT * FROM media WHERE id = ?");
    const media = await stmt.bind(c.req.param("id")).first<Media>();

    if (!media) {
        return c.text("Media not found", 404);
    }

    const r2File = await c.env.r2CMS.get(media.path);

    if (!r2File) {
        return c.text("File not found", 404);
    }

    return c.newResponse(await r2File?.arrayBuffer(), 200, {
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
            return c.text("Error: " + result.error, 500);
        }

        return c.text("OK");
    } catch (error) {
        console.error(error);
        return c.text("Error: " + error, 500);
    }
});

app.delete("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("DELETE FROM media WHERE id = ?");
    try {
        const result = await stmt.bind(c.req.param("id")).run();

        if (!result.success) {
            return c.text("Error: " + result.error, 500);
        }

        return c.text("OK");
    } catch (error) {
        console.error(error);
        return c.text("Error: " + error, 500);
    }
});

export default app;