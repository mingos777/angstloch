// The Node modules the scripts use, declared by hand, so that the project
// needs no @types/node (`types` is empty in tsconfig.json).
declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: string[],
    options: { encoding: 'utf8'; stdio: 'pipe' },
  ): string;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
  export function readdirSync(
    path: string,
    options: { encoding: 'utf8'; recursive: true },
  ): string[];
}
