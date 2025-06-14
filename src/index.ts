import { readFile } from "node:fs/promises";
import path from "node:path";
import { minify as minifyCss } from "csso";
import * as esbuild from "esbuild";
import type { TransformPluginContext } from "rollup";
import * as sass from "sass";
import { optimize as optimizeSvg } from "svgo";
import { minify as minifyJs } from "terser";
import {
	type ConfigEnv,
	type IndexHtmlTransformContext,
	type Plugin,
	type UserConfig,
	loadEnv,
} from "vite";
import z from "zod";
const { compileString: compileSass } = sass;

const InlineSourceOptionsSchema = z
	.object({
		replaceTags: z
			.array(z.string())
			.default(["svg", "math"])
			.describe(
				"Tags that should be replaced entirely when inlining elements. The default behavior is to preserve the tags and place the content from the source file inside them.",
			),
		optimizeSvgs: z
			.boolean()
			.default(true)
			.describe("Whether or not to optimize SVGs using svgo"),
		compileSass: z
			.boolean()
			.default(false)
			.describe("Whether or not to compile SASS using sass"),
		optimizeCss: z
			.boolean()
			.default(false)
			.describe("Whether or not to optimize CSS using csso"),
		compileTs: z
			.boolean()
			.default(true)
			.describe(
				"Whether or not to transform TypeScript to JavaScript using esbuild",
			),
		optimizeJs: z
			.boolean()
			.default(false)
			.describe("Whether or not to optimize JS using terser"),
		svgoOptions: z.object({}).passthrough().default({}),
		sassOptions: z.object({}).passthrough().default({}),
		cssoOptions: z.object({}).passthrough().default({}),
		terserOptions: z.object({}).passthrough().default({}),
	})
	.default({});

type InlineSourceOptions = z.input<typeof InlineSourceOptionsSchema>;

const PATTERN =
	/<([A-z0-9-]+)\s+([^>]*?)src\s*=\s*"([^>]*?)"([^>]*?)\s*((\/>)|(>\s*<\/\s*\1\s*>))/gi;

export default function VitePluginInlineSource(
	opts?: InlineSourceOptions,
): Plugin {
	const options = InlineSourceOptionsSchema.parse(opts);
	let root = "";

	async function transformHtml(
		source: string,
		ctx: TransformPluginContext | IndexHtmlTransformContext,
	) {
		const result = [];
		const tokens = source.matchAll(PATTERN);
		let prevPos = 0;
		for (const token of tokens) {
			const [matched, tagName, preAttributes, fileName, postAttributes] = token;
			const { index } = token;
			const isSvgFile = path.extname(fileName).toLowerCase() === ".svg";
			const isSassFile = path.extname(fileName).toLowerCase() === ".scss";
			const isCssFile = path.extname(fileName).toLowerCase() === ".css";
			const isJsFile = path.extname(fileName).toLowerCase() === ".js";
			const isTsFile = path.extname(fileName).toLowerCase() === ".ts";
			const isImg = tagName.toLowerCase() === "img";
			const shouldInline = /\binline-source\b/.test(
				preAttributes + " " + postAttributes,
			);

			if ((isImg && !isSvgFile) || !shouldInline) {
				continue;
			}

			const filePath = root ? path.join(root, fileName) : fileName;

			let fileContent: string = (ctx as IndexHtmlTransformContext).server
				? (await readFile(`${filePath}`)).toString()
				: // @ts-expect-error don't know these types aren't right
					(await ctx.load({ id: `${filePath}?raw` })).ast?.body?.[0].declaration
						.value;
			if (isSvgFile && options.optimizeSvgs) {
				fileContent = optimizeSvg(fileContent, options.svgoOptions).data;
			} else if (isCssFile && options.optimizeCss) {
				const minifiedCode = minifyCss(fileContent, options.cssoOptions).css;
				if (minifiedCode.length === 0 && fileContent.length !== 0) {
					throw new Error("Failed to minify CSS");
				}
				fileContent = minifiedCode;
			} else if (isSassFile && options.compileSass) {
				const css = compileSass(fileContent, options.sassOptions).css;
				fileContent = options.optimizeCss
					? minifyCss(css, options.cssoOptions).css
					: css;
			} else if (isJsFile && options.optimizeJs) {
				const minifiedCode = (
					await minifyJs(fileContent, options.terserOptions)
				).code;
				if (minifiedCode) {
					fileContent = minifiedCode;
				}
			} else if (isTsFile && options.compileTs) {
				try {
					const envVars = loadEnv(env.mode, process.cwd());
					const envVarDefines = Object.entries(envVars).reduce<
						Record<string, string>
					>((prev, [key, value]) => {
						if (key.startsWith("VITE")) prev[`import.meta.env.${key}`] = value;
						return prev;
					}, {});

					const transformResult = await esbuild.transform(fileContent, {
						loader: "ts",
						define: {
							"import.meta.env.MODE": `"${env.mode}"`,
							"import.meta.env.BASE_URL": `"${config.base ?? "/"}"`,
							"import.meta.env.PROD": `${process.env.NODE_ENV == "production"}`,
							"import.meta.env.DEV": `${process.env.NODE_ENV != "production"}`,
							"import.meta.env.SSR": `${env.isSsrBuild}`,
							...envVarDefines,
						},
					});

					fileContent = transformResult.code;

					if (options.optimizeJs) {
						try {
							const minifiedResult = await minifyJs(
								fileContent,
								options.terserOptions,
							);
							if (minifiedResult.code) {
								fileContent = minifiedResult.code;
							}
							// If minification returns empty/undefined, keep the original compiled code
						} catch (error) {
							console.warn("Failed to minify compiled TypeScript:", error);
							// Keep the original compiled code if minification fails
						}
					}
				} catch (error) {
					console.error("Failed to compile TypeScript:", error);
					throw error;
				}
			}
			fileContent = fileContent.replace(/^<!DOCTYPE(.*?[^?])?>/, "");

			if (index !== prevPos) {
				result.push(source.slice(prevPos, index));
			}
			if (options.replaceTags.includes(tagName)) {
				result.push(
					fileContent.replace(
						new RegExp(`^<\\s*${tagName}`),
						`<${tagName} ${preAttributes.replace(
							/inline-source/g,
							"",
						)} ${postAttributes.replace(/inline-source/g, "")}`,
					),
				);
			} else {
				result.push(
					`<${tagName}
            ${preAttributes.replace(
							/inline-source/g,
							"",
						)} ${postAttributes.replace(/inline-source/g, "")}
          >${fileContent}</${tagName}>`,
				);
			}

			prevPos = index! + matched.length;
		}
		result.push(source.slice(prevPos));
		return result.join("");
	}

	let env: ConfigEnv;
	let config: UserConfig;

	return {
		name: "vite-plugin-inline-source",
		configResolved(config) {
			root = config.root ?? "";
		},
		config(c, e) {
			config = c;
			env = e;
		},
		transform(source, id) {
			if (id && !id.endsWith(".html")) {
				return null;
			}

			return transformHtml(source, this);
		},
		transformIndexHtml(source, ctx) {
			return transformHtml(source, ctx);
		},
	};
}
