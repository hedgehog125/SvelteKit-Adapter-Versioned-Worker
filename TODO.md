Upgrade svelte-package

# Bugs
TypeScript compile errors aren't emitted
Handle worker build errors somehow. Should the info file still be generated for the sake of readLast?
Send a different error if offline and the page isn't known
Redirect incorrect trailing slashes in the service worker. Also redirect /index.html. Is it in scope if you're going to the homepage and there's no trailing slash?
Does changing to Windows line endings break the worker? It uses an actual new line instead of \n
Don't hardcode sw.js in ServiceWorker.svelte

# Features
Implement the different cache strategies into the worker
JavaScript support
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Add a way to detect when a response is stale. 
Configuring the static adapter
Configuring TypeScript for the hooks file, along with other build plugins
Allow running code after everything is done
Add message handle (postMessage)

# Tweaks
Add the base URL in the worker to the files to save space. Rather than prefixing each asset