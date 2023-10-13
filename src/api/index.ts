import type { R2Bucket, KVNamespace } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import auth, { authType } from "./auth";
import media from "./media";
import users, { type User } from "./users";
import records, { recordType } from "./records";
import install from "./install";

import type { CollectionConfig } from "../lib/collections";
import { ZodError } from "zod";


type Env = {
	r2CMS: R2Bucket;

	// kvCMS: KVNamespace;

	dbCMS: D1Database;
}

type Variables = {
	// session: Session;
	user?: User;
	collections: Record<string, CollectionConfig<any>>;
	collection?: CollectionConfig<any>;
}

export type C = {
	Bindings: Env;
	Variables: Variables;
}

export function router(prefix = "", collections: Record<string, CollectionConfig<any>>) {
	const app = new Hono<C>();

	app.onError(async (err, c) => {
		console.error(err);
		if (err instanceof HTTPException) {
			return err.getResponse();
		}
		if (err instanceof ZodError) {
			return c.text(err.message, 400);
		}
		return c.text(err.message, 500);
	})

	app.use("*", cors({
		origin: "*",
	}));

	app.use("*", async (c, next) => {
		c.set("collections", collections);
		await next();
	});

	return app.route(`${prefix}/auth`, auth).
		route(`${prefix}/users`, users).
		route(`${prefix}/media`, media).
		route(`${prefix}/data`, records).
		route(`${prefix}/install`, install);
}

export type AppType = ReturnType<typeof router> | authType | recordType;
