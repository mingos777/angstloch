// The Node modules the scripts use, declared by hand, so that the project
// needs no @types/node (`types` is empty in tsconfig.json).
declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: string[],
    options: { encoding: 'utf8'; stdio: 'pipe'; cwd?: string },
  ): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(
    path: string,
    data: string,
    encoding: 'utf8',
  ): void;
  export function existsSync(path: string): boolean;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(
    path: string,
    options: { recursive: true; force: true },
  ): void;
  export function readdirSync(
    path: string,
    options: { encoding: 'utf8'; recursive: true },
  ): string[];
}
