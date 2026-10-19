type Test = {
	name: string;
	callback: () => void;
};

const tests: Test[] = [];

export function test(name: string, callback: () => void): void {
	tests.push({ name, callback });
}

export function equal(actual: unknown, expected: unknown): void {
	if (actual !== expected)
		throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

export function deepEqual(actual: unknown, expected: unknown): void {
	if (JSON.stringify(actual) !== JSON.stringify(expected))
		throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

export function ok(value: unknown): asserts value {
	if (!value)
		throw new Error("Expected a truthy value");
}

export function run(): void {
	const failures: string[] = [];
	for (const current of tests) {
		try {
			current.callback();
			console.log(`PASS ${current.name}`);
		}
		catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${current.name}: ${message}`);
			console.error(`FAIL ${current.name}: ${message}`);
		}
	}

	if (failures.length > 0)
		throw new Error(`${failures.length} test(s) failed`);
}
