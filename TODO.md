Log based on what files are new? e.g only list newly added lazy files?

# To include in readme
No support for range requests means large assets have to download the whole thing first

# Svelte Utils

# Bugs

# Features


A way to transfer info from the prerender to the file sorter
Make more hard-coded values configurable
Add option for the service worker TypeScript folder. Then only the entry and hooks file would need to be transpiled from the "src" folder

# Tweaks

# Low priority
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Configuring the static adapter
Keep track of the files added to the build and give them to the onFinish function
Strict lazy should error if it fetches a resource from a later version. Not that important since those likely include a hash
Store information about when the update notification was dismissed? Could potentially be used in the future?
Improve how the back forwards cache is handled after updating. Currently, the first reload after an update results in a second reload to handle the back forwards restore. Weirdly also happens with SPA navigations? They seem to be triggering browser navigations

# Tests to make
Are the custom headers always correct?
Do the different cache modes work?
Abort signals, both for cached and uncached requests (no browser support though `:(`)

# Manually test
Does the adapter work without the Vite plugin?
Does it work when trailing slash is set to never?