/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    // React Compiler 1.0 (stable, Babel build): automatic memoization for the UI (ADR-029).
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Groups capture their dependencies recursively, so the React runtime (which R3F depends
          // on) must win by priority, or it lands in `three` and every page downloads the 3D stack.
          groups: [
            {
              name: 'react',
              priority: 20,
              test: /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store|zustand)[\\/]/,
            },
            // The 3D stack is only loaded by routes that render a scene.
            {
              name: 'three',
              priority: 10,
              test: /node_modules[\\/](three|@react-three|postprocessing|n8ao|three-stdlib|three-mesh-bvh|troika-[^\\/]+|camera-controls|maath|meshline|stats-gl|@monogrid)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
