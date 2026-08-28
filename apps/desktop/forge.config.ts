/**
 * Packaging (T027 fuses, T087 installers).
 *
 * x64 and ARM64 per-user Squirrel installers, ASAR with integrity validation,
 * production fuses, native addons unpacked, Authenticode signing driven by
 * environment (keys never live in the repository), and SHA-256 checksums
 * written next to every artifact.
 */

import type { ForgeConfig, ForgeMakeResult } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';

// Signing is opt-in via environment: THREADHELM_SIGN_CERT (path to .pfx) and
// THREADHELM_SIGN_PASSWORD, or THREADHELM_SIGN_TOOL for an external signer
// command that receives the file path as its only argument.
const certificateFile = process.env.THREADHELM_SIGN_CERT;
const certificatePassword = process.env.THREADHELM_SIGN_PASSWORD;
const signing =
  certificateFile && certificatePassword ? { certificateFile, certificatePassword } : undefined;

/**
 * Runtime packages that stay outside the bundle (native addons) and are copied
 * explicitly after the app files. Forge's dependency walker cannot see through
 * a pnpm workspace, so pruning is disabled and this allowlist replaces it.
 */
// Patterns see directory entries without a trailing slash: match "name" or "name/…".
const RUNTIME_PACKAGES: { name: string; exclude: RegExp[] }[] = [
  {
    name: 'better-sqlite3',
    exclude: [
      /^(src|deps|node_modules|test)(\/|$)/,
      /^build\/(?!Release(\/|$))/,
      /^build\/Release\/(?!.*\.node$)./,
    ],
  },
  { name: 'node-pty', exclude: [/^(src|scripts|node_modules)(\/|$)/, /\.pdb$/, /\.ts$/] },
  {
    name: '@threadhelm/windows-supervisor',
    exclude: [/^(src|target|node_modules|\.cargo)(\/|$)/, /^(Cargo\.(toml|lock)|build\.rs)$/],
  },
];

function packageRoot(name: string): string {
  const req = createRequire(join(process.cwd(), 'package.json'));
  let dir = dirname(req.resolve(name));
  while (!existsSync(join(dir, 'package.json')) || !dir.endsWith(name.split('/').pop()!)) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`cannot find package root for ${name}`);
    dir = parent;
  }
  return realpathSync(dir);
}

function copyRuntimePackages(buildPath: string): void {
  for (const pkg of RUNTIME_PACKAGES) {
    const source = packageRoot(pkg.name);
    const target = join(buildPath, 'node_modules', ...pkg.name.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, {
      recursive: true,
      dereference: true,
      filter: (src) => {
        const rel = relative(source, src);
        if (!rel) return true;
        const normalized = rel.split(sep).join('/');
        return !pkg.exclude.some((pattern) => pattern.test(normalized));
      },
    });
  }
}

const config: ForgeConfig = {
  // Packaged output. `out/` is electron-vite's build output and must be
  // packaged, so Forge must not treat it as its own output directory.
  outDir: 'release',
  // Both addons are prebuilt Node-API binaries (ABI-stable); nothing to rebuild.
  rebuildConfig: { onlyModules: [] },
  packagerConfig: {
    // Dependencies are copied by the packageAfterCopy hook below.
    prune: false,
    asar: {
      // Native addons must stay real files on disk.
      unpack: '**/*.node',
    },
    name: 'ThreadHelm',
    executableName: 'ThreadHelm',
    appBundleId: 'dev.builtbychappy.threadhelm',
    win32metadata: {
      CompanyName: 'ThreadHelm',
      ProductName: 'ThreadHelm',
      FileDescription: 'ThreadHelm local agent workspace',
    },
    ...(signing
      ? {
          windowsSign: {
            certificateFile: signing.certificateFile,
            certificatePassword: signing.certificatePassword,
            timestampServer: 'http://timestamp.digicert.com',
          },
        }
      : {}),
    // Only the built output and runtime dependencies ship.
    ignore: [
      // The workspace's node_modules are symlink farms; runtime packages are
      // copied explicitly by packageAfterCopy instead.
      /^\/node_modules/,
      /^\/forge\.config\.ts/,
      /^\/src/,
      /^\/\.tsbuild/,
      /^\/electron\.vite\.config/,
      /^\/tsconfig/,
      /\.map$/,
      // The native package ships only index.js, index.d.ts, package.json, and
      // the .node binary — never Rust sources or the cargo build tree.
      /windows-supervisor[\\/](target|src|\.cargo|Cargo\.(toml|lock)|build\.rs)/,
    ],
  },
  makers: [
    // `electron-forge make --arch x64` / `--arch arm64` each produce a
    // per-user installer named for its architecture.
    new MakerSquirrel(
      (arch) => ({
        name: 'ThreadHelm',
        authors: 'ThreadHelm',
        description: 'ThreadHelm local agent workspace',
        setupExe: `ThreadHelm-Setup-${arch}.exe`,
        noMsi: true,
        ...(signing
          ? {
              certificateFile: signing.certificateFile,
              certificatePassword: signing.certificatePassword,
            }
          : {}),
      }),
      ['win32'],
    ),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      copyRuntimePackages(buildPath);
    },
    // Every installer and setup artifact gets a sibling .sha256 file so users
    // can verify integrity; release notes publish the same values.
    postMake: async (_config, results: ForgeMakeResult[]) => {
      for (const result of results) {
        for (const artifact of result.artifacts) {
          if (!/\.(exe|nupkg|msi)$/i.test(artifact)) continue;
          const digest = createHash('sha256').update(readFileSync(artifact)).digest('hex');
          writeFileSync(`${artifact}.sha256`, `${digest}  ${artifact.split(/[\\/]/).pop()}\n`);
        }
      }
      return results;
    },
  },
};

export default config;
