/// <reference types="vitest/config" />

import * as child_process from 'child_process';
import * as vite from 'vite';

export default vite.defineConfig(({ command, mode }) => {
    const env = vite.loadEnv(mode, process.cwd(), 'VITE_');
    const out_dir_path = './files/auto-dark-light@gihaume/5.8';
    const out_file_name = 'applet.js';

    const config: vite.UserConfig = {
        build: {
            minify: false,
            rollupOptions: {
                input: 'src/main.ts',
                output: {
                    dir: out_dir_path,
                    entryFileNames: out_file_name
                }
            },
            emptyOutDir: false,
        },
        plugins: [], // To be filled below
        test: {}, // To be filled with Vitest options when needed
    };
    if (mode === 'final') {
        config.build!.minify = 'terser';
        config.build!.terserOptions = {
            keep_fnames: /^main$|^_$/
        };
        config.plugins!.push({
            name: 'remove-globalThis-injection',
            generateBundle(_, bundle) {
                for (const output of Object.values(bundle)) {
                    if (output.type !== 'chunk')
                        continue;
                    const sentinel = env.VITE_KEEP_MAIN_FUNCTION_SENTINEL;
                    const pattern = new RegExp(
                        `globalThis\.${sentinel}=(.*);`, 's'
                    );
                    output.code = output.code.replace(pattern, '$1');
                }
            }
        });
        config.plugins!.push({
            name: 'add-checksum-on-build',
            writeBundle() {
                child_process.execSync(
                    `cd ${out_dir_path} && sha256sum ${out_file_name} > ${out_file_name}.sha256sum`
                );
            }
        });
    }
    else
        config.plugins!.push({
            name: 'remove-checksum-on-dev-build',
            writeBundle() {
                child_process.execSync(
                    `rm -f ${out_dir_path}/${out_file_name}.sha256sum`
                );
            }
        });
    return config;
});
