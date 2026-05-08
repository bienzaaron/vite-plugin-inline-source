import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node22",
	sourcemap: true,
	clean: true,
	dts: true,
	minify: false,
});
