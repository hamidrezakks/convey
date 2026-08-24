import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['@convey/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '.source': path.resolve(__dirname, '.source'),
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^react$/, (resource) => {
        if (!resource.context.includes('react-shim.js')) {
          resource.request = path.resolve(__dirname, 'src/lib/react-shim.js');
        }
      }),
    );
    return config;
  },
};

export default withMDX(config);
