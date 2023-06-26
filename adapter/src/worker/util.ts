const VARY_HEADER = "vary";

export type SummarizedRequest = [method: string, url: string, headers: Record<string, string>, varyHeaderNames: string[]];
/**
 * Allows requests to be postmessaged and compared more easily.
 * 
 * @param request The request to summarise
 * @returns A `SummarizedRequest`
 */
export function summarizeRequest(request: Request): SummarizedRequest {
	const varyHeaders = (request.headers.get(VARY_HEADER)?? "").split(",").map(rawHeaderName => rawHeaderName.trim().toLowerCase());

	return [
		request.method,
		request.url,
		Object.fromEntries(
			Array.from(request.headers)
			.map(([headerName, value]) => [headerName.toLowerCase(), value])
			.sort((pair1, pair2) => sortCompare(pair1[0], pair2[0]))
		),
		varyHeaders.filter(headerName => request.headers.has(headerName)).sort(sortCompare)
	];

	function sortCompare(value1: string, value2: string): number {
		if (value1 < value2) return -1;
		if (value1 > value2) return 1;
		return 0;
	}
}
/**
 * Compares 2 `SummarizedRequest`s.
 * 
 * @param req1 The 1st `SummarizedRequest` of the comparison
 * @param req2 The 2nd `SummarizedRequest` of the comparison
 * @param ignoreVaryWildcard By default, either requests having their vary header as "*" will cause the function to return false. Setting this to true will instead treat the headers as if they were blank.
 * 
 * @returns `true` if the requests match, else `false`
 */
export function compareRequests(req1: SummarizedRequest, req2: SummarizedRequest, ignoreVaryWildcard = false): boolean {
	if (req1[1] !== req2[1] || req1[0] !== req2[0]) return false; // Check the URL and methods are the same

	if (! ignoreVaryWildcard) {
		// 3 is vary headers
		if (req1[3].toString() === "*" || req2[3].toString() === "*") {
			return false;
		}
	}

	const unionOfVaryHeaders = new Set<string>([
		...req1[3],
		...req2[3]
	]);
	const headersAsMaps = [
		new Map(Object.entries(req1[2])),
		new Map(Object.entries(req2[2]))
	];
	for (const headerName of unionOfVaryHeaders) {
		if (headersAsMaps[0].get(headerName) !== headersAsMaps[1].get(headerName)) return false;
	}

	return true;
}
/**
 * Compares the request to another request created with the same URL.
 * 
 * @param request The request to compare to the default one 
 * @returns `true` if the requests match, else `false`
 */
export function isRequestDefault(request: Request): boolean {
	return compareRequests(summarizeRequest(request), summarizeRequest(new Request(request.url)));
}

/**
 * Creates a new response with the modified headers.
 * 
 * @param response The response to "modify"
 * @param newHeaders An object where each key is the header to modify and its value is the new value
 * @returns A response with the modified headers
 * 
 * @note
 * This function consumes the body of `response`. If you still want to use body of the original `response`, call this function with `<response>.clone()` instead of just `<response>`. 
 */
export function modifyResponseHeaders(response: Response, newHeaders: Record<string, string>): Response {
	return new Response(response.body, {
		status: response.status,
		headers: {
			...Object.fromEntries(response.headers),
			...newHeaders
		}
	});
}