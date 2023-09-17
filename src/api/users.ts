import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { ulid } from "ulidx";
import { hash } from "bcryptjs";
import type { C } from ".";
import { isAdmin, isSignedIn } from "./auth";
import type { ApiError } from "../lib/types";

export type User = {
    id: string;
    name: string;
    email: string;
    salt: string;
    password: string;
    roles: string[];
    config: Record<string, any>;
    createdAt: number;
    updatedAt: number;
}

const app = new Hono<C>();

type listType = typeof listRoute;
const listRoute = app.get("/",
    isSignedIn,
    isAdmin,
    zValidator("query", z.object({
        cursor: z.string().optional(),
        limit: z.string().optional(),
    })),
    async c => {
        const query = c.req.valid("query");

        try {
            const res = await c.env.dbCMS.prepare("SELECT * FROM users WHERE id > ? LIMIT ?").
                bind(
                    query.cursor ? query.cursor : "",
                    query.limit ? +query.limit : 10
                ).
                all<User>();

            if (!res.success) {
                console.log(res.error);
                return c.jsonT<ApiError>({
                    error: "Database error"
                }, 500);
            }

            return c.jsonT({
                users: res.results
            });
        } catch (e) {
            console.log(e);
            return c.jsonT<ApiError>({
                error: String(e)
            }, 500);
        }
    });

type createType = typeof createRoute;
const createRoute = app.post("/",
    isSignedIn,
    isAdmin,
    zValidator("json", z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string(),
        roles: z.array(z.string()),
    })),
    async c => {
        const data = c.req.valid("json");

        try {
            const now = Date.now();
            const saltBase = new TextEncoder().encode(ulid());
            const salt = await crypto.subtle.digest(
                {
                    name: 'SHA-512',
                },
                saltBase // The data you want to hash as an ArrayBuffer
            );
            const saltStr = new Uint8Array(salt).toString();
            const hashedPassword = await hash(`${data.password}.${saltStr}`, 10);
            const userId = ulid();


            const res = await c.env.dbCMS.prepare(
                `INSERT INTO users (id, name, email, salt, password, roles, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, json(?), ?, ?)`
            ).
                bind(userId, data.name, data.email, saltStr, hashedPassword, data.roles, now, now).
                run<User>();

            if (!res.success) {
                console.log(res.error);
                return c.jsonT<ApiError>({
                    error: "Database error"
                }, 500);
            }

            return c.jsonT({ message: "OK" }, 201);
        } catch (e) {
            console.log(e);
            return c.jsonT<ApiError>({
                error: String(e)
            }, 500);
        }
    });

type getType = typeof getRoute;
const getRoute = app.get("/:id",
    isSignedIn,
    zValidator("param", z.object({
        id: z.string(),
    })),
    async c => {
        const { id: userId } = c.req.valid("param");

        try {
            const user = await c.env.dbCMS.prepare("SELECT * FROM users WHERE id = ?").
                bind(userId).
                first<User>();

            if (!user) {
                return c.jsonT<ApiError>({
                    error: "User not found"
                }, 404);
            }

            return c.jsonT({
                user
            });
        } catch (e) {
            console.log(e);
            return c.jsonT<ApiError>({
                error: String(e)
            }, 500);
        }
    });

type updateType = typeof updateRoute;
const updateRoute = app.put("/:id",
    isSignedIn,
    isAdmin,
    zValidator("param", z.object({
        id: z.string(),
    })),
    zValidator("json", z.object({
        name: z.string(),
        email: z.string().email(),
        roles: z.array(z.string()),
        config: z.record(z.any()).optional(),
        password: z.string().optional(),
    })),
    async c => {
        const { id: userId } = c.req.valid("param");
        const data = c.req.valid("json");

        const now = Date.now();
        try {
            const res = await c.env.dbCMS.prepare(
                `UPDATE users SET name = ?, email = ?, roles = json(?), config = json(?), updatedAt = ? WHERE id = ?`
            ).
                bind(data.name, data.email, data.roles, data.config ?? {}, now, userId).
                run<User>();

            if (!res.success) {
                console.log(res.error);
                return c.jsonT<ApiError>({
                    error: "Database error"
                }, 500);
            }

            if (data.password) {
                const saltBase = new TextEncoder().encode(ulid());
                const salt = await crypto.subtle.digest(
                    {
                        name: 'SHA-512',
                    },
                    saltBase // The data you want to hash as an ArrayBuffer
                );
                const saltStr = new Uint8Array(salt).toString();
                const hashedPassword = await hash(`${data.password}.${saltStr}`, 10);

                const res = await c.env.dbCMS.prepare(
                    `UPDATE users SET password = ?, salt = ? updatedAt = ? WHERE id = ?`
                ).
                    bind(hashedPassword, saltStr, now, userId).
                    run<User>();

                if (!res.success) {
                    console.log(res.error);
                    return c.jsonT<ApiError>({
                        error: "Database error"
                    }, 500);
                }
            }

            return c.jsonT({ message: "OK" });
        } catch (e) {
            console.log(e);
            return c.jsonT<ApiError>({
                error: String(e)
            }, 500);
        }
    });

type deleteType = typeof deleteRoute;
const deleteRoute = app.delete("/:id",
    isSignedIn,
    isAdmin,
    zValidator("param", z.object({
        id: z.string(),
    })),
    async c => {
        // TODO: Delete all user's sessions
        const { id: userId } = c.req.valid("param");

        try {
            const res = await c.env.dbCMS.prepare(
                `DELETE FROM users WHERE id = ?`
            ).
                bind(userId).
                run<User>();

            if (!res.success) {
                console.log(res.error);
                return c.jsonT<ApiError>({
                    error: "Database error"
                }, 500);
            }

            return c.jsonT({ message: "OK" });
        } catch (e) {
            console.log(e);
            return c.jsonT<ApiError>({
                error: String(e)
            }, 500);
        }
    });


export type types = listType | createType | getType | updateType | deleteType;

export default app;