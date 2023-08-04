// Some data needs to be accessible by the worker module but should be kept private, that data goes here.
export const workerState = {
	quickFetchPromises: new Map<string, Promise<Response>>()
};

// Internal functions that are shared between the entry and the worker virtual module

export const INLINED_RELOAD_PAGE = `<script>addEventListener("DOMContentLoaded",()=>{navigator.serviceWorker.getRegistration().then(t=>{if(!(t&&t.waiting))return e();let i=0;r(),setInterval(r,100);function r(){t.waiting?.postMessage({type:"skipWaiting"}),i===100&&e(),i++}}),navigator.serviceWorker.addEventListener("controllerchange",e);let n=!1;function e(){n||(n=!0,location.reload())}})</script>`;