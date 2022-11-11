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
        "Tags that should be replaced entirely when inlining elements. The default behavior is to"
      ),
    optimizeSvgs: z
      .boolean()
      .default(true)
      .describe("Whether or not to optimize SVGs using svgo"),
    svgoOptions: z.object({}).passthrough().default({}),
  })
  .default({});

type InlineSourceOptions = z.input<typeof InlineSourceOptionsSchema>;
type ParsedInlineSourceOptions = z.output<typeof InlineSourceOptionsSchema>;

const PATTERN = /<([A-z0-9-]+)\s+([^>]*?)src\s*=\s*"([^>]*?)"([^>]*?)\s*\/>/gi;
const getTransformFunction =
  (options: ParsedInlineSourceOptions) =>
  async (
    source: string,
    ctx: TransformPluginContext | IndexHtmlTransformContext,
    id?: string
  ) => {
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

      let fileContent: string = (ctx as IndexHtmlTransformContext).server
        ? await readFile(
            `${
              (ctx as IndexHtmlTransformContext).server!.config.root
            }/${fileName}`
          )
        : // @ts-expect-error don't know these types aren't right
          (await ctx.load({ id: `${fileName}?raw` })).ast?.body?.[0].declaration
            .value;
      if (isSvgFile && options.optimizeSvgs) {
        fileContent = optimize(fileContent, options.svgoOptions).data;
      }

      fileContent = fileContent.replace(/^<!DOCTYPE(.*?[^?])?>/, "");

      if (index !== prevPos) {
        result.push(source.slice(prevPos, index));
      }
      if (options.replaceTags.includes(tagName)) {
        result.push(fileContent);
      } else {
        result.push(
          `<${tagName} ${preAttributes} ${postAttributes}>${fileContent}</${tagName}>`
        );
      }

      prevPos = index! + matched.length;
    }
    result.push(source.slice(prevPos));
    return result.join("");
  };

export default function VitePluginInlineSource(
  opts: InlineSourceOptions
): Plugin {
  const transformHtml = getTransformFunction(
    InlineSourceOptionsSchema.parse(opts)
  );
  return {
    name: "vite-plugin-inline-source",
    transform(source, id) {
      return transformHtml(source, this, id);
    },
    transformIndexHtml(source, ctx) {
      return transformHtml(source, ctx);
    },
  };
}
