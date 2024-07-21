import type { BinaryLike, BinaryToTextEncoding } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { PluginContext } from "rollup";
import type {
	ConfigEnv,
	IndexHtmlTransformContext,
	Plugin,
	ResolvedConfig,
	UserConfig,
} from "vite";
import * as vite from "vite";
import { describe, expect, test, vi } from "vitest";
import inlineSource from "../index.js";

const require = createRequire(import.meta.url);
type CryptoModuleWithHash = typeof import("node:crypto") & {
	hash?: (
		algorithm: string,
		data: BinaryLike,
		encoding: BinaryToTextEncoding,
	) => string;
};
const cryptoPolyfill = require("crypto") as CryptoModuleWithHash;
if (typeof cryptoPolyfill.hash !== "function") {
	const hashPolyfill = (
		algorithm: string,
		data: BinaryLike,
		encoding: BinaryToTextEncoding,
	): string => {
		const hash = cryptoPolyfill.createHash(algorithm);
		hash.update(data);
		return hash.digest(encoding);
	};
	cryptoPolyfill.hash = hashPolyfill;
}

const build: typeof vite.build = async (...args) => {
	const out = await vite.build(...args);
	if (Array.isArray(out)) {
		for (const o of out.flatMap((o) => o.output)) {
			delete (o as { originalFileName?: string }).originalFileName;
			delete (o as { originalFileNames?: string[] }).originalFileNames;
			delete (o as { names?: string[] }).names;
		}
	} else if ("output" in out) {
		for (const o of out.output) {
			if ("originalFileName" in o) {
				delete (o as { originalFileName?: string }).originalFileName;
				delete (o as { originalFileNames?: string[] }).originalFileNames;
				delete (o as { names?: string[] }).names;
			}
		}
	}
	return out;
};

const emitTestAssetPlugin = (fileName: string, source: string): Plugin => ({
	name: "test-asset-plugin",
	enforce: "pre",
	buildStart() {
		this.emitFile({
			type: "asset",
			name: fileName,
			fileName,
			source,
		});
	},
	load(id) {
		if (id.split("?")[0].endsWith(fileName)) {
			return `export default '${source}'`;
		}
	},
});

const replaceIndexHtmlPlugin = (source: string): Plugin => ({
	name: "replace-index-html-plugin",
	transform: (_, id) => (id.endsWith("index.html") ? source : null),
});

test("handles custom attribute and defaults to 'inline-source'", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin("style.css", "body { background-color: red; }"),
			replaceIndexHtmlPlugin(
				'<html><style custom-inline-attribute i-should-be-preserved src="style.css" ></ style ></html>',
			),
			inlineSource({
				customAttribute: "custom-inline-attribute",
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("it then inlines css and preserves style tags", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin("style.css", "body { background-color: red; }"),
			replaceIndexHtmlPlugin(
				'<html><style inline-source i-should-be-preserved src="style.css" ></ style ></html>',
			),
			inlineSource({
				optimizeSvgs: false,
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("it works without any options", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin("style.css", "body { background-color: red; }"),
			replaceIndexHtmlPlugin(
				'<html><style inline-source i-should-be-preserved src="style.css" ></ style ></html>',
			),
			inlineSource(),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("it then doesn't mess with tags it shouldn't mess with", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin("style.css", "body { background-color: red; }"),
			replaceIndexHtmlPlugin(
				'<html><style inline-source i-should-be-preserved src="style.css" /><img src="lalala.png"/></html>',
			),
			inlineSource({
				optimizeSvgs: false,
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("it then inlines svg", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin(
				"i-am-an-svg.svg",
				'<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
			),
			replaceIndexHtmlPlugin(
				'<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>',
			),
			inlineSource({
				optimizeSvgs: false,
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("it then optimizes svg with default options", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin(
				"i-am-an-svg.svg",
				'<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
			),
			replaceIndexHtmlPlugin(
				'<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>',
			),
			inlineSource({}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

test("fails gracefully when svg optimization fails", () => {
	expect(async () => {
		await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(
					"i-am-an-svg.svg",
					'<svg viewBox="0 0 100 100"><not a valid svg></svg>',
				),
				replaceIndexHtmlPlugin(
					'<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>',
				),
				inlineSource({}),
			],
		});
	}).rejects.toThrowError("Attribute without value");
});

test("it then optimizes svg with custom options", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin(
				"i-am-an-svg.svg",
				'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 100 100"><title>hello</title><rect width="100" height="100"/></svg>',
			),
			replaceIndexHtmlPlugin(
				'<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>',
			),
			inlineSource({
				svgoOptions: {
					plugins: [
						{
							name: "preset-default",
							params: {
								overrides: {
									removeDoctype: false,
								},
							},
						},
					],
				},
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});

describe("css", () => {
	const cssFileName = "style.css";
	const cssContent =
		// language=css
		"/*! foo */ body { background-color: #ff0000; } /* bar */ h1 { color: crimson; font-size: 28px; }";

	test("it then NOT minifies css with default options", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(cssFileName, cssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${cssFileName}" /></html>`,
				),
				inlineSource(),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it then minifies css with optimizeCss enabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(cssFileName, cssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${cssFileName}" /></html>`,
				),
				inlineSource({
					optimizeCss: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it then minifies css with optimizeCss enabled, respecting cssoOptions", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(cssFileName, cssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${cssFileName}" /></html>`,
				),
				inlineSource({
					optimizeCss: true,
					cssoOptions: {
						comments: false,
					},
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("fails gracefully with empty content", async () => {
		(
			await expect(async () => {
				await build({
					root: __dirname,
					plugins: [
						emitTestAssetPlugin(cssFileName, " "),
						replaceIndexHtmlPlugin(
							`<html><style inline-source i-should-be-preserved src="${cssFileName}" /></html>`,
						),
						inlineSource({
							optimizeCss: true,
						}),
					],
				});
			})
		).rejects.toThrowError("Failed to minify CSS");
	});

	test("fails gracefully when css minification fails", () => {
		expect(async () => {
			await build({
				root: __dirname,
				plugins: [
					emitTestAssetPlugin(cssFileName, "not a valid css"),
					replaceIndexHtmlPlugin(
						`<html><style inline-source i-should-be-preserved src="${cssFileName}" /></html>`,
					),
					inlineSource({
						optimizeCss: true,
					}),
				],
			});
		}).rejects.toThrowError("Failed to minify CSS");
	});
});

describe("scss", () => {
	const scssFileName = "style.scss";
	const scssContent =
		// language=scss
		"$color: #ff0000; /*! foo */ body { background-color: $color; }";

	test("it compile scss when compileScss option enabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(scssFileName, scssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${scssFileName}" /></html>`,
				),
				inlineSource({
					compileSass: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it compile scss and minify it when compileScss and optimizeCss options enabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(scssFileName, scssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${scssFileName}" /></html>`,
				),
				inlineSource({
					compileSass: true,
					optimizeCss: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it compile scss and minify it when compileScss and optimizeCss options enabled; with empty content", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(scssFileName, "$foo: 0;"),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${scssFileName}" /></html>`,
				),
				inlineSource({
					compileSass: true,
					optimizeCss: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it NOT compile scss with default options", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(scssFileName, scssContent),
				replaceIndexHtmlPlugin(
					`<html><style inline-source i-should-be-preserved src="${scssFileName}" /></html>`,
				),
				inlineSource(),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});
});

describe("js", () => {
	const jsFileName = "script.js";
	const jsContent =
		// language=js
		'/* foo */ const u = undefined;const foo = 123;const bar = 256;const baz = typeof u !== "undefined" ? foo : bar;';

	test("it then NOT minifies js with default options", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(jsFileName, jsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${jsFileName}" /></html>`,
				),
				inlineSource(),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it then minifies js with optimizeJs enabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(jsFileName, jsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${jsFileName}" /></html>`,
				),
				inlineSource({
					optimizeJs: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("it then minifies js with optimizeJs enabled, respecting terserOptions", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(jsFileName, jsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${jsFileName}" /></html>`,
				),
				inlineSource({
					optimizeJs: true,
					terserOptions: {
						compress: {
							join_vars: false,
						},
					},
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("fails gracefully when js minification fails", () => {
		expect(async () => {
			await build({
				root: __dirname,
				plugins: [
					emitTestAssetPlugin(jsFileName, "not a valid js"),
					replaceIndexHtmlPlugin(
						`<html><script inline-source i-should-be-preserved src="${jsFileName}" /></html>`,
					),
					inlineSource({
						optimizeJs: true,
					}),
				],
			});
		}).rejects.toThrowError("Unexpected token: name (a)");
	});
});

describe("ts", () => {
	const tsFileName = "script.ts";
	const tsContent =
		// language=ts
		'/* foo */ const u = undefined;const foo: number = 123;const bar: number = 256;const baz = typeof u !== "undefined" ? foo : bar;';

	test("compiles ts by default", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(tsFileName, tsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${tsFileName}" /></html>`,
				),
				inlineSource(),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("does not compile ts when compileTs option is disabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(tsFileName, tsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${tsFileName}" /></html>`,
				),
				inlineSource({
					compileTs: false,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("does not minify compiled ts by default", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(tsFileName, tsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${tsFileName}" /></html>`,
				),
				inlineSource({
					compileTs: true,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("does not minify compiled ts when optimizeJs option is disabled", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(tsFileName, tsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${tsFileName}" /></html>`,
				),
				inlineSource({
					compileTs: true,
					optimizeJs: false,
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});

	test("minifies compiled ts when optimizeJs option is enabled, respecting terserOptions", async () => {
		const buildOutput = await build({
			root: __dirname,
			plugins: [
				emitTestAssetPlugin(tsFileName, tsContent),
				replaceIndexHtmlPlugin(
					`<html><script inline-source i-should-be-preserved src="${tsFileName}" /></html>`,
				),
				inlineSource({
					compileTs: true,
					optimizeJs: true,
					terserOptions: {
						compress: {
							join_vars: false,
						},
					},
				}),
			],
		});
		expect(buildOutput).toMatchSnapshot();
	});
});

describe("direct transform usage", () => {
	const baseEnv: ConfigEnv = {
		command: "build",
		mode: "test-mode",
		isSsrBuild: false,
	};

	const runTransform = async (
		html: string,
		options?: Parameters<typeof inlineSource>[0],
	) => {
		const plugin = inlineSource(options);
		const pluginContext = {} as PluginContext;
		const userConfig = {} as UserConfig;
		if (typeof plugin.config === "function") {
			plugin.config.call(pluginContext, userConfig, baseEnv);
		} else if (plugin.config?.handler) {
			plugin.config.handler.call(pluginContext, userConfig, baseEnv);
		}

		const resolvedConfig = {
			root: __dirname,
			base: "/",
		} as ResolvedConfig;
		if (typeof plugin.configResolved === "function") {
			plugin.configResolved.call(pluginContext, resolvedConfig);
		} else if (plugin.configResolved?.handler) {
			plugin.configResolved.handler.call(pluginContext, resolvedConfig);
		}

		const transformContext = {
			server: {} as Record<string, unknown>,
		} as IndexHtmlTransformContext;
		const result =
			typeof plugin.transformIndexHtml === "function"
				? await plugin.transformIndexHtml.call(
						pluginContext,
						html,
						transformContext,
					)
				: plugin.transformIndexHtml?.handler?.call(
						pluginContext,
						html,
						transformContext,
					);
		if (typeof result !== "string") {
			throw new Error("Expected HTML string from transform");
		}
		return result;
	};

	test("reads assets from disk when dev server context is provided", async () => {
		const result = await runTransform(
			'<html><style inline-source src="fixtures/style-dev.css"></style></html>',
		);
		expect(result).toContain("background-color: teal;");
	});

	test("injects VITE env variables during TypeScript compilation", async () => {
		const result = await runTransform(
			'<html><script inline-source src="fixtures/env-script.ts"></script></html>',
			{
				compileTs: true,
			},
		);
		expect(result).toContain('const envVar = "from-env";');
	});

	test("warns but keeps code when terser fails to minify compiled TypeScript", async () => {
		const consoleSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		try {
			const result = await runTransform(
				'<html><script inline-source src="fixtures/env-script.ts"></script></html>',
				{
					compileTs: true,
					optimizeJs: true,
					terserOptions: {
						compress: "invalid" as never,
					},
				},
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to minify compiled TypeScript:",
				expect.objectContaining({
					message: expect.stringContaining("not a supported option"),
				}),
			);
			expect(result).toContain('const envVar = "from-env";');
		} finally {
			consoleSpy.mockRestore();
		}
	});

	test("rethrows errors when TypeScript compilation fails", async () => {
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const badScriptPath = path.join(
			__dirname,
			"fixtures",
			"temp-bad-script.ts",
		);
		const badScriptSrc = `fixtures/${path.basename(badScriptPath)}`;
		await writeFile(
			badScriptPath,
			"// invalid on purpose for error handling test\nexport const broken = <missing>;",
		);
		try {
			await expect(
				runTransform(
					`<html><script inline-source src="${badScriptSrc}"></script></html>`,
					{
						compileTs: true,
					},
				),
			).rejects.toThrowError();
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to compile TypeScript:",
				expect.any(Error),
			);
		} finally {
			await unlink(badScriptPath).catch(() => undefined);
			consoleSpy.mockRestore();
		}
	});
});

test("custom replaceTags", async () => {
	const buildOutput = await build({
		root: __dirname,
		plugins: [
			emitTestAssetPlugin("abc.html", "<div></div>"),
			replaceIndexHtmlPlugin(
				'<html><foo inline-source i-should-be-preserved src="abc.html" /></html>',
			),
			inlineSource({
				replaceTags: ["foo"],
			}),
		],
	});
	expect(buildOutput).toMatchSnapshot();
});
