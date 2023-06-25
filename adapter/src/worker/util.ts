const VARY_HEADER = "vary";

export function summarizeRequest(request: Request): SummarizedRequest {
	const varyHeaders = (request.headers.get(VARY_HEADER)?? "").split(",").map(rawHeaderName => rawHeaderName.trim().toLowerCase());

	return [
		request.method,
		request.url,
		Object.fromEntries(
			Array.from(request.headers)
			.sort((pair1, pair2) => sortCompare(pair1[0], pair2[0]))
			.map(([headerName, value]) => [headerName.toLowerCase(), value])
		),
		varyHeaders.filter(headerName => request.headers.has(headerName)).sort(sortCompare)
	];

	function sortCompare(value1: string, value2: string): number {
		if (value1 < value2) return -1;
		if (value1 > value2) return 1;
		return 0;
	}
}

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

export type SummarizedRequest = [method: string, url: string, headers: Record<string, string>, varyHeaderNames: string[]];