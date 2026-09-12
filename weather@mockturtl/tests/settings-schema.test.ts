import settingsSchema from "../files/weather@mockturtl/3.8/settings-schema.json";
import { equal, test } from "./harness";

function IsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function CollectLayoutKeys(layout: unknown): Set<string> {
	const keys = new Set<string>();
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const item of node)
				visit(item);
			return;
		}
		if (!IsRecord(node))
			return;
		if (Array.isArray(node["keys"])) {
			for (const key of node["keys"]) {
				if (typeof key === "string")
					keys.add(key);
			}
		}
		for (const value of Object.values(node))
			visit(value);
	};
	visit(layout);
	return keys;
}

test("every schema key with a dependency appears in the layout", () => {
	const body = settingsSchema as unknown as Record<string, unknown>;
	const layoutKeys = CollectLayoutKeys(body["layout"]);

	const missing = Object.entries(body)
		.filter(([key, widget]) => key !== "layout" && IsRecord(widget) && typeof widget["dependency"] === "string")
		.map(([key]) => key)
		.filter((key) => !layoutKeys.has(key));

	for (const key of missing)
		console.error(`Key with dependency missing from layout: ${key}`);
	equal(missing.length, 0);
});

test("every key in the layout is defined in the schema", () => {
	const body = settingsSchema as unknown as Record<string, unknown>;
	const layoutKeys = CollectLayoutKeys(body["layout"]);

	const unknownKeys = [...layoutKeys].filter((key) => !(key in body));
	for (const key of unknownKeys)
		console.error(`Layout references unknown key: ${key}`);
	equal(unknownKeys.length, 0);
});
