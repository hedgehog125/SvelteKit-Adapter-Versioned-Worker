Update handle to use a single object as its argument
Upgrade svelte-package
Treat some HTTP status codes like network errors
Disable passthrough by default
Log based on what files are new? e.g only list newly added lazy files?
Improve how the worker updates
Warnings for large media files since they won't stream
Warnings for non-static files using lax or stale lazy as they will become unreferenced and removed when updated

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
Allow FileSorters to return null and create a utility function that runs through an array of them until one returns something other than null 

# Tweaks
Use sets instead of arrays for the constants?

# Tests to make
Are the custom headers always correct?
Do the different cache modes work?
Abort signals, both for cached and uncached requests (no browser support though `:(`)