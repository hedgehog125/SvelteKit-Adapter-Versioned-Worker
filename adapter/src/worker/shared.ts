import type { OutputMessageData, WindowClient } from "./staticVirtual.js";

// Some data needs to be accessible by the worker module but should be kept private, that data goes here.
export const workerState = {
	quickFetchPromises: new Map<string, Promise<Response>>()
};

// Internal functions that are shared between the entry and the worker virtual module

export const INLINED_RELOAD_PAGE = `<script>addEventListener("DOMContentLoaded",()=>{navigator.serviceWorker.getRegistration().then(async i=>{if(!i?.waiting)return t();r();let a=0;for(;;){const o=performance.now(),s=await new Promise(e=>{navigator.serviceWorker.addEventListener("message",e,{once:!0}),setTimeout(()=>e(!1),500)});if(a++,s.data?.type==="vw-skipFailed"||a===100)return t();r();const c=performance.now();await new Promise(e=>{setTimeout(()=>e(),100-(c-o))})}function r(){i.waiting?.postMessage({type:"conditionalSkipWaiting"})}}),navigator.serviceWorker.addEventListener("controllerchange",t);let n=!1;function t(){n||(n=!0,location.reload())}})</script>`;

/**
 * Returns an error response rather than throwing if there's a network error.
 */
export async function wrappedFetch(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	}
	catch {
		return Response.error();
	}
}

export function broadcastInternal(activeClients: WindowClient[], data: OutputMessageData) {
	activeClients.forEach(client => client.postMessage(data));
}