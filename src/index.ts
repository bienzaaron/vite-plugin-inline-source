import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IndexHtmlTransformContext, Plugin } from "vite";
import { optimize } from "svgo";
import type { TransformPluginContext } from "rollup";
import z from "zod";

const InlineSourceOptionsSchema = z
  .object({
    replaceTags: z
      .array(z.string())
      .default(["svg", "math"])
      .describe(
        "Tags that should be replaced entirely when inlining elements. The default behavior is to preserve the tags and place the content from the source file inside them."
      ),
    optimizeSvgs: z
      .boolean()
      .default(true)
      .describe("Whether or not to optimize SVGs using svgo"),
    svgoOptions: z.object({}).passthrough().default({}),
  })
  .default({});

type InlineSourceOptions = z.input<typeof InlineSourceOptionsSchema>;

const PATTERN =
  /<([A-z0-9-]+)\s+([^>]*?)src\s*=\s*"([^>]*?)"([^>]*?)\s*((\/>)|(>\s*<\/\s*\1\s*>))/gi;

export default function VitePluginInlineSource(
  opts?: InlineSourceOptions
): Plugin {
  const options = InlineSourceOptionsSchema.parse(opts);
  let root = "";

  async function transformHtml(
    source: string,
    ctx: TransformPluginContext | IndexHtmlTransformContext,
    id?: string
  ) {
    if (id && !id.endsWith(".html")) {
      return source;
    }

    const result = [];
    const tokens = source.matchAll(PATTERN);
    let prevPos = 0;
    for (const token of tokens) {
      const [matched, tagName, preAttributes, fileName, postAttributes] = token;
      const { index } = token;
      const isSvgFile = path.extname(fileName).toLowerCase() === ".svg";
      const isImg = tagName.toLowerCase() === "img";
      const shouldInline = /\binline-source\b/.test(
        preAttributes + " " + postAttributes
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
        fileContent = optimize(fileContent, options.svgoOptions).data;
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

      prevPos = index! + matched.length;
    }
    result.push(source.slice(prevPos));
    return result.join("");
  }

  return {
    name: "vite-plugin-inline-source",
    configResolved(config) {
      root = config.root ?? "";
    },
    transform(source, id) {
      return transformHtml(source, this, id);
    },
    transformIndexHtml(source, ctx) {
      return transformHtml(source, ctx);
    },
  };
}
