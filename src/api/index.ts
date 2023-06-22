import type { R2Bucket, KVNamespace } from "@cloudflare/workers-types";
import { Hono } from "hono";
import auth from "./auth";
import media from "./media";
import users, { type User } from "./users";
import records from "./records";
import install from "./install";

import type { CollectionConfig } from "../lib/collections";


type Env = {
	r2CMS: R2Bucket;

	kvCMS: KVNamespace;
}

type Variables = {
	// session: Session;
	user: User;
	collections?: Record<string, CollectionConfig<any>>;
	collection?: CollectionConfig<any>;
}

export type C = {
	Bindings: Env;
	Variables: Variables;
}

export function router(prefix = "", collections?: Record<string, CollectionConfig<any>>) {
	const app = new Hono<C>();

	app.use(async (c, next) => {
		c.set("collections", collections);
		await next();
	});

	app.route(`${prefix}/auth`, auth);

	app.route(`${prefix}/users`, users);

	app.route(`${prefix}/media`, media);

	app.route(`${prefix}/data`, records);

	app.route(`${prefix}/install`, install);

	return app;
}


export default router("");
