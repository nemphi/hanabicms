import { Hono } from "hono";
import { nanoid } from "nanoid";
import { hash } from "bcryptjs";
import type { C } from ".";
import { signedIn } from "./auth";
import type { ApiError, ApiSimpleResponse, ApiRecordResponse } from "../lib/types";

export type User = {
    id: string;
    name: string;
    email: string;
    salt: string;
    password: string;
    roles: string;
    createdAt: string;
    updatedAt: string;
}

export type UserMetadata = {
    email: string;
    roles: string;
}


const app = new Hono<C>();

app.use("*", signedIn);

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
        const userId = nanoid();
        await c.env.kvCMS.put(`users/${userId}`, JSON.stringify({
            id: userId,
            name: body.name,
            email: body.email,
            salt: saltStr,
            password: hashedPassword,
            roles: body.roles,
            createdAt: now,
            updatedAt: now
        }), {
            metadata: {
                email: body.email,
                roles: body.roles
            }
        });

        return c.json<ApiSimpleResponse<any>>({ message: "OK" }, 201);
    } catch (error: unknown) {
        console.log(error);
        return c.json<ApiError>({
            error: error as string
        }, 500);
    }
});

app.get("/:id", async c => {
    const user = await c.env.kvCMS.get<User>(`users/${c.req.param("id")}`, "json");

    if (!user) {
        return c.json<ApiError>({
            error: "User not found"
        }, 404);
    }
    return c.json<ApiRecordResponse<User>>({
        id: user.id,
        data: user,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    });
});

app.put("/:id", async c => {
    const body = await c.req.json<User>();

    const oldUser = await c.env.kvCMS.get<User>(`users/${c.req.param("id")}`, "json");

    if (!oldUser) {
        return c.json<ApiError>({
            error: "User not found"
        }, 404);
    }

    await c.env.kvCMS.put(`users/${c.req.param("id")}`, JSON.stringify({
        id: c.req.param("id"),
        name: body.name,
        email: body.email,
        salt: oldUser.salt,
        password: oldUser.password,
        roles: body.roles,
        createdAt: oldUser.createdAt,
        updatedAt: new Date().toISOString()
    }), {
        metadata: {
            email: body.email,
            roles: body.roles
        }
    });

    return c.json<ApiSimpleResponse<any>>({ message: "OK" });
});

app.delete("/:id", async c => {
    await c.env.kvCMS.delete(`users/${c.req.param("id")}`);

    return c.json<ApiSimpleResponse<any>>({ message: "OK" });
});


export default app;