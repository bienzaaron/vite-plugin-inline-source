import type { Plugin } from "vite";
import { test, expect } from "vitest";
import { build } from "vite";
import inlineSource from "../index.js";

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

test("it then inlines css and preserves style tags", async () => {
  const buildOutput = await build({
    root: __dirname,
    plugins: [
      emitTestAssetPlugin("style.css", "body { background-color: red; }"),
      replaceIndexHtmlPlugin(
        '<html><style inline-source i-should-be-preserved src="style.css" ></ style ></html>'
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
        '<html><style inline-source i-should-be-preserved src="style.css" ></ style ></html>'
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
        '<html><style inline-source i-should-be-preserved src="style.css" /><img src="lalala.png"/></html>'
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
        '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'
      ),
      replaceIndexHtmlPlugin(
        '<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>'
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
        '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'
      ),
      replaceIndexHtmlPlugin(
        '<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>'
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
          '<svg viewBox="0 0 100 100"><not a valid svg></svg>'
        ),
        replaceIndexHtmlPlugin(
          '<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>'
        ),
        inlineSource({}),
      ],
    });
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    '"<input>:1:35: Attribute without value"'
  );
});

test("it then optimizes svg with custom options", async () => {
  const buildOutput = await build({
    root: __dirname,
    plugins: [
      emitTestAssetPlugin(
        "i-am-an-svg.svg",
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 100 100"><title>hello</title><rect width="100" height="100"/></svg>'
      ),
      replaceIndexHtmlPlugin(
        '<html><svg inline-source i-should-be-preserved src="i-am-an-svg.svg" /></html>'
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

test("custom replaceTags", async () => {
  const buildOutput = await build({
    root: __dirname,
    plugins: [
      emitTestAssetPlugin("abc.html", "<div></div>"),
      replaceIndexHtmlPlugin(
        '<html><foo inline-source i-should-be-preserved src="abc.html" /></html>'
      ),
      inlineSource({
        replaceTags: ["foo"],
      }),
    ],
  });
  expect(buildOutput).toMatchSnapshot();
});
