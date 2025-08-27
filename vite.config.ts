/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		reporters: ["default", "json"],
		outputFile: "test-report.json",
		include: ["src/**/*.spec.ts"],
		coverage: {
			include: ["src/**/*.ts"],
			reporter: ["text", "lcov"],
		},
	},
});
