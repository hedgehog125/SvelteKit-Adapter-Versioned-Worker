# SvelteKit-Adapter-Versioned-Worker
A SvelteKit adapter for generating service workers to make your SvelteKit sites work offline.

**Note**: Currently your project must be compatible with `@sveltejs/adapter-static` to be able to use this adapter. See [the SvelteKit docs](https://kit.svelte.dev/docs/page-options#prerender) for more information.

## Getting Started
First, make sure you have the peer dependencies installed:
 * `@sveltejs/adapter-static` 2.x.x
 * `typescript` 5.x.x (even if you're just using JavaScript)
 * `tslib` 2.x.x (even if you're just using JavaScript)

You likely already have these, but make sure they're updated:
 * `@sveltejs/kit` ^1.22.0
 * `svelte` 4.x.x
 * `vite` 4.x.x

Install them as dev dependencies with:
```
npm i <packages needed, separated by spaces> -D
```

Then install this package with:
```bash
npm i sveltekit-adapter-versioned-worker -D
```

<br>
Next, make sure you've configured SvelteKit to prerender all routes. You do this in your `src/routes/+layout.ts` (or .js) file:

```ts
export const prerender = true;
// ...
```

Import and use this package as your SvelteKit adapter in your `svelte.config.js` file:

```js
import { adapter } from "sveltekit-adapter-versioned-worker";
// ...
const config = {
  kit: {
    // ...
    adapter: adapter()
  }
};
// ...
```

Next, you need to tell Versioned Worker where to find its `versionedWorker.json` file. This file contains, among a few other things, the necessary metadata of the previous build to work out what's changed. TODO

**Note**: It doesn't matter too much if you have to reset the `versionedWorker.json` file, as the built service workers will perform a clean install in this case, redownloading everything.