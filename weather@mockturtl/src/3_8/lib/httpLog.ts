export type Primitive = boolean | string | number | null;

export function RedactUrlValue(url: string, value: string): string {
	return value === "" ? url : url.replace(value, "[REDACTED]");
}

function IsCredentialParameter(name: string): boolean {
	return /^(?:api[_-]?key|appid|key|token|access[_-]key)$/i.test(name);
}

function AddParamsToURI(url: string, params?: Record<string, Primitive>, redactCredentials = false): string {
	if (params == null)
		return url;

	let result = url;
	for (const [index, item] of Object.keys(params).entries()) {
		result += index === 0 ? "?" : "&";
		result += item + "=" + (redactCredentials && IsCredentialParameter(item) ? "[REDACTED]" : params[item]);
	}
	return result;
}

export function BuildRequestUrls(url: string, params?: Record<string, Primitive>, logUrl?: string, encode = true): { requestUrl: string; logUrl: string } {
	const requestUrl = AddParamsToURI(url, params);
	const safeLogUrl = AddParamsToURI(logUrl ?? url, params, true);
	return {
		requestUrl: encode ? encodeURI(requestUrl) : requestUrl,
		logUrl: encode ? encodeURI(safeLogUrl) : safeLogUrl,
	};
}
