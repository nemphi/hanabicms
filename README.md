# HanabiCMS

<a href="https://twitter.com/shixzie" rel="nofollow"><img src="https://img.shields.io/badge/created%20by-@shixzie-4BBAAB.svg" alt="Created by Juan Alvarez"></a>
<a href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/nemphi/hanabicms" alt="License"></a>
<a href="https://www.npmjs.com/package/hanabicms" rel="nofollow"><img src="https://img.shields.io/npm/dw/hanabicms.svg" alt="npm"></a>
<a href="https://www.npmjs.com/package/hanabicms" rel="nofollow"><img src="https://img.shields.io/github/stars/nemphi/hanabicms" alt="stars"></a>

This is an end-to-end fully-typed edge-cms heavily inspired by [@payloadcms](https://github.com/payloadcms/payload). It's a fully hosted CMS that runs on Cloudflare's edge network.

## Status

This project is currently in ⚠️ **alpha** ⚠️. It's not ready for production use.

D1 (The database we use) is in beta stage, so it's not ready for production use either.

## Why?

My initial goal was to contribute to Payload, but their dependency on the Node runtime and MongoDB made it impossible for me to contribute. I wanted to build a CMS that was fully hosted and used only Cloudflare's offerings.

Cloudflare's edge network is a great place to run a CMS, since it's fast, secure and scalable.

## What is an "Edge-CMS"?

The edge has two meanings, edge (location) and edge (runtime). This cms uses **both** meanings of edge since it makes use of the entire Cloudflare Developer Platform offerings.

## The Stack

We make use of the following Cloudflare products:

* [Workers](https://www.cloudflare.com/products/workers/)
* [D1 Database](https://www.cloudflare.com/products/d1/)
* [R2 Storage](https://www.cloudflare.com/products/r2/)

## Requirements

* Node 18+
* Cloudflare account

## Instalation

This cms can be installed in two ways:

### Standalone instalation

This means deploying a Cloudflare worker and accesing it via the API.

To do this simply clone the repo and deploy your worker.

```bash
# Still deciding what is the best way to distribute updates
# Ignore the following steps, this is WIP

git clone github.com/nemphi/hanabicms
cd hanabicms
cp wrangler.example.toml wrangler.toml

# edit wrangler.toml and add your bindings info

npx wrangler d1 migrations apply D1_BINDING_NAME
npx wrangler deploy
```

### Embedded in your app

Since we operate in a edge-runtime environment, you can include the cms in your server-side app code and call the API directly (as a function call).

**Note: For this to work you would need to deploy your app with [Cloudflare Pages](https://pages.cloudflare.com/) and add the corresponding bindings manually in the Cloudflare Dashboard.**

```bash
# Still deciding what is the best way to distribute updates
# Ignore the following steps, this is WIP

cd YOUR_APP
npm install hanabicms
```

And in your server code

```ts
// collections.ts

import { collection } from "hanabicms"

const collections = {
    contactForm: collection({
        label: "Contact Form",
        fields: {
            name: {
                type: "text",
                label: "Name",
                required: true,
                default: ""
            },
            email: {
                type: "text",
                label: "Email",
                required: true,
                default: ""
            },
            message: {
                type: "text",
                label: "Message",
                required: true,
                default: ""
            }
        },
        hooks: {
            beforeCreate: async (data) => {
                // you can make modifications that will be saved to DB
                return data
            },
            afterCreate: async (record) => {
                // get the record that was created
            }
        }
    })
}

export default collections
```

```ts
// server.ts

// ...
import { router } from "hanabicms"
import collections from "./collections"

// /api is the path to your cms router
const cms = router("/api", collections)


// You will need to listen on the following methods:
// GET, POST, PUT, DELETE
export function handleRequest(request: Request): Response {
  return cms.fetch(request, process.env)
}

///////////////////////////////

// Next.js example hosted on Cloudflare Pages
// app/api/[...path]/route.ts
export function GET(req: Request) {
    return cms.fetch(req, process.env)
}

export function POST(req: Request) {
    return cms.fetch(req, process.env)
}

export function PUT(req: Request) {
    return cms.fetch(req, process.env)
}

export function DELETE(req: Request) {
    return cms.fetch(req, process.env)
}
```

```ts
// component.ts

// ...
import { Client } from "hanabicms"
import collections from "./collections"

// /api is the path to your cms router
const cmsClient = new Client("/api", "<AUTH TOKEN>", collections)

// inside your component fetch logic
const forms = await cmsClient.collection("contactForm").list()
```

## Admin UI

The admin UI is beign built on top of [HTMX](https://htmx.org/), this ensures the cms is framework-agnostic and can be deployed alongside any codebase.