import { type Context, Hono, type Next } from "hono";
import { nanoid } from "nanoid";
import { compare } from "bcryptjs";
import { C } from ".";
import { type User } from "./users";

const app = new Hono<C>();

type Session = {
    id: number;
    user_id: number;
    token: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
}

export const signedIn = async (c: Context<C>, next: Next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        console.error("no token");
        return c.text("Unauthorized", 401);
    }
    const stmt = c.env.d1CMS.prepare("SELECT * FROM sessions WHERE token = ?");
    const session = await stmt.bind(token).first<Session>();

    if (!session) {
        return c.text("Unauthorized", 401);
    }
    const userStmt = c.env.d1CMS.prepare("SELECT * FROM users WHERE id = ?");
    const user = await userStmt.bind(session.user_id).first<User>();

    if (!user) {
        return c.text("Unauthorized", 401);
    }

    // c.set("session", session);
    c.set("user", user);

    await next();
}

export const isAdmin = async (c: Context<C>, next: Next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return c.text("Unauthorized", 401);
    }
    const stmt = c.env.d1CMS.prepare("SELECT * FROM sessions WHERE token = ?");
    const session = await stmt.bind(token).first<Session>();

    if (!session) {
        return c.text("Unauthorized", 401);
    }

    const userStmt = c.env.d1CMS.prepare("SELECT * FROM users WHERE id = ?");
    const user = await userStmt.bind(session.user_id).first<User>();

    if (!user) {
        return c.text("Unauthorized", 401);
    }

    if (!user.roles.includes("admin")) {
        return c.text("Unauthorized", 401);
    }

    // c.set("session", session);
    c.set("user", user);

    await next();
}

app.post("/signin", async c => {
    const body = await c.req.json<User>();

    const stmt = c.env.d1CMS.prepare("SELECT * FROM users WHERE email = ?");
    const user = await stmt.bind(body.email).first<User>();

    if (!user) {
        return c.text("User not found", 404);
    }

    const match = await compare(body.password, user.password);

    if (!match) {
        return c.text("Invalid password", 401);
    }

    const token = nanoid(32);

    const sessionStmt = c.env.d1CMS.prepare("INSERT INTO sessions (user_id, token, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    const now = new Date().toISOString();
    const expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days
    const sessionResult = await sessionStmt.bind(user.id, token, expiresAt, now, now).run();

    if (!sessionResult.success) {
        console.error(sessionResult.error);
        return c.text("Error: " + sessionResult.error, 500);
    }

    return c.json({ token });
});

app.post("/signout", async c => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return c.text("Unauthorized", 401);
    }

    const stmt = c.env.d1CMS.prepare("DELETE FROM sessions WHERE token = ?");
    const result = await stmt.bind(token).run();

    if (!result.success) {
        console.error(result.error);
        return c.text("Error: " + result.error, 500);
    }

    return c.text("OK");
});

export default app;