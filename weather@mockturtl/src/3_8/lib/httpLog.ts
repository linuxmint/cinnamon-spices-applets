export type Primitive = boolean | string | number | null;

function AddParamsToURI(url: string, params?: Record<string, Primitive>): string {
	if (params == null)
		return url;

	let result = url;
	for (const [index, item] of Object.keys(params).entries()) {
		result += index === 0 ? "?" : "&";
		result += item + "=" + params[item];
	}
	return result;
}

export function BuildRequestUrls(url: string, params?: Record<string, Primitive>, logUrl?: string): { requestUrl: string; logUrl: string } {
	return {
		requestUrl: encodeURI(AddParamsToURI(url, params)),
		logUrl: encodeURI(AddParamsToURI(logUrl ?? url, params)),
	};
}
