import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = process.cwd();
const sourceRoots = ['app', '__tests__', 'components', 'hooks', 'lib', 'domains'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);

const errors = [];
const warnings = [];

function toPosix(path) {
  return path.split(sep).join('/');
}

function extensionOf(path) {
  const match = path.match(/\.[^.\/]+$/u);
  return match?.[0] ?? '';
}

function collectSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const absolute = resolve(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(absolute));
    } else if (sourceExtensions.has(extensionOf(entry))) {
      files.push(absolute);
    }
  }
  return files;
}

function extractImports(source) {
  const imports = [];
  const staticPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gu;
  const dynamicPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/gu;
  for (const match of source.matchAll(staticPattern)) imports.push(match[1]);
  for (const match of source.matchAll(dynamicPattern)) imports.push(match[1]);
  return imports;
}

function classifyProjectPath(path) {
  const normalized = toPosix(relative(root, path));
  const [layer, domain] = normalized.split('/');
  return { normalized, layer, domain: layer === 'domains' ? domain : undefined };
}

function resolveProjectImport(sourceFile, specifier) {
  if (specifier.startsWith('@/')) {
    return resolve(root, specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return resolve(sourceFile, '..', specifier);
  }
  return undefined;
}

function reportError(rule, file, specifier, detail) {
  errors.push({ rule, file, specifier, detail });
}

const domainsDirectory = resolve(root, 'domains');
if (existsSync(domainsDirectory)) {
  for (const entry of readdirSync(domainsDirectory)) {
    const domainPath = resolve(domainsDirectory, entry);
    if (!statSync(domainPath).isDirectory()) continue;
    if (!existsSync(resolve(domainPath, 'index.ts'))) {
      reportError(
        'missing-domain-public-api',
        `domains/${entry}`,
        '',
        'Each domain must expose domains/<domain>/index.ts.',
      );
    }
  }
}

const files = sourceRoots.flatMap((directory) =>
  collectSourceFiles(resolve(root, directory)),
);

for (const absoluteFile of files) {
  const source = readFileSync(absoluteFile, 'utf8');
  const sourceInfo = classifyProjectPath(absoluteFile);

  for (const specifier of extractImports(source)) {
    const importedPath = resolveProjectImport(absoluteFile, specifier);
    if (!importedPath) continue;
    const importedInfo = classifyProjectPath(importedPath);

    if (specifier.startsWith('@/domains/')) {
      const domainParts = specifier.slice('@/domains/'.length).split('/');
      if (domainParts.length > 1) {
        reportError(
          'private-domain-import',
          sourceInfo.normalized,
          specifier,
          'Import the domain public API instead of an internal module.',
        );
      }
    }

    if (
      sourceInfo.layer === 'domains' &&
      importedInfo.layer === 'domains' &&
      sourceInfo.domain !== importedInfo.domain
    ) {
      reportError(
        'domain-cross-import',
        sourceInfo.normalized,
        specifier,
        `Domain ${sourceInfo.domain} must not import domain ${importedInfo.domain}.`,
      );
    }

    if (
      ['components', 'hooks', 'lib'].includes(sourceInfo.layer) &&
      importedInfo.layer === 'domains'
    ) {
      reportError(
        'shared-imports-domain',
        sourceInfo.normalized,
        specifier,
        'Shared layers must not depend on domain modules.',
      );
    }

    if (sourceInfo.layer !== 'app' && importedInfo.layer === 'app') {
      reportError(
        'no-app-import-outside-app',
        sourceInfo.normalized,
        specifier,
        'Only app-layer files may import the app layer.',
      );
    }
  }

  const lineCount = source.split(/\r?\n/u).length;
  const basename = sourceInfo.normalized.split('/').at(-1) ?? '';
  const isTestFile = /\.(?:spec|test)\.[jt]sx?$/u.test(basename);
  if (!isTestFile && /^page\.[jt]sx?$/u.test(basename) && lineCount > 250) {
    warnings.push({
      rule: 'page-too-large',
      file: sourceInfo.normalized,
      detail: `${lineCount} lines (limit: 250)`,
    });
  } else if (
    !isTestFile &&
    (sourceInfo.normalized.includes('/hooks/') ||
      /^use[A-Z].*\.[jt]sx?$/u.test(basename)) &&
    lineCount > 200
  ) {
    warnings.push({
      rule: 'hook-too-large',
      file: sourceInfo.normalized,
      detail: `${lineCount} lines (limit: 200)`,
    });
  } else if (
    !isTestFile &&
    sourceInfo.normalized.includes('/components/') &&
    lineCount > 300
  ) {
    warnings.push({
      rule: 'component-too-large',
      file: sourceInfo.normalized,
      detail: `${lineCount} lines (limit: 300)`,
    });
  }
}

for (const warning of warnings) {
  console.warn(`WARN [${warning.rule}] ${warning.file}: ${warning.detail}`);
}
for (const error of errors) {
  console.error(
    `ERROR [${error.rule}] ${error.file}${error.specifier ? ` -> ${error.specifier}` : ''}: ${error.detail}`,
  );
}

console.log(
  `Architecture check: ${files.length} source files, ${errors.length} error(s), ${warnings.length} warning(s).`,
);

if (errors.length > 0) {
  process.exitCode = 1;
}
