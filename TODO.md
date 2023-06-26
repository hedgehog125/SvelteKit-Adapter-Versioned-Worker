Handle HEAD requests
Upgrade svelte-package
What cache mode should fetch use in the worker? Always no-store?
Treat some HTTP status codes like network errors

# Bugs
TypeScript compile errors aren't emitted
Handle worker build errors somehow. Should the info file still be generated for the sake of readLast?
Redirect incorrect trailing slashes in the service worker. Also redirect /index.html. URLs paths always start with a slash, enforced by the browser
Don't hardcode sw.js in ServiceWorker.svelte. Export from runtime-constants?

# Features
JavaScript support
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Configuring the static adapter
Configuring TypeScript for the hooks file, along with other build plugins
Allow running code after everything is done
Add message handle (postMessage)
Add an easy way to modify headers before the response is sent. New hook? Maybe only for requests using the default mechanism (not handled)?
File info argument for file sorters. Or an async function so files don't always have to be statted

# Tweaks
Use sets instead of arrays for the constants?

# Tests to make
Abort signals, both for cached and uncached requests
Are the custom headers always correct?
Do the different cache modes work?