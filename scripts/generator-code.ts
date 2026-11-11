import { codeLiteral } from '../demo/code-literal';

/** Stands for the PRNG in the options, to be swapped for its call. */
const RANDOM = '<random>';

/** The code that makes a map with a preset and `mulberry32` of the seed, unformatted. */
export function generatorCode(
  generator: string,
  options: object,
  seed: number,
): string {
  const literal = codeLiteral(
    { ...options, random: RANDOM },
    0,
    new Set(),
  ).replace(`'${RANDOM}'`, `mulberry32(${String(seed)})`);
  return [
    `import { ${generator} } from 'angstloch';`,
    '',
    `const result = ${generator}(${literal});`,
    '',
  ].join('\n');
}
