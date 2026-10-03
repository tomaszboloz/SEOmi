import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps strict static analysis, full coverage reporting and both macOS architectures in CI', () => {
  const tests = readFileSync('.github/workflows/test.yml', 'utf8');
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  expect(tests).toContain('cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings');
  expect(tests).toContain('npm run lint');
  expect(tests).toContain('cargo llvm-cov --manifest-path src-tauri/Cargo.toml --lcov');
  expect(tests).toContain('npm run test:coverage');
  expect(release).not.toContain('macos-13');
  expect(release).toContain("platform: 'macos-15-intel'");
  expect(release).toContain("args: '--target x86_64-apple-darwin'");
  expect(release).toContain("args: '--target aarch64-apple-darwin'");
});
