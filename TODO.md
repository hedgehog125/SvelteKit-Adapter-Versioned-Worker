# Bugs
Handle worker build errors somehow. Should the info file still be generated for the sake of readLast?
Send a different error if offline and the page isn't known
Redirect incorrect trailing slashes in the service worker. Also redirect /index.html. Is it in scope if you're going to the homepage and there's no trailing slash?

# Features
Implement the different cache strategies into the worker
How does this plugin work when deploying to Vercel? Since that changes how the static adapter works
Add a way to detect when a response is stale. 
Configuring the static adapter
Configuring TypeScript for the hooks file, along with other build plugins
Allow running code after everything is done
Add message handle (postMessage)

# Tweaks
Create another helper.ts type file for more specific stuff. Move the sub functions into that