# Bugs
Include the virtualModules.d.ts file in the tsconfig during the worker build?
Send a different error if offline and the page isn't known
Redirect incorrect trailing slashes in the service worker. Also redirect /index.html. Is it in scope if you're going to the homepage and there's no trailing slash?

# Features
Add a way to detect when a response is stale. 
Configuring the static adapter
Configuring TypeScript for the handler file
Add message handle (postMessage)

# Tweaks
Create another helper.ts type file for more specific stuff. Move the sub functions into that