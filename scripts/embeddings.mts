// Embedding CLI. Node 24 runs TypeScript directly; see `npm run embeddings -- help`.
import { runCli } from '../src/services/embeddings/cli.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
