import { type Context, Hono, type Next } from "hono";
import { nanoid } from "nanoid";
import { compare } from "bcryptjs";
import type { C } from ".";
import type { User, UserMetadata } from "./users";
import type { ApiError, ApiSimpleResponse } from "../lib/types";

const app = new Hono<C>();

export type Session = {
    id: string;
    user_id: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
}

export const signedIn = async (c: Context<C>, next: Next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        console.error("no token");
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }
    const session = await c.env.kvCMS.get<Session>(`sessions/${token}`, "json");

    if (!session) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const user = await c.env.kvCMS.get<User>(`users/${session.user_id}`, "json");

    if (!user) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    // c.set("session", session);
    c.set("user", user);

    await next();
}

export const isAdmin = async (c: Context<C>, next: Next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }
    const session = await c.env.kvCMS.get<Session>(`sessions/${token}`, "json");

    if (!session) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    const user = await c.env.kvCMS.get<User>(`users/${session.user_id}`, "json");

    if (!user) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    if (!user.roles.split(",").includes("admin")) {
        return c.json<ApiError>({ error: "Unauthorized" }, 401);
    }

    // c.set("session", session);
    c.set("user", user);

    await next();
}

app.post("/signin", async c => {
    const body = await c.req.json<{
        email: string;
        password: string;
    }>();

    let userKeys = await c.env.kvCMS.list<UserMetadata>({ prefix: "users/" });

    let userId = userKeys.keys.find(key => key.metadata?.email === body.email)?.name.slice(6);

    if (!userId && userKeys.list_complete) {
        return c.json<ApiError>({ error: "User not found" }, 404);
    }

    if (!userKeys.list_complete) {
        let cursor = userKeys.cursor;

        while (cursor) {
            userKeys = await c.env.kvCMS.list<UserMetadata>({ prefix: "users/", cursor });
            userId = userKeys.keys.find(key => key.metadata?.email === body.email)?.name.slice(6);
            if (userId) {
                break;
            }
            if (userKeys.list_complete) {
                break;
            }
            cursor = userKeys.cursor;
        }
    }

    if (!userId) {
        return c.json<ApiError>({ error: "User not found" }, 404);
    }

    const user = await c.env.kvCMS.get<User>(`users/${userId}`, "json");

    if (!user) {
        return c.json<ApiError>({ error: "User not found" }, 404);
    }

    const match = await compare(`${body.password}.${user.salt}`, user.password);

    if (!match) {
        return c.json<ApiError>({ error: "Invalid password" }, 401);
    }

    const token = nanoid(32);

    const now = new Date().toISOString();
    const expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days

    const session: Session = {
        id: nanoid(),
        user_id: user.id,
        token,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now
    }

    await c.env.kvCMS.put(`sessions/${token}`, JSON.stringify(session), {
        expirationTtl: 1000 * 60 * 60 * 24 * 7 // 7 days
    });

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

    await c.env.kvCMS.delete(`sessions/${token}`);

    return c.json<ApiSimpleResponse<any>>({ message: "Signed out" });
});

export default app;