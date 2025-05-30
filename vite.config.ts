/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		reporters: ["default", "json"],
		outputFile: "test-report.json",
		coverage: {
			reporter: ["text", "lcov"],
		},
	},
});
