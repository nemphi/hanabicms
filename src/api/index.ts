import { R2Bucket, D1Database } from "@cloudflare/workers-types";
import { Hono } from "hono";
import auth from "./auth";
import media from "./media";
import users, { User } from "./users";
import records from "./records";
import { type CollectionConfig } from "../lib/collections";




type Env = {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// kvCMS: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// sessions: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	r2CMS: R2Bucket;

	d1CMS: D1Database;
}

type Variables = {
	// session: Session;
	user: User;
	collections: CollectionConfig[];
}

export type C = {
	Bindings: Env;
	Variables: Variables;
}

export function router(prefix = "") {
	const app = new Hono<C>();

	app.route(`${prefix}/auth`, auth);

	app.route(`${prefix}/users`, users);

	app.route(`${prefix}/media`, media);

	app.route(`${prefix}/data`, records);

	return app;
}



// app.get("/", async c => {
// 	c.text("Hello world");
// 	return c.text("Hello World!");
// })

// export default {
// 	async fetch(
// 		request: Request,
// 		env: Env,
// 		ctx: ExecutionContext
// 	): Promise<Response> {
// 		return new Response("Hello World!");
// 	},
// };

export default router();
