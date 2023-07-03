type Nullable<T> = T | null;

const VARY_HEADER = "vary";
/**
 * Checks if a default fetch with the same URL would likely return the same response.
 * 
 * @param request The request associated with `response`
 * @param response The response from fetching with unknown changes (if any) to the default headers
 * @param ignoreVaryWildcard If the `vary` header being `"*"` should be ignored
 * @returns `true` if a default fetch would likely return the same response, else `false`
 * 
 * @note This doesn't send another request
 * @note The bodies of `response` and `request` are **not** consumed
 * @note Non `GET` requests will always return `false`
 * @note Responses with a `vary` wildcard return `false` unless `ignoreVaryWildcard` is set to `true`
 */
export function isResponseTheDefault(request: Request, response: Response, ignoreVaryWildcard: boolean = false): boolean {
	if (request.method !== "GET") return false;

	const varyHeaders = (response.headers.get(VARY_HEADER)?? "")
		.split(",")
		.map(rawHeaderName => rawHeaderName.trim().toLowerCase())
		.filter(headerName => headerName !== "")
	;

	if (! ignoreVaryWildcard) {
		if (varyHeaders.toString() === "*") return false;
	}

	// Remaking the request removes the forbidden headers and those will always be the default value
	const programmaticHeaders = new Request(request.url, {
		headers: request.headers
	}).headers;

	for (const [headerName] of programmaticHeaders) {
		if (headerName === "accept" || headerName === "user-agent") continue; // These will be in programmaticHeaders but are unlikely to have been changed from their default values
		if (varyHeaders.includes(headerName)) return false; // Since the header has been set, it's probably not the default value
	}
	return true;
}

/**
 * Creates a new `Request` with the modified headers.
 * 
 * @param request The request to "modify"
 * @param newHeaders An object where each key is the header to modify and its value is the new value
 * @returns A `Request` with the modified headers
 * 
 * @note
 * This function consumes the body of `request`. If you still want to use body of the original `request`, call this function with `<request>.clone()` instead of just `<request>`.
 * @note Headers can be removed by setting them to `null`.
 */
export function modifyRequestHeaders(request: Request, newHeaders: Record<string, Nullable<string>>): Request {
	return new Request(request, { // This *doesn't* clone the response body
		headers: modifyHeaders(request.headers, newHeaders)
	});
}

/**
 * Creates a new `Response` with the modified headers.
 * 
 * @param response The response to "modify"
 * @param newHeaders An object where each key is the header to modify and its value is the new value
 * @returns A `Response` with the modified headers
 * 
 * @note
 * This function consumes the body of `response`. If you still want to use body of the original `response`, call this function with `<response>.clone()` instead of just `<response>`.
 * @note Headers can be removed by setting them to `null`.
 */
export function modifyResponseHeaders(response: Response, newHeaders: Record<string, Nullable<string>>): Response {
	return new Response(response.body, {
		status: response.status,
		headers: modifyHeaders(response.headers, newHeaders)
	});
}

function makeHeadersLowercase(headers: Record<string, Nullable<string>>): Record<string, Nullable<string>> {
	return Object.fromEntries(Object.entries(headers).map(([headerName, headerValue]) => [headerName.toLowerCase(), headerValue]));
}

function removeNullHeaders(headers: Record<string, Nullable<string>>): [string, string][] {
	return Object.entries(headers).filter(([, headerValue]) => headerValue != null) as [string, string][];
}

function modifyHeaders(original: Headers, newHeaders: Record<string, Nullable<string>>): [string, string][] {
	return removeNullHeaders({
		...Object.fromEntries(original),
		...makeHeadersLowercase(newHeaders)
	});
}