Log based on what files are new? e.g only list newly added lazy files?
Warnings for large media files since they won't stream
Warnings for non-static files using lax or stale lazy as they will become unreferenced and removed when updated
Store information about when the update notification was dismissed? Could potentially be used in the future?

# Svelte Utils

# Bugs
TypeScript compile errors aren't emitted
Handle worker build errors somehow. Should the info file still be generated for the sake of readLast?
Don't hardcode sw.js in ServiceWorker.svelte. Export from runtime-constants. Add note to config that changing the entry requires using the vite plugin
Strict lazy should error if it fetches a resource from a later version

# Features
JavaScript support
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Configuring the static adapter
Configuring TypeScript for the hooks file, along with other build plugins
Allow running code after everything is done
Add message handle (postMessage)
Add an easy way to modify headers before the response is sent. New hook? Maybe only for requests using the default mechanism (not handled)?
Allow FileSorters to return null and create a utility function that runs through an array of them until one returns something other than null
A way to transfer info from the prerender to the file sorter
Make more hard-coded values configurable

# Tweaks
Use sets instead of arrays for the constants
Should just be able to modify request and response headers using their methods (get, set, delete etc.)

# Low priority


# Tests to make
Are the custom headers always correct?
Do the different cache modes work?
Abort signals, both for cached and uncached requests (no browser support though `:(`)

# Manually test
Does the adapter work without the Vite plugin?
Does it work when trailing slash is set to never?