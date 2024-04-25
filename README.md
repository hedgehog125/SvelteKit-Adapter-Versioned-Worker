**Announcement**: Do You Want Support for Other Frameworks, Modularity and Tests? Voice your interest on [this issue](https://github.com/hedgehog125/SvelteKit-Adapter-Versioned-Worker/issues/2).

---

# SvelteKit-Adapter-Versioned-Worker
A SvelteKit adapter for generating service workers to make your SvelteKit sites work offline.

[Source Code](https://github.com/hedgehog125/SvelteKit-Adapter-Versioned-Worker) | [NPM Package](https://www.npmjs.com/package/sveltekit-adapter-versioned-worker) | [Example](https://github.com/hedgehog125/Bagel-V2)

Features:
 * No need to deal with caching headers or durations
 * Reload opportunity and resumable state system for more seamless updates
 * Different update priorities to avoid unnecessarily bothering users
 * An easy-to-use hooks system for virtual routes and more
 * Supports a number of different file modes, including stale-while-revalidate and `"semi-lazy"`
 * Easily dynamically prefetch data in the worker while the page loads
 * Update on reload
 * Small worker builds, starting at ~4KB brotli'd

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

Next, you need to tell Versioned Worker where to find its last `versionedWorker.json` file. This file is outputted as part of a build and contains, among a few other things, the necessary metadata of the previous build to work out what's changed. For development, you probably want to read it from the disk, while for production you probably want to download it over HTTP(S). By doing it this way, you can test how your PWA updates between test builds and you can stop clients from having to download unnecessary test build metadata. You can do this with the `standardGetLast` method, which returns a `LastInfoProvider`:

```js
import { adapter, standardGetLast } from "sveltekit-adapter-versioned-worker";
// ...
const isTestBuild = process.env.IS_TEST_BUILD === "true";
// ...
const config = {
  kit: {
    // ...
    adapter: adapter({
      lastInfo: standardGetLast("<insert deployed site URL here, including the base URL if you have one>/versionedWorker.json", isTestBuild)
    })
  }
};
// ...
```

And then set up something like this in your `package.json`. While you're here, you also need to swap out the `preview` command:
```js
{
  // ...
  "scripts": {
    // ...
    "build": "vite build",
    "testBuild": "cross-env IS_TEST_BUILD=true vite build",
    "preview": "http-server build"
    // ...
  },
  // ...
}
```

Then install those 2 packages with:
```
npm i cross-env http-server -D
```

Note that that code assumes your `versionedWorker.json` file is at `<build directory location>/versionedWorker.json` (where it gets outputted). If you want to do something more advanced, you can specify a different path with the 3rd argument, use a different `LastInfoProvider` or write your own function that `satisfies` that type. Also note that for your first build, Versioned Worker will create a `versionedWorker.json` file as the old one won't be able to be found.

---
**Note**: It doesn't matter too much if you have to reset the `versionedWorker.json` file. The built service workers will perform a clean install in this case, redownloading everything.

---

Then, add the `ServiceWorker` component to your `src/routes/+layout.svelte` file so it's actually used:

```html
<script lang="ts">
  import { ServiceWorker } from "sveltekit-adapter-versioned-worker/svelte";
  // ...
</script>

<ServiceWorker></ServiceWorker>
<!-- ... -->
<slot></slot>
```

<br>

This next step is technically optional, but a number of things about the adapter won't work as well without it. Versioned Worker provides a manifest generator Vite plugin. By default, it just makes the `"start_url"` and `"scope"` propeties optional and minifies the result, but you can replace this basic behaviour with the `"process"` option. For this section though, just leave the arguments blank:

```ts
// In your vite.config.ts (or .js) file

import { manifestGeneratorPlugin } from "sveltekit-adapter-versioned-worker";
// ...
export default defineConfig({
  // ...
  plugins: [
    // ...
    manifestGeneratorPlugin()
  ]
  // ...
});
```

Like with the adapter, this just generates the file, so you need a little more code to use it. Add this to your `src/app.html` file:
```html
<!-- ... -->
<html>
  <head>
    <!-- ... -->
    <link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest"/>
    <!-- ... -->
  </head>
</html>
<!-- ... -->
```

Then just make sure it actually has a manifest to process. To do this, make a `src/manifest.webmanifest` file. You might find this template useful, but just note that you don't have to fill in the details immediately if you're still early in development:
```json
{
  "icons": [],
  "name": "**Insert value**",
  "short_name": "**Insert value**",
  "background_color": "**Insert value**",
  "theme_color": "**Insert value**",
  "description": "**Insert value**",
  "display": "fullscreen",
  "orientation": "any"
}
```
**See**: [The MDN docs](https://developer.mozilla.org/en-US/docs/Web/Manifest) for more information.

---
**Note**: If you decide you don't want Versioned Worker to manage your web app manifest, I'd strongly suggest setting the plugin's `"enable"` property to `false` instead of removing it entirely. This way, it'll still be able to assist the adapter.

---

<br>
Your website should now work offline once built, but there are some more things you might want to know...

<br>

## Concepts, Tips and Tricks
**Note**: These generally have 1 or more types associated with them. They'll provide more information in the form of a jsdoc comment.

### File Sort Modes
By default, all of the build files* will be sorted as the default mode of `"pre-cache`". This means that once your service worker has installed, your assets will always be accessible. However, this often won't provide the best experience. So, you might want to change the modes of some of the files. You do this by setting `adapterConfig.sortFile` to a `FileSorter` function:
```js
// In svelte.config.js

// ...
    adapter: adapter({
      // ...
      sortFile: (fileInfo) => {
        if (fileInfo.href === "ping.txt") return "never-cache"; // For example
      }
    })
// ...

```


\*With the exception of filenames starting with a dot and a couple of specific files. Route files also always have their mode set to `"pre-cache"`. These files won't call your `FileSorter`.

See `FileSorter` and `FileSortMode` in the module `"sveltekit-adapter-versioned-worker"` for more info.

### TypeScript Functions in Your Svelte Config File
Despite the Svelte config not supporting TypeScript, you can still write config related functions in it. To do this, call `shareValueWithSvelteConfig` in your `vite.config.ts` file and then use `valuesFromViteConfig` in your Svelte config:
```ts
// In vite.config.ts
import { shareValueWithSvelteConfig } from "sveltekit-adapter-versioned-worker";
// ...

shareValueWithSvelteConfig("sortFile", (fileInfo) => {
  return "not-a-sort-mode"; // TypeScript will now prevent you from doing this
});
// ...

// In svelte.config.js
import { valuesFromViteConfig } from "sveltekit-adapter-versioned-worker";

// ...
    adapter: adapter({
      // ...
      sortFile: valuesFromViteConfig.sortFile
    })
// ...
```

You can share any value with your Svelte config but these keys have to use the types you'd expect:
 * `"lastInfo"` -> `LastInfoProvider` 
 * `"sortFile"` -> A `FileSorter` or an array of them (`MaybeArray<Nullable<FileSorter> | undefined | false>`)
 * `"configureWorkerTypescript"` -> `WorkerTypeScriptConfigHook`
 * `"onFinish"` -> `BuildFinishHook`

## Update Priorities and Prompts
By default, updates have the `patch` priority, which doesn't prompt the user and instead relies on reload opportunities to update the app*. However, you can increase the priority in the `AdapterConfig`:

```js
// ...
    adapter: adapter({
      // To change the priority of an update, increase one of these before you build
      isElevatedPatchUpdate: 0,
      isMajorUpdate: 0,
      isCriticalUpdate: 0,
      // ...
    })
// ...
```

\*Patch updates can become `elevated patches`, see the `UpdatePriority` type.

See `UpdatePriority` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information.

## Request Modes
Versioned Worker supports a few different modes for requests. You can change the mode for a request by setting its `"vw-mode"` header or search parameter to a `VWRequestMode`.

See `VWRequestMode` in the module `"sveltekit-adapter-versioned-worker/worker"` for more information.

You might also find `createURLWithVWMode` in the `svelte/util` module useful.

## Service Worker Hooks
If you create a `hooks.worker.ts` (or .js) file in your `src` directory, you can hook into a few different parts of the service worker. Do this by exporting one or more of these:
 * `"handleFetch"` should use the type `HandleFetchHook`
 * `"handleResponse"` should use the type `HandleResponseHook`
 * `"handleCustomMessage"` should use the type `HandleCustomMessageHook`

See those types in the module `"sveltekit-adapter-versioned-worker/worker"` for more information.

## Reload Opportunities
By default, Versioned Worker won't ever reload your app for an update except as part of an update prompt. However, there are likely situations where you can reload the page without the user really noticing. I'm referring to these as "reload opportunities".

If you don't ever have any state that needs to be kept, you can use `allowReloadOnNavigateWhileMounted` in your `src/routes/+layout.svelte` file:

```html
<script lang="ts">
  import { allowReloadOnNavigateWhileMounted } from "sveltekit-adapter-versioned-worker/svelte";
  // ...
  allowReloadOnNavigateWhileMounted();
  // ...
</script>

<!-- ... -->
```

You can also override this for some layouts/routes with `dontAllowReloadForNextNavigation`. Just keep in mind that the user might visit one of these routes, get some state you don't want discarded and then navigate around the rest of the site, potentially resulting in reloads.

So instead, most of the time you'll want to call `reloadOpportunity` yourself, as that's essentially how the other function works. If you're calling it as part of a SvelteKit `beforeNavigate` callback, make sure you pass the `BeforeNavigate` object as the first argument.

By calling `reloadOpportunity` yourself, you might also be able to use it in more situations. This is because you can pass the function a `ResumableState` object or a `ResumableStateCallback`, which you can then get again with `resumeState` once the app has updated. You can then use the object to put the app back into roughly the state it was in before. Example:

```html
<!-- src/routes/+page.svelte -->

<script lang="ts">
  import { difficulty } from "$lib/state.js";

  import { beforeNavigate } from "$app/navigation";
  import { reloadOpportunity } from "sveltekit-adapter-versioned-worker/svelte";
  import { link } from "sveltekit-adapter-versioned-worker/svelte/util";

  beforeNavigate(navigation => {
    reloadOpportunity(navigation, {
      formatVersion: 1,
      data: generateTheResumableState()
      //    ^ You'll need to write a function like this yourself
    });
  });
</script>

<label>
  Difficulty:
  <input type="number" bind:value={$difficulty}>
</label>
<br><br>

<!-- This would probably be done differently, but it works for the example -->
<a href={link("game")}>Play</a>

<!-- src/routes/game/+page.svelte -->
<script lang="ts">
  import { difficulty } from "$lib/state.js";

  import { resumeState } from "sveltekit-adapter-versioned-worker/svelte";
  import { onMount } from "svelte";

  onMount(async () => {
    const resumableState = await resumeState();
    if (resumableState == null) return; // The page didn't reload for an update while navigating to here
    if (resumableState.formatVersion !== 1) return;
    const contents = resumableState.data as V1ResumableState;
    // You'll need to make a type like V1ResumableState

    $difficulty = contents.difficulty;
  });
</script>

<p>
  Selected difficulty: {$difficulty}
</p>

<!-- ... -->
```

See:
 * `allowReloadForNextNavigation`
 * `dontAllowReloadForNextNavigation`
 * `allowReloadOnNavigateWhileMounted`
 * `dontAllowReloadOnNavigateWhileMounted`
 * `reloadOpportunity`
 * `resumeState`

in the module `"sveltekit-adapter-versioned-worker/svelte"`.

## Quick Fetch
An interesting optimisation* you can do with a service worker is preloading dynamic data while the page is loading. From my testing, this typically reduces the response time by 80ms. Versioned Worker makes this easy to do with the `preloadQuickFetch` and `quickFetch` methods. Example:
```ts
// In hooks.worker.ts
import { preloadQuickFetch } from "sveltekit-adapter-versioned-worker/worker";
// ...

export const handleFetch = virtualRoutes({
  // Make sure the ending slash matches your SvelteKit config
  "/example/": () => {
    preloadQuickFetch("https://api.example.com/v1/example");

    // Since we don't actually want this to be a virtual route and just want a listener, no Response is returned
  },
  // ...
});
// ...
```

\*Of course, you can also do the same with SSR and that's probably better in most situations. But this way is a bit more flexible and also a bit cheaper.

Then use `quickFetch` in a Svelte component or page:
```html
<script lang="ts">
  import { quickFetch } from "sveltekit-adapter-versioned-worker/svelte";
  import { loadOnMount } from "sveltekit-adapter-versioned-worker/svelte/util";
  // ...

  const loadPromise = loadOnMount(async () => {
    const res = await quickFetch("https://api.example.com/v1/example");
    return await res.text();
  });
  // ...
</script>

<p>
  {#await loadPromise}
    Loading...
  {:then text}
    Got: {text}
  {:catch}
    Failed to fetch.
  {/await}
</p>
```

See `preloadQuickFetch` in `"sveltekit-adapter-versioned-worker/worker"` and `quickFetch` in the `svelte` module for more information.

<br>

## Migrating from SvelteKit-*Plugin*-Versioned-Worker
Remove the old package and follow the normal instructions. Once you build your SvelteKit project with this new package, your `versionedWorker.json` file will be automatically updated and the generated service worker will be able to handle updating from the plugin. However, no previous cache will be reused and you might also need to update some things before you deploy:
 * `degitLast` was removed. See if you can use `fetchLast` instead or write your own `LastInfoProvider`.
 * The `lazyCache` and `exclude` options were replaced by `AdapterConfig.sortFile`.
 * `RegisterWorker` has been replaced by `ServiceWorker`.
 * The export `handle` in the `hooks.worker.js` file was renamed to `handleFetch` and now has different parameters.


<br>

## Common Issues
### "I sometimes get 404s after an update"
See `AdapterConfig.useHTTPCache`.

### "Video/audio is slow to load"
See the [limitations section](#limitations).

<br>

## Documentation
For now, most of the documentation is provided exclusively in the form of (extensive) jsdoc comments. But here's a bit of information on the different modules and their exports...

## Modules
### "sveltekit-adapter-versioned-worker"
Contains things directly related to the build process, like the adapter and manifest plugin.

**Exports**:
 * `adapter`
 * `fetchLast`
 * `readLast`
 * `standardGetLast`
 * `manifestGeneratorPlugin`
 * `defaultManifestProcessor`
 * `shareValueWithSvelteConfig`
 * `valuesFromViteConfig`

**Types**:
 * `AllConfigs` (C)
 * `AdapterConfig` (A)
 * `ManifestPluginConfig` (A)
 * `ResolvedAdapterConfig` (B)
 * `ResolvedManifestPluginConfig` (B)
 * `LastInfoProviderConfigs` (C)
 * `ManifestProcessorConfigs` (C)
 * `BuildFinishHook` (B)
 * `ProcessedBuild` (C)
 * `CategorizedBuildFiles` (C)
 * `FileSortMode` (A)
 * `FileSorter` (A)
 * `VWBuildFile` (C)
 * `BuildInfo` (C)
 * `FileSorterMessage` (C)
 * `FileSorterMessages` (C)
 * `LastInfoProvider` (B)
 * `LogLevel` (C)
 * `ManifestProcessor` (B)
 * `MaybeArray` (A)
 * `MaybePromise` (A)
 * `Nullable` (A)
 * `SvelteConfig` (C)
 * `ViteConfig` (C)
 * `TypescriptConfig` (C)
 * `MinimalViteConfig` (C)
 * `ValuesFromViteConfig` (C)
 * `VersionedWorkerLogger` (C)
 * `WebAppManifest` (B)
 * `WorkerTypeScriptConfigHook` (B)

The letter in brackets denotes how often you have to think about the type itself:
 * `A` means it's relatively commonly used
 * `B` means it can be useful, but it might have niche use-cases
 * `C` means it's not directly used much, but it might be parameter of a commonly used function type

### "sveltekit-adapter-versioned-worker/svelte"
Has the abstractions and wrappers for working with the service worker.

**Exports**:
 * `DefaultUpdatePrompt`
 * `ServiceWorker`
 * `allowReloadForNextNavigation`
 * `allowReloadOnNavigateWhileMounted`
 * `dontAllowReloadForNextNavigation`
 * `dontAllowReloadOnNavigateWhileMounted`
 * `isReloadOnNavigateAllowed`
 * `checkForUpdates`
 * `checkIfResumableState`
 * `resumeState`
 * `dismissUpdateMessage`
 * `displayedUpdatePriority`
 * `getActiveWorkerInfo`
 * `getWaitingWorkerInfo`
 * `isWorkerActive`
 * `messageActiveWorker`
 * `messageWaitingWorker`
 * `quickFetch`
 * `reloadOpportunity`
 * `statResource`
 * `virtualFetch`

**Types**:
 * `MaybeArray` (A)
 * `MaybePromise` (A)
 * `Nullable` (A)
 * `ResourceInfo` (C)
 * `WorkerRegistrationFailEvent` (B)
 * `WorkerRegistrationFailReason` (C)
 * `VWCustomMessageEvent` (B)
 * `WorkerUpdateCheckEvent` (B)

 The letter in brackets denotes how often you have to think about the type itself:
 * `A` means it's relatively commonly used
 * `B` means it can be useful, but it might have niche use-cases
 * `C` means it's not directly used much, but it might be parameter of a commonly used function type

<br>

**Constants**:
 * `RELOAD_RETRY_TIME`
 * `RELOAD_TIMEOUT`
 * `REQUEST_RESUMABLE_STATE_TIMEOUT`
 * `RESUMABLE_STATE_NAME`
 * `RESUMABLE_STATE_TIMEOUT`
 * `UPDATE_PRIORITY_NAMES`
 * `UPDATE_PROMPT_MESSAGES`


### "sveltekit-adapter-versioned-worker/svelte/util"
Contains some utility functions related to your frontend code but not necessarily to your service worker.

**Exports**:
 * `ExposedPromise`
 * `createURLWithSearchParams`
 * `createURLWithVWMode`
 * `getNavigationDestURL`
 * `link`
 * `loadOnMount`
 * `range`
 * `timeoutPromise`
 * `waitForEvent`
 * `waitForEventWithTimeout`

**Types**:
 * `Listenable` (C)

The letter in brackets denotes how often you have to think about the type itself:
 * `A` means it's relatively commonly used
 * `B` means it can be useful, but it might have niche use-cases
 * `C` means it's not directly used much, but it might be parameter of a commonly used function type

### "sveltekit-adapter-versioned-worker/worker"
A module for use in your `hooks.worker.ts` (or .js) file. It contains exports providing information about the build, as well as some utilities that only make sense in this context.

**Note**: This is a virtual module that's only available in the worker build. While it's perfectly fine to import its types elsewhere, you won't be able to import any values. Note that some exports have an equivalent in the `runtime-constants` module.

**Exports**:
 * `broadcast`
 * `combineFetchHandlers`
 * `ignoreCrossOriginFetches`
 * `virtualRoutes`
 * `modifyResponseHeadersBeforeSending`
 * `modifyResponsesToCrossOriginIsolateApp`
 * `preloadQuickFetch`

**Types**:
 * `CustomMessageHookData` (A)
 * `DataWithFormatVersion` (A)
 * `HandleCustomMessageHook` (A)
 * `HandleFetchHook` (A)
 * `HandleResponseHook` (A)
 * `WorkerInfo` (B)
 * `KnownMajorVersionWorkerInfo` (B)
 * `WorkerMajorV1KnownMinorInfo` (B)
 * `WorkerMajorV1UnknownMinorInfo` (B)
 * `WorkerV1Info` (B)
 * `UnknownWorkerInfo` (B)
 * `MaybeArray` (A)
 * `MaybePromise` (A)
 * `Nullable` (A)
 * `ResumableState` (A)
 * `ResumableStateCallback` (A)
 * `UpdatePriority` (B)
 * `VWRequest` (C)
 * `VWRequestMode` (A)
 * `VWResponse` (C)

**Note**: That excludes the large number of types for the native service worker APIs, as well as the semi-internal Versioned Worker types that are still exported.

The letter in brackets denotes how often you have to think about the type itself:
 * `A` means it's relatively commonly used
 * `B` means it can be useful, but it might have niche use-cases
 * `C` means it's not directly used much, but it might be parameter of a commonly used function type

**Native Service Worker API Types**:
 * `ActivateEvent`
 * `AddEventListener`
 * `CacheStorageOptions`
 * `Client`
 * `ClientFrameType`
 * `ClientMatchOptions`
 * `ClientMatchTypes`
 * `Clients`
 * `ExtendableEvent`
 * `ExtendableMessageEvent`
 * `FetchEvent`
 * `InstallEvent`
 * `NotificationEvent`
 * `PushEvent`
 * `PushMessageData`
 * `Registration`
 * `ServiceWorkerGlobalScopeEventMap`
 * `ServiceWorkerNotificationOptions`
 * `SkipWaiting`
 * `SyncEvent`
 * `WindowClient`
 * `WindowClientState`

**Semi-Internal Versioned Worker Types**:
 * `ConditionalSkipMessageData`
 * `CustomMessageData`
 * `InputMessageData`
 * `InputMessageType`
 * `InputMessageVoidData`
 * `InputMessageVoidType`
 * `OutputMessageData`
 * `OutputMessageType`
 * `OutputMessageVoidData`
 * `OutputMessageVoidType`
 * `ResumeMessageData`
 * `VersionFile`
 * `WorkerInfoMessageData`

**Constants**:
 * `AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS`
 * `BASE_URL`
 * `ENABLE_PASSTHROUGH`
 * `ENABLE_QUICK_FETCH`
 * `MAX_VERSION_FILES`
 * `VERSION_FILE_BATCH_SIZE`
 * `REDIRECT_TRAILING_SLASH`
 * `STORAGE_PREFIX`
 * `USE_HTTP_CACHE`
 * `VERSION_FOLDER`
 * `LAX_LAZY`
 * `PRECACHE`
 * `ROUTES`
 * `SEMI_LAZY`
 * `STALE_LAZY`
 * `STRICT_LAZY`
 * `TAG`
 * `VERSION`

### "sveltekit-adapter-versioned-worker/worker/util"
Unlike the `worker` module, this isn't a virtual module and so can be used outside of the service worker build. It contains utilities related to the service worker that are usable outside of it.

**Exports**:
 * `ExposedPromise`
 * `isResponseTheDefault`
 * `modifyRequestHeaders`
 * `modifyResponseHeaders`
 * `summarizeRequest`

**Types**:
 * `SummarizedRequest` (B)

The letter in brackets denotes how often you have to think about the type itself:
 * `A` means it's relatively commonly used
 * `B` means it can be useful, but it might have niche use-cases
 * `C` means it's not directly used much, but it might be parameter of a commonly used function type

**Constants**:
 * `INFO_STORAGE_PATH`
 * `VIRTUAL_FETCH_PREFIX`

### "sveltekit-adapter-versioned-worker/runtime-constants"
Contains constants related to the build.

**Note**: This a virtual module that only has proper values during the build (and not in the prerender or worker build). The values *are* readable in other situations but they will all be `null`. Additionally, this virtual module also requires the manifest plugin to be used in order for it to have non-`null` values.

**Constants**:
 * `AUTO_PASSTHROUGH_CROSS_ORIGIN_REQUESTS`
 * `CHECK_FOR_UPDATES_INTERVAL`
 * `ENABLE_PASSTHROUGH`
 * `ENABLE_QUICK_FETCH`
 * `ENABLE_SECOND_UPDATE_PRIORITY_ELEVATION`
 * `OUTPUT_WORKER_FILE_NAME`
 * `REDIRECT_TRAILING_SLASH`
 * `USE_HTTP_CACHE`
 * `VERSION`

<br><br>

## Limitations
* Range requests aren't supported by the service worker. If the resource is set to be cached, the range will be ignored. This means that for some large files, using `"never-cache"` might result in better performance, as range requests will work as normal. Alternatively, you might be able to implement something with a `HandleFetchHook`.
 * This build plugin currently can't be used with SSR.

## Reporting Bugs
I haven't yet written any automated tests for this package yet so expect some bugs. If you find any, please [raise an issue](https://github.com/hedgehog125/SvelteKit-Adapter-Versioned-Worker/issues).
