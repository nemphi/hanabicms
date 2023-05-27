# Nemphi CMS

This is an edge-cms heavily inspired by [@payloadcms](https://github.com/payloadcms/payload). It's a fully hosted CMS that runs on Cloudflare's edge network.

## Why?

My initial goal was to contribute to Payload, but their dependency on the Node runtime and MongoDB made it impossible for me to contribute. I wanted to build a CMS that was fully hosted and used only Cloudflare's offerings.

Cloudflare's edge network is a great place to run a CMS, since it's fast, secure and scalable.

## What is an "Edge-CMS"?

The edge has two meanings, edge (location) and edge (runtime). This cms uses **both** meanings of edge since it's fully hosted and uses only Cloudflare's offerings.

## The Stack

We make use of the following Cloudflare products:

* [D1 Database](https://developers.cloudflare.com/d1/)
* [KV Store](https://www.cloudflare.com/products/workers-kv/)
* [R2 Storage](https://www.cloudflare.com/products/r2/)

## Requirements

* Node 18+
* Cloudflare account

## Instalation

This cms can be installed in two ways, but regardless

### Standalone instalation

This means deploying a Cloudflare worker and accesing it via the API.

To do this simply clone the repo and deploy your worker.

`git clone github.com/nemphi/cms`

`cd cms`

`npx wrangler publish`

### Embedded in your app

Since we operate in a edge-runtime environment, you can include the cms in your server-side app code and call the API directly (as a function call).

**Note: For this to work you would need to deploy your app with [Cloudflare Pages](https://pages.cloudflare.com/)**

`cd <your app>`

`npm install @nemphi/cms`

And in your server code

```ts
// component.ts

// ...
import cms, {Client} from "@nemphi/cms"

const cmsClient = new Client(cms)

// inside your component fetch logic
const users = await cmsClient.collection("users").find()
```

## Admin UI

We offer an admin UI written in 

