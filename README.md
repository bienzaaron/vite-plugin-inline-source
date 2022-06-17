# vite-plugin-inline-source

![ci](https://github.com/bienzaaron/vite-plugin-inline-source/actions/workflows/ci/badge.svg)
![npm version](https://img.shields.io/npm/v/vite-plugin-inline-source.svg?style=flat)


A Vite plugin which inlines source files in HTML files where the `inline-source` attribute is present. This is similar in premise to [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile), but allows you to control which assets are inlined.

## Example Usage

**vite.config.ts**
```typescript
import { defineConfig } from "vite";
import inlineSource from "vite-plugin-inline-source";

export default defineConfig({
  plugins: [
    inlineSource(),
  ],
});
```

**style.css**
```css
body {
  background-color: red;
}
```

**index.html**
```html
<html>
  <style inline-source src="style.css" />
</html>
```

**Resulting index.html after build**
<html>
  <style inline-source>body {
  background-color: red;
}
  </style>
</html>

## Options

### replaceTags

Tags that should be replaced in the HTML file.

For example, `style` and `script` tags are not replaced by default because the corresponding css/js file would not contain the `style` or `script` tag. However, with `svg` tags, the corresponding svg file would contain the `svg` tag, so the `svg` tags in the HTML file are replaced. See the unit tests for more explicit examples.

- **type**: `string[]`
- **default**: `['svg', 'math']`

### optimizeSvgs

Whether or not to optimize SVGs using [svgo](https://github.com/svg/svgo).

- **type**: `boolean`
- **default**: `true`

### svgoOptions

Options to pass to [svgo](https://github.com/svg/svgo). Only used if `optimizeSvgs` is `true`.

- **type**: `OptimizeOptions`
- **default**: `{}`
