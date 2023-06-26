import { base } from "$app/paths";

export function link(relativePath: string): string {
	if (base === "") return `/${relativePath}`;
	
	return base + relativePath;
}