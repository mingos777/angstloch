import { createFractalNoise, createSimplexNoise, transformNoise } from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';

const form = document.querySelector<HTMLFormElement>('#controls');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const context = canvas?.getContext('2d');

/** Paints the noise as one gray square per tile: black for -1, white for 1. */
function render(): void {
  if (!form || !canvas || !error || !stats || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const width = value('width');
  const height = value('height');
  const tileSize = value('tileSize');

  try {
    const noise = transformNoise(
      createFractalNoise(createSimplexNoise(mulberry32(value('seed'))), {
        octaves: value('octaves'),
        persistence: value('persistence'),
        lacunarity: value('lacunarity'),
      }),
      {
        scaleX: value('scaleX'),
        scaleY: value('scaleY'),
        rotation: value('rotation'),
      },
    );
    canvas.width = width * tileSize;
    canvas.height = height * tileSize;
    let lowest = 1;
    let highest = -1;
    let sum = 0;
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const n = noise(x, y);
        lowest = Math.min(lowest, n);
        highest = Math.max(highest, n);
        sum += n;
        const gray = Math.round(((n + 1) / 2) * 255);
        context.fillStyle = `rgb(${String(gray)} ${String(gray)} ${String(gray)})`;
        context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
    error.textContent = '';
    stats.textContent = `min ${lowest.toFixed(2)}, max ${highest.toFixed(2)}, mean ${(sum / (width * height)).toFixed(2)}`;
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

form?.addEventListener('input', render);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-noise.png');
  }
});
render();
