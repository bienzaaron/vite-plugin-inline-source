import { defineConfig } from "tsup";

export default defineConfig({
	format: ["cjs", "esm"],
	target: "node18",
	sourcemap: true,
	clean: true,
	minify: false,
	shims: true,
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
	entry: ["src/index.ts"],
});
