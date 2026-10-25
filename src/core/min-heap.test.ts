import { describe, expect, it } from 'vitest';
import { MinHeap } from './min-heap';

describe('MinHeap', () => {
  it('pops values in order of priority', () => {
    // given
    const heap = new MinHeap<string>();
    [
      [5, 'e'],
      [1, 'a'],
      [3, 'c'],
      [2, 'b'],
      [4, 'd'],
    ].forEach(([priority, value]) => {
      heap.push(priority as number, value as string);
    });

    // when
    const popped = Array.from({ length: 5 }, () => heap.pop());

    // then
    expect(popped).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns undefined when empty', () => {
    // given
    const heap = new MinHeap<number>();

    // when
    const popped = heap.pop();

    // then
    expect(popped).toBeUndefined();
  });

  it('reports its size', () => {
    // given
    const heap = new MinHeap<number>();
    heap.push(1, 1);
    heap.push(2, 2);

    // when
    heap.pop();

    // then
    expect(heap.size).toBe(1);
  });
});
