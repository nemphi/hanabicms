import { Hono } from "hono";
import { C } from ".";
import { hash } from "bcryptjs";
import { signedIn } from "./auth";
import type { ApiError, ApiResponse } from "../lib/types";
import { nanoid } from "nanoid";

export type User = {
    id: string;
    name: string;
    email: string;
    salt: string;
    password: string;
    roles: string;
    created_at: string;
    updated_at: string;
}


const app = new Hono<C>();

app.use("*", signedIn);

app.get("/", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT id, name, email, roles, created_at, updated_at FROM users");

    const result = await stmt.all<User>();

    if (!result.success) {
        return c.json<ApiError>({
            error: result.error
        }, 500);
    }

    if (!result.results) {
        return c.json<ApiError>({
            error: "No users found"
        }, 404);
    }

    const records = result.results.map(r => ({
        id: r.id,
        data: r,
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));

    return c.json<ApiResponse<User>>({ records })
});

app.post("/", async c => {
    const body = await c.req.json<User>();

    const stmt = c.env.d1CMS.prepare("INSERT INTO users (id, name, email, salt, password, roles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    try {
        const now = new Date().toISOString();
        const saltBase = new TextEncoder().encode(nanoid());
        const salt = await crypto.subtle.digest(
            {
                name: 'SHA-512',
            },
            saltBase // The data you want to hash as an ArrayBuffer
        );
        const saltStr = new Uint8Array(salt).toString();
        const hashedPassword = await hash(`${body.password}.${saltStr}`, 10);
        const result = await stmt.bind(nanoid(), body.name, body.email, saltStr, hashedPassword, body.roles, now, now).run();

        if (!result.success) {
            return c.json<ApiError>({
                error: result.error as string
            }, 500);
        }

        return c.json<ApiResponse>({ message: "OK" }, 201);
    } catch (error: unknown) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT id, name, email, roles, created_at, updated_at FROM users WHERE id = ?");
    const user = await stmt.bind(c.req.param("id")).first<User>();

    if (!user) {
        return c.json<ApiError>({
            error: "User not found"
        }, 404);
    }
    return c.json<ApiResponse<User>>({
        id: user.id,
        data: user,
        createdAt: user.created_at,
        updatedAt: user.updated_at
    });
});

app.put("/:id", async c => {
    const body = await c.req.json<User>();

    const stmt = c.env.d1CMS.prepare("UPDATE users SET name = ?, email = ?, password = ?, roles = ? WHERE id = ?");
    const result = await stmt.bind(body.name, body.email, body.password, body.roles, c.req.param("id")).run();

    if (!result.success) {
        return c.json<ApiError>({
            error: result.error
        }, 500);
    }
    return c.json<ApiResponse>({ message: "OK" });
});

app.delete("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("DELETE FROM users WHERE id = ?");
    const result = await stmt.bind(c.req.param("id")).run();

    if (!result.success) {
        return c.json<ApiError>({
            error: result.error
        }, 500);
    }

    return c.json<ApiResponse>({ message: "OK" });
});


export default app;