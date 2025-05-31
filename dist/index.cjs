"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => VitePluginInlineSource
});
module.exports = __toCommonJS(index_exports);
var import_promises = require("fs/promises");
var import_node_path = __toESM(require("path"), 1);
var import_csso = require("csso");
var esbuild = __toESM(require("esbuild"), 1);
var sass = __toESM(require("sass"), 1);
var import_svgo = require("svgo");
var import_terser = require("terser");
var import_vite = require("vite");
var import_zod = __toESM(require("zod"), 1);
var { compileString: compileSass } = sass;
var InlineSourceOptionsSchema = import_zod.default.object({
  replaceTags: import_zod.default.array(import_zod.default.string()).default(["svg", "math"]).describe(
    "Tags that should be replaced entirely when inlining elements. The default behavior is to preserve the tags and place the content from the source file inside them."
  ),
  optimizeSvgs: import_zod.default.boolean().default(true).describe("Whether or not to optimize SVGs using svgo"),
  compileSass: import_zod.default.boolean().default(false).describe("Whether or not to compile SASS using sass"),
  optimizeCss: import_zod.default.boolean().default(false).describe("Whether or not to optimize CSS using csso"),
  compileTs: import_zod.default.boolean().default(true).describe(
    "Whether or not to transform TypeScript to JavaScript using esbuild"
  ),
  optimizeJs: import_zod.default.boolean().default(false).describe("Whether or not to optimize JS using terser"),
  svgoOptions: import_zod.default.object({}).passthrough().default({}),
  sassOptions: import_zod.default.object({}).passthrough().default({}),
  cssoOptions: import_zod.default.object({}).passthrough().default({}),
  terserOptions: import_zod.default.object({}).passthrough().default({})
}).default({});
var PATTERN = /<([A-z0-9-]+)\s+([^>]*?)src\s*=\s*"([^>]*?)"([^>]*?)\s*((\/>)|(>\s*<\/\s*\1\s*>))/gi;
function VitePluginInlineSource(opts) {
  const options = InlineSourceOptionsSchema.parse(opts);
  let root = "";
  async function transformHtml(source, ctx) {
    const result = [];
    const tokens = source.matchAll(PATTERN);
    let prevPos = 0;
    for (const token of tokens) {
      const [matched, tagName, preAttributes, fileName, postAttributes] = token;
      const { index } = token;
      const isSvgFile = import_node_path.default.extname(fileName).toLowerCase() === ".svg";
      const isSassFile = import_node_path.default.extname(fileName).toLowerCase() === ".scss";
      const isCssFile = import_node_path.default.extname(fileName).toLowerCase() === ".css";
      const isJsFile = import_node_path.default.extname(fileName).toLowerCase() === ".js";
      const isTsFile = import_node_path.default.extname(fileName).toLowerCase() === ".ts";
      const isImg = tagName.toLowerCase() === "img";
      const shouldInline = /\binline-source\b/.test(
        preAttributes + " " + postAttributes
      );
      if (isImg && !isSvgFile || !shouldInline) {
        continue;
      }
      const filePath = root ? import_node_path.default.join(root, fileName) : fileName;
      let fileContent = ctx.server ? (await (0, import_promises.readFile)(`${filePath}`)).toString() : (
        // @ts-expect-error don't know these types aren't right
        (await ctx.load({ id: `${filePath}?raw` })).ast?.body?.[0].declaration.value
      );
      if (isSvgFile && options.optimizeSvgs) {
        fileContent = (0, import_svgo.optimize)(fileContent, options.svgoOptions).data;
      } else if (isCssFile && options.optimizeCss) {
        const minifiedCode = (0, import_csso.minify)(fileContent, options.cssoOptions).css;
        if (minifiedCode.length === 0 && fileContent.length !== 0) {
          throw new Error("Failed to minify CSS");
        }
        fileContent = minifiedCode;
      } else if (isSassFile && options.compileSass) {
        const css = compileSass(fileContent, options.sassOptions).css;
        fileContent = options.optimizeCss ? (0, import_csso.minify)(css, options.cssoOptions).css : css;
      } else if (isJsFile && options.optimizeJs) {
        const minifiedCode = (await (0, import_terser.minify)(fileContent, options.terserOptions)).code;
        if (minifiedCode) {
          fileContent = minifiedCode;
        }
      } else if (isTsFile && options.compileTs) {
        console.log(filePath, process.env);
        const envVars = (0, import_vite.loadEnv)(env.mode, process.cwd());
        const envVarDefines = Object.entries(envVars).reduce((prev, [key, value]) => {
          if (key.startsWith("VITE")) prev[`import.meta.env.${key}`] = value;
          return prev;
        }, {});
        const transformResult = await esbuild.build({
          entryPoints: [filePath],
          write: false,
          define: {
            "import.meta.env.MODE": `"${env.mode}"`,
            "import.meta.env.BASE_URL": `"${config.base ?? "/"}"`,
            "import.meta.env.PROD": `${process.env.NODE_ENV == "production"}`,
            "import.meta.env.DEV": `${process.env.NODE_ENV != "production"}`,
            "import.meta.env.SSR": `${env.isSsrBuild}`,
            ...envVarDefines
          }
        });
        if (transformResult.errors.length != 0) {
          console.error(transformResult);
          throw new Error(transformResult.errors.join("\n"));
        } else {
          console.log(transformResult.outputFiles[0].text);
          fileContent = transformResult.outputFiles[0].text;
        }
        if (options.optimizeJs) {
          const minifiedCode = (await (0, import_terser.minify)(fileContent, options.terserOptions)).code;
          if (minifiedCode) {
            fileContent = minifiedCode;
          } else {
            throw new Error("Unexpected error: Failed to minify JS");
          }
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
              ""
            )} ${postAttributes.replace(/inline-source/g, "")}`
          )
        );
      } else {
        result.push(
          `<${tagName}
            ${preAttributes.replace(
            /inline-source/g,
            ""
          )} ${postAttributes.replace(/inline-source/g, "")}
          >${fileContent}</${tagName}>`
        );
      }
      prevPos = index + matched.length;
    }
    result.push(source.slice(prevPos));
    return result.join("");
  }
  let env;
  let config;
  return {
    name: "vite-plugin-inline-source",
    configResolved(config2) {
      root = config2.root ?? "";
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
    }
  };
}
//# sourceMappingURL=index.cjs.map