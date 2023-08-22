# Setting up locally
---
## Explanation
Due to the Svelte library project not working well with the plain TypeScript project, this package's setup is a bit unconventional...

The source code is split into 2 different folders: "adapter" and "svelte". The `adapter` folder contains the code for the adapter, the Vite plugin and any code that's shared between the adapter and the Svelte library. The first 2 are in `/adapter/index.ts` and the last is in `/adapter/src/exportedBySvelteModule.ts`.

The `svelte` folder is a standard Svelte library project and is also where you'll prototype most things. Some of the overall package's exports have an equivalent in the `internal-adapter` and so can be imported into here. Additionally, `/adapter/src/exportedBySvelteModule.ts` can be imported as `internal-adapter/exported-by-svelte-module`.

---

Install the dependencies in both the `adapter` and `svelte` folders with `npm i`. Then run `npm run dev` in the `adapter` folder.

Then link the adapter to the Svelte folder with `npm link` in the adapter folder and `npm link internal-adapter` in the Svelte folder.

Depending on what part of this build plugin you're working on, it might be worth running the Vite dev server with `npm run dev` in the Svelte folder. Otherwise, just use `npm run build` when you're ready to test things.

# Importing modules from the Svelte library project
As mentioned in the first explanation, you can import a few modules from `internal-adapter`. These imports (of both types and values) will be replaced as part of the packaging process.

**The exception** to this import replacement however is **Svelte components**. So instead, any values or externally accessible types that are imported from `internal-adapter` should be imported indirectly. Do this by re-exporting them from a `.ts` file in the `lib` folder, typically `internal.ts`.

Another exception is the module `internal-adapter/worker`/ `sveltekit-adapter-versioned-worker/worker`. Because it's a virtual module, the first will use its error throwing placeholder, as it won't be replaced, even in the `hooks.worker.ts` file. So for now, when importing **values** from it into the `hooks.worker.ts` file, use `sveltekit-adapter-versioned-worker/worker` and a `@ts-ignore`. **Types** on the other hand, should be imported from `internal-adapter/worker`.

An unrelated gotcha is importing `src/lib/index.ts` (or an equivalent like `$lib` on its own). Doing so can create circular imports which can prevent the Vite dev server from working properly. Instead, import `src/lib/index_internal.ts` as that doesn't have the component re-exports which cause the issue.

# Packaging
This process has a few moving parts than I would like, but it's the best solution I was able to come up with. 

First, build the adapter and the Svelte library project. This is done with their npm `"build"` scripts. For the adapter folder you can alternatively use the watch mode but **remember to also do this for the templates in `adapter/static`**.  

**Note**: if you add any new module entries to `internal-adapter`, you'll need to update `fixImports.js` as mentioned in a moment.

Next, in the `packager` folder, run `npm run package`.

---
## Explanation
The `packager` folder has a couple of scripts relating to combining the 2 builds. The first: `package` is called manually, while the second: `fixImports` is called as part of the build process for the Svelte library.

`packager/fixImports.js` replaces `internal-adapter` imports with what will be the relative path to the corresponding file. The exception to this is `internal-adapter/runtime-constants` where, since it's a virtual module, it's replaced by `sveltekit-adapter-versioned-worker/runtime-constants`. These replacements are defined by the `replacements` variable at the top of the file. The script will error if there isn't a replacement for an import starting with `"internal-adapter"`.

The `packager/index.js` script (the file for the `package` command) on the other hand is much simpler. It just copies files and folders as specified by the `COPY_LIST` variable at the top of the file.

---

Lastly, due to the peer dependencies, it's important that you use `npm install <path to /packager/dist>` rather than `npm link sveltekit-adapter-versioned-worker`. This is because when a package is npm linked, it won't use `node_modules` folder of any parent folders. I know this creates more friction, but there are already several other stages in the chain in this situation anyway. Also, you should be using the `internal-adapter` inside of the Svelte library for most of your development time anyway.

When you update the packaged version, delete the `sveltekit-adapter-versioned-worker` folder from the node_modules of your test SvelteKit project and run `npm i` (assuming it's still a dependency in your package.json).
