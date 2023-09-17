import { type Context, Hono, type Next } from "hono";
import { ulid } from "ulidx";
import { compare } from "bcryptjs";
import type { C } from ".";
import type { User } from "./users";
import type { ApiError, ApiSimpleResponse } from "../lib/types";
import * as z from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono<C>();

export type Session = {
    id: string;
    userId: string;
    token: string;
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
}

export const isSignedIn = async (c: Context<C>, next: Next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        console.error("no token");
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

    await next();
}

export const isAdmin = async (c: Context<C>, next: Next) => {
    const user = c.get("user");

    if (!user) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    if (!user.roles.includes("admin")) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    await next();
}

app.post("/signin",
    zValidator("json", z.object({
        email: z.string().email(),
        password: z.string(),
    })),
    async c => {
        const data = c.req.valid("json");

        const user = await c.env.dbCMS.prepare("SELECT * FROM users WHERE email = ?").
            bind(data.email).
            first<User>();

        if (!user) {
            return c.json<ApiError>({ error: "User not found" }, 404);
        }

        const match = await compare(`${data.password}.${user.salt}`, user.password);

        if (!match) {
            return c.json<ApiError>({ error: "Invalid password" }, 401);
        }

        const token = ulid();

        const now = Date.now();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).getTime(); // 7 days

        const session: Session = {
            id: token,
            userId: user.id,
            token,
            expiresAt,
            createdAt: now,
            updatedAt: now,
        }


        await c.env.dbCMS.prepare("INSERT INTO sessions (id, userId, token, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").
            bind(session.id, session.userId, session.token, session.expiresAt, session.createdAt, session.updatedAt).
            run();

        return c.json<ApiSimpleResponse<any>>({ message: "OK" }, {
            headers: {
                "X-Auth-Token": token
            }
        });
    });

app.post("/signout", async c => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    await c.env.dbCMS.prepare("DELETE FROM sessions WHERE token = ?").
        bind(token).
        run();

    return c.json<ApiSimpleResponse<any>>({ message: "Signed out" });
});

export default app;