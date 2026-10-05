import { readFileSync, writeFileSync } from 'node:fs';
import { clusterPurity, clusterVectors, labelClusters } from './cluster.ts';
import { evaluateProvider, parseDataset } from './evaluate.ts';
import { readInputs, withFileCache } from './io.ts';
import { createOllamaGenerator } from './ollama.ts';
import { createProvider, DEFAULT_CLUSTER_THRESHOLD, PROVIDER_FACTORIES, type ProviderSettings } from './registry.ts';
import type { EmbeddingProvider } from './types.ts';

export const USAGE = `Usage: npm run embeddings -- <command> [options]

Commands:
  embed   --input <file> --output <file.jsonl>     Embed texts (.txt/.csv/.json/.jsonl)
  eval    --dataset <file.json> [--k 3] [--min-accuracy 0.85]
                                                  Leave-one-out kNN accuracy; exits 1 below the threshold
  cluster --input <file> [--threshold auto] [--output <file.json>] [--label-model llama3.2]
                                                  Group similar texts; optional Ollama names per group

Options:
  --provider ${Object.keys(PROVIDER_FACTORIES).join('|')}  (default local)
  --ollama-url http://127.0.0.1:11434   --ollama-model nomic-embed-text   --ollama-weight 0.5
  --dimensions 1024   --cache <file.json>`;

export type Options = Record<string, string>;

export const parseArgs = (argv: string[]): { command: string; options: Options } => {
  const [command = 'help', ...rest] = argv;
  const options: Options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (!flag.startsWith('--')) throw new Error(`Unexpected argument "${flag}"`);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2)] = value;
    index += 1;
  }
  return { command, options };
};

const number = (options: Options, name: string, fallback: number): number => {
  const value = options[name] === undefined ? fallback : Number(options[name]);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
};

const required = (options: Options, name: string): string => {
  if (!options[name]) throw new Error(`--${name} is required`);
  return options[name];
};

const providerFor = (options: Options, corpus: string[]): EmbeddingProvider & { save?(): void } => {
  const settings: ProviderSettings = {
    provider: options.provider ?? 'local', dimensions: number(options, 'dimensions', 1024), corpus,
    ollamaUrl: options['ollama-url'], ollamaModel: options['ollama-model'], ollamaWeight: number(options, 'ollama-weight', 0.5),
  };
  const provider = createProvider(settings);
  return options.cache ? withFileCache(provider, options.cache) : provider;
};

const thresholdFor = (options: Options): number => number(options, 'threshold', DEFAULT_CLUSTER_THRESHOLD[options.provider ?? 'local'] ?? 0.5);

/** Runs one command; returns the process exit code. `log` receives human-readable output. */
export const runCli = async (argv: string[], log: (line: string) => void = console.log): Promise<number> => {
  const { command, options } = parseArgs(argv);
  if (command === 'eval') {
    const dataset = parseDataset(JSON.parse(readFileSync(required(options, 'dataset'), 'utf8')));
    const minimum = number(options, 'min-accuracy', 0.85);
    const provider = providerFor(options, dataset.map((item) => item.text));
    const report = await evaluateProvider(provider, dataset, number(options, 'k', 3));
    const purity = clusterPurity(clusterVectors(await provider.embed(dataset.map((item) => item.text)), thresholdFor(options)), dataset.map((item) => item.label));
    log(`${report.provider} (${report.model}) k=${report.k}: ${(report.accuracy * 100).toFixed(1)}% (${report.correct}/${report.total}), target ${(minimum * 100).toFixed(0)}%; cluster purity ${(purity * 100).toFixed(1)}%`);
    for (const [label, bucket] of Object.entries(report.perLabel)) log(`  ${label}: ${(bucket.accuracy * 100).toFixed(0)}%`);
    for (const miss of report.misses.slice(0, 20)) log(`  miss: "${miss.text}" expected ${miss.expected}, got ${miss.predicted}`);
    return report.accuracy >= minimum ? 0 : 1;
  }
  if (command === 'embed' || command === 'cluster') {
    const inputs = readInputs(required(options, 'input'));
    const texts = inputs.map((item) => item.text);
    const provider = providerFor(options, texts);
    const vectors = await provider.embed(texts);
    provider.save?.();
    if (command === 'embed') {
      const output = required(options, 'output');
      writeFileSync(output, inputs.map((item, index) => JSON.stringify({ ...item, provider: provider.id, model: provider.model, vector: Array.from(vectors[index]) })).join('\n') + '\n');
      log(`Embedded ${inputs.length} texts with ${provider.id} (${provider.model}) → ${output}`);
      return 0;
    }
    let clusters = clusterVectors(vectors, thresholdFor(options));
    if (options['label-model']) clusters = await labelClusters(clusters, texts, createOllamaGenerator({ baseUrl: options['ollama-url'], model: options['label-model'] }));
    const groups = clusters.map((cluster, index) => ({ cluster: index + 1, label: cluster.label ?? null, texts: cluster.members.map((member) => texts[member]) }));
    if (options.output) writeFileSync(options.output, JSON.stringify(groups, null, 2));
    for (const group of groups) log(`#${group.cluster}${group.label ? ` ${group.label}` : ''} (${group.texts.length}): ${group.texts.slice(0, 5).join(' | ')}`);
    return 0;
  }
  log(USAGE);
  return command === 'help' ? 0 : 1;
};
