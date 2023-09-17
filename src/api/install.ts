import { Hono } from "hono";
import { C } from ".";
import { ApiSimpleResponse } from "../lib/types";
import { ulid } from "ulidx";
import { User } from "./users";


const app = new Hono<C>();

app.get("/", async c => {

    const installed = await c.env.kvCMS.get("config/installed", "text")

    if (installed) {
        return c.json<ApiSimpleResponse<any>>({
            data: {
                installed: true
            }
        }, 404)
    }

    const now = Date.now();

    const user: User = {
        id: ulid(),
        name: "admin",
        email: "admin",
        salt: "63d84400bbfec879d8089ec7b5f044d49b2fe39b6486bd7b273cbbae26bfb3e85eb622f3b89ccef35ee90f5ea9393fbf6591951cf6d49231ce0bde55258a276e",
        password: "$2a$12$aqv2aPQGAL9kSHteiiYMne8phPK/w6MAukGiXobkP59ONBw/vwpb.", // admin
        roles: ["admin"],
        config: {},
        createdAt: now,
        updatedAt: now
    }

    await c.env.dbCMS.prepare("INSERT INTO users (id, name, email, salt, password, roles, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, json(?), json(?), ?, ?)").
        bind(user.id, user.name, user.email, user.salt, user.password, user.roles, user.config, user.createdAt, user.updatedAt).
        run();

    await c.env.kvCMS.put("config/installed", "true")

    return c.jsonT({
        data: {
            completed: true
        }
    })
})

export default app;