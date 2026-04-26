/// <reference types="vitest/config" />

import * as vite from 'vite';

export default vite.defineConfig({
    build: {
        minify: false,
        rollupOptions: {
            input: 'src/main.ts',
            output: {
                dir: './files/auto-dark-light@gihaume/5.8',
                entryFileNames: 'applet.js'
            }
        },
        emptyOutDir: false,
    },
    plugins: [{
        name: 'remove-globalThis-injection-line',
        generateBundle(_, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type !== 'chunk')
                    continue;
                const lines = output.code.split('\n');
                lines.splice(lines.length - 2, 1); // Removes the second-to-last line
                output.code = lines.join('\n')
            }
        }
    }],
    test: {}, // To be filled with Vitest options when needed
});
