import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

interface CommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  type: string;
  scope?: string;
  isBreaking: boolean;
  raw: string;
}

interface ParsedArgs {
  bump?: 'major' | 'minor' | 'patch' | 'prerelease' | 'auto';
  version?: string;
  prereleaseTag?: string;
  dryRun: boolean;
  githubOutput: boolean;
}

function parseCliArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    bump: 'auto',
    dryRun: false,
    githubOutput: !!process.env.GITHUB_OUTPUT,
  };

  for (const arg of args) {
    if (arg.startsWith('--bump=')) {
      result.bump = arg.split('=')[1] as ParsedArgs['bump'];
    } else if (arg.startsWith('--version=')) {
      result.version = arg.split('=')[1];
    } else if (arg.startsWith('--prerelease-tag=')) {
      result.prereleaseTag = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--github-output') {
      result.githubOutput = true;
    }
  }

  return result;
}

function getLatestTag(): string | null {
  const proc = Bun.spawnSync(['git', 'describe', '--tags', '--abbrev=0'], {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode === 0) {
    return proc.stdout.toString().trim();
  }
  return null;
}

function getCommitsSince(tag: string | null): CommitInfo[] {
  const gitArgs = ['git', 'log', '--format=%H%x1f%h%x1f%s%x1e'];
  if (tag) {
    gitArgs.push(`${tag}..HEAD`);
  }

  const proc = Bun.spawnSync(gitArgs, {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    return [];
  }

  const output = proc.stdout.toString().trim();
  if (!output) return [];

  const rawEntries = output
    .split('\x1e')
    .map((e) => e.trim())
    .filter(Boolean);
  const commits: CommitInfo[] = [];

  for (const entry of rawEntries) {
    const [hash, shortHash, subject] = entry.split('\x1f');
    if (!hash || !subject) continue;

    // Parse conventional commit pattern: type(scope)!: subject
    const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    if (match) {
      const [, type, scope, breakingSymbol, cleanSubject] = match;
      const isBreaking = !!breakingSymbol || subject.toUpperCase().includes('BREAKING CHANGE');
      commits.push({
        hash,
        shortHash,
        subject: cleanSubject || subject,
        type: type.toLowerCase(),
        scope,
        isBreaking,
        raw: subject,
      });
    } else {
      const isBreaking = subject.toUpperCase().includes('BREAKING CHANGE');
      commits.push({
        hash,
        shortHash,
        subject,
        type: 'other',
        isBreaking,
        raw: subject,
      });
    }
  }

  return commits;
}

function determineRecommendedBump(commits: CommitInfo[]): 'major' | 'minor' | 'patch' | 'none' {
  if (commits.length === 0) return 'none';

  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  for (const c of commits) {
    if (c.isBreaking) {
      hasMajor = true;
      break;
    }
    if (c.type === 'feat') {
      hasMinor = true;
    } else if (['fix', 'perf', 'refactor', 'revert'].includes(c.type)) {
      hasPatch = true;
    }
  }

  if (hasMajor) return 'major';
  if (hasMinor) return 'minor';
  if (hasPatch) return 'patch';
  return 'none';
}

function parseSemver(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
  const clean = version.replace(/^v/, '');
  const [core, prerelease] = clean.split('-');
  const [major, minor, patch] = core.split('.').map((num) => Number.parseInt(num, 10) || 0);

  return { major, minor, patch, prerelease };
}

function bumpVersion(
  currentVersion: string,
  bumpType: 'major' | 'minor' | 'patch' | 'prerelease',
  prereleaseTag = 'beta',
): string {
  const { major, minor, patch, prerelease } = parseSemver(currentVersion);

  if (bumpType === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bumpType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  if (bumpType === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (bumpType === 'prerelease') {
    if (prerelease) {
      const match = prerelease.match(new RegExp(`^${prereleaseTag}\\.(\\d+)$`));
      const count = match ? Number.parseInt(match[1], 10) + 1 : 1;
      return `${major}.${minor}.${patch}-${prereleaseTag}.${count}`;
    }
    return `${major}.${minor}.${patch + 1}-${prereleaseTag}.1`;
  }

  return currentVersion;
}

function generateChangelog(version: string, commits: CommitInfo[], _prevTag: string | null): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const features: string[] = [];
  const fixes: string[] = [];
  const perf: string[] = [];
  const breaking: string[] = [];
  const maintenance: string[] = [];
  const other: string[] = [];

  for (const c of commits) {
    const scopePrefix = c.scope ? `**${c.scope}**: ` : '';
    const line = `- ${scopePrefix}${c.subject} (\`${c.shortHash}\`)`;

    if (c.isBreaking) {
      breaking.push(line);
    } else if (c.type === 'feat') {
      features.push(line);
    } else if (c.type === 'fix') {
      fixes.push(line);
    } else if (c.type === 'perf') {
      perf.push(line);
    } else if (['refactor', 'chore', 'ci', 'test', 'build'].includes(c.type)) {
      maintenance.push(line);
    } else {
      other.push(line);
    }
  }

  const sections: string[] = [];
  sections.push(`## [${version}] - ${dateStr}\n`);

  if (breaking.length > 0) {
    sections.push(`### 💥 Breaking Changes\n${breaking.join('\n')}\n`);
  }
  if (features.length > 0) {
    sections.push(`### 🚀 Features\n${features.join('\n')}\n`);
  }
  if (fixes.length > 0) {
    sections.push(`### 🐛 Bug Fixes\n${fixes.join('\n')}\n`);
  }
  if (perf.length > 0) {
    sections.push(`### ⚡ Performance Improvements\n${perf.join('\n')}\n`);
  }
  if (maintenance.length > 0) {
    sections.push(`### 🔧 Maintenance & Refactoring\n${maintenance.join('\n')}\n`);
  }
  if (other.length > 0) {
    sections.push(`### 📦 Other Changes\n${other.join('\n')}\n`);
  }

  if (commits.length === 0) {
    sections.push('- Routine release synchronization & maintenance.\n');
  }

  return sections.join('\n');
}

function updatePackageJson(filePath: string, newVersion: string, dryRun: boolean) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  pkg.version = newVersion;
  if (!dryRun) {
    writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function appendToChangelogFile(changelogContent: string, dryRun: boolean) {
  const changelogPath = resolve(rootDir, 'CHANGELOG.md');
  let existing = '';
  if (existsSync(changelogPath)) {
    existing = readFileSync(changelogPath, 'utf8');
  } else {
    existing = '# Convey Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Insert after main header if header exists
  const headerMatch = existing.match(/^# [^\n]+\n+(?:[^\n]+\n+)*/);
  let updated = '';
  if (headerMatch) {
    const header = headerMatch[0];
    const rest = existing.slice(header.length);
    updated = `${header}\n${changelogContent}\n${rest}`;
  } else {
    updated = `${changelogContent}\n\n${existing}`;
  }

  if (!dryRun) {
    writeFileSync(changelogPath, updated);
  }
}

function writeGitHubOutput(key: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  if (value.includes('\n')) {
    const delimiter = `DELIMITER_${Math.random().toString(36).substring(2, 10)}`;
    const multiline = `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
    Bun.write(outputPath, multiline);
  } else {
    const single = `${key}=${value}\n`;
    Bun.write(outputPath, single);
  }
}

async function main() {
  const cliArgs = parseCliArgs();
  console.log('🔍 Analyzing repository history for semantic release...');

  const rootPkgPath = resolve(rootDir, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  const currentVersion = rootPkg.version || '1.0.0';
  const latestTag = getLatestTag();

  console.log(`📌 Current package version: ${currentVersion}`);
  console.log(`🏷️ Latest Git Tag: ${latestTag || '(none found)'}`);

  const commits = getCommitsSince(latestTag);
  console.log(`📜 Found ${commits.length} commits since last tag`);

  let nextVersion = currentVersion;
  let shouldRelease = false;

  if (cliArgs.version) {
    nextVersion = cliArgs.version.replace(/^v/, '');
    shouldRelease = true;
    console.log(`🎯 Custom version specified: ${nextVersion}`);
  } else if (cliArgs.bump && cliArgs.bump !== 'auto') {
    nextVersion = bumpVersion(currentVersion, cliArgs.bump, cliArgs.prereleaseTag);
    shouldRelease = true;
    console.log(`🚀 Explicit bump requested [${cliArgs.bump}]: ${currentVersion} -> ${nextVersion}`);
  } else {
    const autoBump = determineRecommendedBump(commits);
    console.log(`🤖 Automated SemVer analysis recommendation: ${autoBump.toUpperCase()}`);

    if (autoBump !== 'none') {
      nextVersion = bumpVersion(currentVersion, autoBump, cliArgs.prereleaseTag);
      shouldRelease = true;
      console.log(`🚀 Automated bump [${autoBump}]: ${currentVersion} -> ${nextVersion}`);
    } else if (commits.length > 0) {
      // Commits exist (e.g. docs, chore, ci) -> bump patch by default if changes occurred
      nextVersion = bumpVersion(currentVersion, 'patch', cliArgs.prereleaseTag);
      shouldRelease = true;
      console.log(`🚀 Minor maintenance bump [patch]: ${currentVersion} -> ${nextVersion}`);
    } else {
      console.log('ℹ️ No unreleased changes detected. No release needed.');
      shouldRelease = false;
    }
  }

  const nextTag = `v${nextVersion}`;
  const isPrerelease = nextVersion.includes('-');
  const changelogBody = generateChangelog(nextVersion, commits, latestTag);

  console.log('\n--- Generated Changelog Preview ---');
  console.log(changelogBody);
  console.log('------------------------------------\n');

  if (shouldRelease) {
    if (cliArgs.dryRun) {
      console.log('🔎 DRY RUN MODE enabled. Skipping filesystem modifications.');
    } else {
      console.log(`📝 Synchronizing version ${nextVersion} across monorepo packages...`);

      const packagesToUpdate = [
        rootPkgPath,
        resolve(rootDir, 'packages/sdk/package.json'),
        resolve(rootDir, 'packages/shared/package.json'),
        resolve(rootDir, 'apps/server/package.json'),
        resolve(rootDir, 'apps/web/package.json'),
        resolve(rootDir, 'apps/website/package.json'),
      ];

      for (const pkgPath of packagesToUpdate) {
        updatePackageJson(pkgPath, nextVersion, false);
      }

      console.log('📄 Updating CHANGELOG.md...');
      appendToChangelogFile(changelogBody, false);
      console.log('✅ Version synchronization and changelog updated.');
    }
  }

  // GitHub Actions output export
  if (cliArgs.githubOutput) {
    writeGitHubOutput('should_release', shouldRelease ? 'true' : 'false');
    writeGitHubOutput('version', nextVersion);
    writeGitHubOutput('tag', nextTag);
    writeGitHubOutput('is_prerelease', isPrerelease ? 'true' : 'false');
    writeGitHubOutput('changelog', changelogBody);
  }

  console.log(`\n✨ Release assessment complete: should_release=${shouldRelease}, target=${nextTag}\n`);
}

main().catch((err) => {
  console.error('Fatal release error:', err);
  process.exit(1);
});
