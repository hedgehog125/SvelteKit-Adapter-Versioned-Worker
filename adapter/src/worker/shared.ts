import type { OutputMessageData, WindowClient } from "./staticVirtual.js";

// Some data needs to be accessible by the worker module but should be kept private, that data goes here.
export const workerState = {
	quickFetchPromises: new Map<string, Promise<Response>>()
};

// Internal functions that are shared between the entry and the worker virtual module

export const INLINED_RELOAD_PAGE = `<script>onload=()=>{navigator.serviceWorker.getRegistration().then(async n=>{if(!n?.waiting)return t();o();let a=0;for(;;){const r=performance.now(),s=await new Promise(e=>{navigator.serviceWorker.addEventListener("message",e,{once:!0}),setTimeout(()=>e(!1),500)});if(a++,s.data?.type==="vw-skipFailed"||a===100||!n.waiting)return t();o();const c=performance.now();await new Promise(e=>{setTimeout(()=>e(),100-(c-r))})}function o(){n.waiting?.postMessage({type:"conditionalSkipWaiting"})}}),navigator.serviceWorker.addEventListener("controllerchange",t);let i=!1;function t(){i||(i=!0,location.reload(),setInterval(()=>location.reload(),1e3))}}</script>`;

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