import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function patchDir(dir: string) {
  try {
    for (const item of readdirSync(dir)) {
      const fullPath = join(dir, item);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          patchDir(fullPath);
        } else if (
          fullPath.includes('@elysia/openapi') &&
          (fullPath.endsWith('gen/index.mjs') || fullPath.endsWith('gen/index.js'))
        ) {
          let content = readFileSync(fullPath, 'utf-8');
          if (content.includes('../node_modules/typebox')) {
            content = content
              .replace(
                /import\s*\{\s*Script\s*\}\s*from\s*['"]\.\.\/node_modules\/typebox\/[^'"]+['"];?/g,
                'import { Script } from "typebox/type";',
              )
              .replace(/import\s*['"]\.\.\/node_modules\/typebox\/[^'"]+['"];?/g, 'import "typebox/type";')
              .replace(/require\(['"]\.\.\/node_modules\/typebox\/[^'"]+['"]\)/g, 'require("typebox/type")');
            writeFileSync(fullPath, content, 'utf-8');
            console.log(`[Patch] Fixed ${fullPath}`);
          }
        }
      } catch {}
    }
  } catch {}
}

patchDir(join(import.meta.dirname, '../node_modules'));
