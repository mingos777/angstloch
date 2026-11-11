/**
 * Checks the package as a consumer gets it. Run with `npm run check:package`.
 * It builds the library, packs it, installs the tarball into a scratch project
 * in the system's temporary directory, typechecks a small program against it
 * under `moduleResolution` `bundler` and `nodenext`, and runs the program. It
 * prints OK, or the failing step and its output and exits with 1.
 *
 * The program holds a `@ts-expect-error`, so the check also fails when the
 * types resolve to `any` (as they do under `nodenext` when the bundled
 * declarations have relative imports without extensions).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

declare const process: { exitCode?: number; execPath: string };

const SAMPLE = `import {
  Tile,
  emptyMap,
  generateMaze,
  generateRoomDungeon,
  pipeline,
  placeScatteredRooms,
  digCorridors,
  type Grid,
  type Random,
} from 'angstloch';

const random: Random = Math.random;
const maze = generateMaze({ width: 21, height: 11, random });
const grid: Grid = maze.grid;
const dungeon = generateRoomDungeon({ width: 60, height: 30 });
const composed = pipeline(
  emptyMap({ width: 60, height: 30, tile: Tile.Wall }),
  [placeScatteredRooms(), digCorridors()],
  { random },
);

// never called: it only proves that the types are not any
export function misuse(): void {
  // @ts-expect-error the width is a number
  generateMaze({ width: '21', height: 11 });
}

if (
  grid.get(1, 1) !== Tile.Floor ||
  dungeon.rooms.length === 0 ||
  composed.rooms.length === 0
) {
  throw new Error('The package made an empty map.');
}
console.log('ran');
`;

const RESOLUTIONS: Record<string, object> = {
  bundler: { module: 'esnext', moduleResolution: 'bundler', noEmit: true },
  nodenext: { module: 'nodenext', moduleResolution: 'nodenext', outDir: 'out' },
};

class StepError extends Error {}

function run(what: string, file: string, args: string[], cwd: string): string {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: 'pipe', cwd });
  } catch (error) {
    const { stdout = '', stderr = '' } = error as {
      stdout?: string;
      stderr?: string;
    };
    throw new StepError(`${what} failed:\n${stdout}${stderr}`);
  }
}

const root = resolve('.');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const scratch = mkdtempSync(join(tmpdir(), 'angstloch-package-'));

try {
  run('The build', 'npm', ['run', '-s', 'build'], root);
  const packed = JSON.parse(
    run(
      'npm pack',
      'npm',
      ['pack', '--json', '--pack-destination', scratch],
      root,
    ),
  ) as { filename: string }[];
  const tarball = join(scratch, packed[0]?.filename ?? '');

  writeFileSync(
    join(scratch, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
    'utf8',
  );
  run(
    'Installing the tarball',
    'npm',
    ['install', '--no-audit', '--no-fund', tarball],
    scratch,
  );
  writeFileSync(join(scratch, 'sample.ts'), SAMPLE, 'utf8');

  for (const [name, options] of Object.entries(RESOLUTIONS)) {
    const config = `tsconfig.${name}.json`;
    writeFileSync(
      join(scratch, config),
      JSON.stringify({
        compilerOptions: {
          target: 'es2022',
          strict: true,
          noUncheckedIndexedAccess: true,
          types: [],
          ...options,
        },
        files: ['sample.ts'],
      }),
      'utf8',
    );
    run(
      `Typechecking under ${name}`,
      process.execPath,
      [tsc, '-p', config],
      scratch,
    );
  }
  run('Running the program', process.execPath, ['out/sample.js'], scratch);

  console.log(
    'OK: the packed package typechecks under bundler and nodenext, and runs.',
  );
} catch (error) {
  console.log(error instanceof StepError ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
