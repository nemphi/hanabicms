import { Hono, MiddlewareHandler } from "hono";
import { ulid } from "ulidx";
import { compare } from "bcryptjs";
import type { C } from ".";
import type { User } from "./users";
import * as z from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";

const app = new Hono<C, {}, "/auth">();

export type Session = {
    id: string;
    userId: string;
    token: string;
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
}

export const isSignedIn: MiddlewareHandler<C> = async (c, next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        console.error("no token");
        throw new HTTPException(401, { message: "Unauthorized" });
    }
    const session = await c.env.dbCMS.prepare("SELECT * FROM sessions WHERE token = ?").
        bind(token).
        first<Session>();

    if (!session) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    const user = await c.env.dbCMS.prepare("SELECT * FROM users WHERE id = ?").
        bind(session.userId).
        first<User>();

    if (!user) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    c.set("user", user);

    await next();
}

export const isAdmin: MiddlewareHandler<C> = async (c, next) => {
    const user = c.get("user");

    if (!user) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    if (!user.roles.includes("admin")) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    await next();
}

type signInType = typeof signIn;
const signIn = app.post("/signin",
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
            throw new HTTPException(404, { message: "User not found" });
        }

        const match = await compare(`${data.password}.${user.salt}`, user.password);

        if (!match) {
            throw new HTTPException(401, { message: "Invalid password" });
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

        return c.jsonT({ message: "OK" }, {
            headers: {
                "X-Auth-Token": token
            }
        });
    });


type signOutType = typeof signOut;
const signOut = app.post("/signout", async c => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }

    await c.env.dbCMS.prepare("DELETE FROM sessions WHERE token = ?").
        bind(token).
        run();

    return c.jsonT({ message: "Signed out" });
});

export type authType = signInType | signOutType;
export default app;