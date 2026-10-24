/** A binary min-heap of values ordered by a numeric priority. */
export class MinHeap<T> {
  private readonly priorities: number[] = [];
  private readonly values: T[] = [];

  get size(): number {
    return this.values.length;
  }

  push(priority: number, value: T): void {
    let i = this.values.length;
    this.priorities.push(priority);
    this.values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.priorities[parent] as number) <= priority) {
        break;
      }
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Removes and returns the value with the lowest priority. */
  pop(): T | undefined {
    const top = this.values[0];
    const lastPriority = this.priorities.pop();
    const lastValue = this.values.pop();
    if (this.values.length > 0 && lastPriority !== undefined) {
      this.priorities[0] = lastPriority;
      this.values[0] = lastValue as T;
      this.sinkDown();
    }
    return top;
  }

  private sinkDown(): void {
    const count = this.values.length;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (
        left < count &&
        (this.priorities[left] as number) <
          (this.priorities[smallest] as number)
      ) {
        smallest = left;
      }
      if (
        right < count &&
        (this.priorities[right] as number) <
          (this.priorities[smallest] as number)
      ) {
        smallest = right;
      }
      if (smallest === i) {
        return;
      }
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.priorities[a], this.priorities[b]] = [
      this.priorities[b] as number,
      this.priorities[a] as number,
    ];
    [this.values[a], this.values[b]] = [
      this.values[b] as T,
      this.values[a] as T,
    ];
  }
}
