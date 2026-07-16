/*
 * @Author: PengChaoQun 1152684231@qq.com
 * @Date: 2026-07-14 12:24:37
 * @LastEditors: PengChaoQun 1152684231@qq.com
 * @LastEditTime: 2026-07-14 15:13:49
 * @FilePath: /go-go-go/vite/config.dev.mjs
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
    },
    server: {
        port: 8422,
    },
});
