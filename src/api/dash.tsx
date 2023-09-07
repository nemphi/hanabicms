import { Hono } from "hono";
import { C } from ".";
import { isAdmin } from "./auth";

const app = new Hono<C, {}, "/dash">();

app.use("*", isAdmin);


export default app;

