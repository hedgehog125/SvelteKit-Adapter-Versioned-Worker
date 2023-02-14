import type { Handle } from "@sveltejs/kit";

import { minify } from "html-minifier";
import { building } from "$app/environment";


const minification_options = {
	caseSensitive: true,
	collapseWhitespace: true,
	conservativeCollapse: true,
	preserveLineBreaks: false,

	collapseBooleanAttributes: true,
	decodeEntities: true,
	html5: true,
	minifyCSS: true,
	minifyJS: true,
	removeAttributeQuotes: true,
	removeComments: true,
	removeOptionalTags: true,
	removeRedundantAttributes: true,
	removeScriptTypeAttributes: true,
	removeStyleLinkTypeAttributes: true,
	sortAttributes: true,
	sortClassName: true
};

export const handle = (async ({ event, resolve }) => {
	const response = await resolve(event);
 
	if (building && response.headers.get("content-type") === "text/html") {
		return new Response(minify(await response.text(), minification_options), {
			status: response.status,
			headers: response.headers
		});
	}
 
	return response;
}) satisfies Handle;