export const envVar = (
	import.meta as unknown as { env: Record<string, string> }
).env.VITE_TEST_VALUE;
