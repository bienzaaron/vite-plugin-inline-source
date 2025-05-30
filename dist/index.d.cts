import { Plugin } from 'vite';
import z from 'zod';

declare const InlineSourceOptionsSchema: z.ZodDefault<z.ZodObject<{
    replaceTags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    optimizeSvgs: z.ZodDefault<z.ZodBoolean>;
    compileSass: z.ZodDefault<z.ZodBoolean>;
    optimizeCss: z.ZodDefault<z.ZodBoolean>;
    compileTs: z.ZodDefault<z.ZodBoolean>;
    optimizeJs: z.ZodDefault<z.ZodBoolean>;
    svgoOptions: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    sassOptions: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    cssoOptions: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    terserOptions: z.ZodDefault<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
}, "strip", z.ZodTypeAny, {
    replaceTags: string[];
    optimizeSvgs: boolean;
    compileSass: boolean;
    optimizeCss: boolean;
    compileTs: boolean;
    optimizeJs: boolean;
    svgoOptions: {} & {
        [k: string]: unknown;
    };
    sassOptions: {} & {
        [k: string]: unknown;
    };
    cssoOptions: {} & {
        [k: string]: unknown;
    };
    terserOptions: {} & {
        [k: string]: unknown;
    };
}, {
    replaceTags?: string[] | undefined;
    optimizeSvgs?: boolean | undefined;
    compileSass?: boolean | undefined;
    optimizeCss?: boolean | undefined;
    compileTs?: boolean | undefined;
    optimizeJs?: boolean | undefined;
    svgoOptions?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    sassOptions?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    cssoOptions?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    terserOptions?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
}>>;
type InlineSourceOptions = z.input<typeof InlineSourceOptionsSchema>;
declare function VitePluginInlineSource(opts?: InlineSourceOptions): Plugin;

export { VitePluginInlineSource as default };
