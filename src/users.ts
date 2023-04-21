import { Hono } from "hono";
import { C } from ".";
import { hash } from "bcryptjs";
import { signedIn } from "./auth";

export type User = {
    id: number;
    name: string;
    email: string;
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
        return c.text("Error: " + result.error, 500);
    }

    return c.json({ users: result.results })
});

app.post("/", async c => {
    const body = await c.req.json<User>();

    const stmt = c.env.d1CMS.prepare("INSERT INTO users (name, email, password, roles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    try {
        const now = new Date().toISOString();
        const hashedPassword = await hash(body.password, 10);
        const result = await stmt.bind(body.name, body.email, hashedPassword, body.roles, now, now).run();

        if (!result.success) {
            return c.text("Error: " + result.error, 500);
        }

        return c.text("OK")
    } catch (error) {
        console.log(error);
        return c.text("Error: " + error, 500);
    }
});

app.get("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("SELECT id, name, email, roles, created_at, updated_at FROM users WHERE id = ?");
    const user = await stmt.bind(c.req.param("id")).first<User>();

    if (!user) {
        return c.text("User not found", 404);
    }
    return c.json({ user });
});

app.put("/:id", async c => {
    const body = await c.req.json<User>();

    const stmt = c.env.d1CMS.prepare("UPDATE users SET name = ?, email = ?, password = ?, roles = ? WHERE id = ?");
    const result = await stmt.bind(body.name, body.email, body.password, body.roles, c.req.param("id")).run();

    if (!result.success) {
        return c.text("Error: " + result.error, 500);
    }
    return c.text("OK")
});

app.delete("/:id", async c => {
    const stmt = c.env.d1CMS.prepare("DELETE FROM users WHERE id = ?");
    const result = await stmt.bind(c.req.param("id")).run();

    if (!result.success) {
        return c.text("Error: " + result.error, 500);
    }

    return c.text("OK")
});


export default app;