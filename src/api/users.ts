import { Hono } from "hono";
import { nanoid } from "nanoid";
import { hash } from "bcryptjs";
import type { C } from ".";
import { isAdmin } from "./auth";
import type { ApiError, ApiSimpleResponse, ApiRecordResponse } from "../lib/types";

export type User = {
    id: string;
    name: string;
    email: string;
    salt: string;
    password: string;
    roles: string;
}

export type UserMetadata = {
    email: string;
    roles: string;
    createdAt: number;
    updatedAt: number;
}


const app = new Hono<C>();

app.use("*", isAdmin);

app.get("/", async c => {

    const result = await c.env.kvCMS.list({
        prefix: "users/",
        limit: 100
    });

    if (result.list_complete) {
        return c.json<ApiSimpleResponse<{
            keys: typeof result.keys;
            list_complete: true;
        }>>({
            data: {
                keys: result.keys,
                list_complete: true
            }
        })
    }

    return c.json<ApiSimpleResponse<{
        keys: typeof result.keys;
        list_complete: boolean;
        cursor: string;
    }>>({
        data: {
            keys: result.keys,
            list_complete: false,
            cursor: result.cursor
        }
    })
});

app.post("/", async c => {
    const body = await c.req.json<User>();

    try {
        const now = new Date().getTime();
        const saltBase = new TextEncoder().encode(nanoid());
        const salt = await crypto.subtle.digest(
            {
                name: 'SHA-512',
            },
            saltBase // The data you want to hash as an ArrayBuffer
        );
        const saltStr = new Uint8Array(salt).toString();
        const hashedPassword = await hash(`${body.password}.${saltStr}`, 10);
        const userId = nanoid();

        const user: User = {
            id: userId,
            name: body.name,
            email: body.email,
            salt: saltStr,
            password: hashedPassword,
            roles: body.roles,
        }

        const metadata: UserMetadata = {
            email: body.email,
            roles: body.roles,
            createdAt: now,
            updatedAt: now
        }

        await c.env.kvCMS.put(`users/${userId}`, JSON.stringify(user), { metadata });

        return c.json<ApiSimpleResponse<any>>({ message: "OK" }, 201);
    } catch (error: unknown) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:id", async c => {
    const user = await c.env.kvCMS.getWithMetadata<User, UserMetadata>(`users/${c.req.param("id")}`, "json");

    if (!user) {
        return c.json<ApiError>({
            error: "User not found"
        }, 404);
    }

    if (!user.metadata) {
        return c.json<ApiError>({
            error: "User metadata not found"
        }, 404);
    }

    if (!user.value) {
        return c.json<ApiError>({
            error: "User value not found"
        }, 404);
    }

    return c.json<ApiRecordResponse<User>>({
        id: c.req.param("id"),
        data: user.value,
        createdAt: user.metadata.createdAt,
        updatedAt: user.metadata.updatedAt
    });
});

app.put("/:id", async c => {
    const body = await c.req.json<User>();

    const oldUser = await c.env.kvCMS.getWithMetadata<User, UserMetadata>(`users/${c.req.param("id")}`, "json");

    if (!oldUser) {
        return c.json<ApiError>({
            error: "User not found"
        }, 404);
    }

    if (!oldUser.metadata) {
        return c.json<ApiError>({
            error: "User metadata not found"
        }, 404);
    }

    if (!oldUser.value) {
        return c.json<ApiError>({
            error: "User value not found"
        }, 404);
    }

    const user: User = {
        id: c.req.param("id"),
        name: body.name,
        email: body.email,
        salt: oldUser.value.salt,
        password: oldUser.value.password,
        roles: body.roles,
    }

    const metadata: UserMetadata = {
        email: body.email,
        roles: body.roles,
        createdAt: oldUser.metadata.createdAt,
        updatedAt: new Date().getTime()
    }

    await c.env.kvCMS.put(`users/${c.req.param("id")}`, JSON.stringify(user), { metadata });

    return c.json<ApiSimpleResponse<any>>({ message: "OK" });
});

app.delete("/:id", async c => {
    // TODO: Delete all user's sessions
    await c.env.kvCMS.delete(`users/${c.req.param("id")}`);

    return c.json<ApiSimpleResponse<any>>({ message: "OK" });
});


export default app;