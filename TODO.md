Log based on what files are new? e.g only list newly added lazy files?
Warnings for large media files since they won't stream
Warnings for non-static files using lax or stale lazy as they will become unreferenced and removed when updated
Increase the number of updates per version file to 25 but reduce the max number to 5
Store information about when the update notification was dismissed? Could potentially be used in the future?

# Svelte Utils

# Bugs

# Features
Add message handle (postMessage). Called "handleCustomMessage"
Add an easy way to modify headers before the response is sent. New hook? Maybe only for requests using the default mechanism (not handled)?
Allow FileSorters to return null and create a utility function that runs through an array of them until one returns something other than null

A way to transfer info from the prerender to the file sorter
Make more hard-coded values configurable
Add option for the service worker TypeScript folder. Then only the entry and hooks file would need to be transpiled from the "src" folder

# Tweaks
Use sets instead of arrays for the constants
Should just be able to modify request and response headers using their methods (get, set, delete etc.)

# Low priority
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Configuring the static adapter
Keep track of the files added to the build and give them to the onFinish function
Strict lazy should error if it fetches a resource from a later version. Not that important since those likely include a hash

# Tests to make
Are the custom headers always correct?
Do the different cache modes work?
Abort signals, both for cached and uncached requests (no browser support though `:(`)

# Manually test
Does the adapter work without the Vite plugin?
Does it work when trailing slash is set to never?