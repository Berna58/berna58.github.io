import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Testes contra uma instância real do Supabase (local ou staging): npm run test:db
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/db/**/*.test.ts'], testTimeout: 20000 },
});
