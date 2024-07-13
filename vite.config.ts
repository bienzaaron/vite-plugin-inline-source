/// <reference types="vitest" />

import { defineConfig } from "vite";

export default defineConfig({
	test: {
		reporters: ["default", "json"],
		outputFile: "test-report.json",
		coverage: {
			reporter: ["text", "lcov"],
		},
	},
});
