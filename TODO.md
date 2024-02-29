# Most important
 * Bug fix: Use "./" instead of "" in the manifest for the start_url and scope. "" refers to the manifest file itself
 * Support dynamic routes when a fallback is used
 * Split most of the logic off into a new versioned-worker package and have this adapter call it
 * Tests (largely dependant on the splitting)



# Bugs
 * Error when hooks has external dependency
 * createURLWithSearchParams doesn't work with relative URLs. Create equivalent for worker build
 * Undefined reference when using Vite plugin without adapter

# Features
 * "ignore" FileSortMode and track changes to "never-cache" resources
 * Install hook which provides which provides which "never-cache" resources changed
 * Custom virtual modules and aliases in worker build

 * hasUnsavedChanges store which is boolean | null. Null uses the old behaviour while if it's set, the critical update will work better and reloadOppertunity won't do anything if it's true

 * A way to transfer info from the prerender to the file sorter
 * Make more hard-coded values configurable
 * Add option for the service worker TypeScript folder. Then only the entry and hooks file would need to be transpiled from the "src" folder

# Tweaks
 * Refactor some of the worker
 * Simplify update on reload by only updating on the reload page, even in Chrome

 # Low priority
 * How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
 * Configuring the static adapter
 * Keep track of the files added to the build and give them to the onFinish function
 * Strict lazy should error if it fetches a resource from a later version. Not that important since those likely include a hash
 * Store information about when the update notification was dismissed? Could potentially be used in the future?
 * Improve how the back forwards cache is handled after updating. Currently, the first reload after an update results in a second reload to handle the back forwards restore. Weirdly also happens with SPA navigations? They seem to be triggering browser navigations

---

<br>

# Tests
 * Likely need to split off into versioned-worker and this adapter that calls it

## To implement
### General
 * TODO

### Slightly obscure
 * Are the custom headers always correct?
 * Do the different cache modes work?
 * Abort signals, both for cached and uncached requests (no browser support though `:(`)
 * Does the adapter work without the Vite plugin?
 * Does it work when trailing slash is set to never?