import type { DistanceMetric, Range, Tile, Verge } from '../src';

/** What a control of a step holds: text for numbers and selects, a boolean for a checkbox. */
export type FieldValue = string | boolean;

/** A control in the card of a step. */
export interface Field {
  key: string;
  label: string;
  type: 'number' | 'checkbox' | 'select' | 'json';
  value: FieldValue;
  /** Attributes of a number input, such as `min`, `max` and `step`. */
  attrs?: Record<string, string>;
  /** The choices of a select, as value and label. */
  options?: readonly (readonly [string, string])[];
}

/** A number input. An empty `value` leaves the option out. */
export function number(
  key: string,
  label: string,
  value: number | '',
  attrs: Record<string, string> = {},
): Field {
  return { key, label, type: 'number', value: String(value), attrs };
}

/** Two number inputs, `keyMin` and `keyMax`, for a `Range`. */
export function pair(
  key: string,
  label: string,
  min: number,
  max: number,
  attrs: Record<string, string> = {},
): Field[] {
  return [
    number(`${key}Min`, `${label} min`, min, attrs),
    number(`${key}Max`, `${label} max`, max, attrs),
  ];
}

export function check(key: string, label: string, value: boolean): Field {
  return { key, label, type: 'checkbox', value };
}

export function select(
  key: string,
  label: string,
  value: string,
  options: readonly (readonly [string, string])[],
): Field {
  return { key, label, type: 'select', value, options };
}

/** A text area for JSON. Blank means the option is left out. */
export function json(key: string, label: string, value = ''): Field {
  return { key, label, type: 'json', value };
}

/** The tiles that can be picked for a step. */
export const TILES = [
  ['4', 'tree'],
  ['0', 'wall'],
  ['1', 'floor'],
  ['3', 'grass'],
] as const;

/** The three fields of a `Verge`. */
export function vergeFields(clearance: number, falloff: number): Field[] {
  return [
    number('clearance', 'Clearance', clearance, { min: '0' }),
    number('falloff', 'Falloff', falloff, { min: '0' }),
    select('distance', 'Distance', 'chebyshev', [
      ['chebyshev', 'chebyshev'],
      ['manhattan', 'manhattan'],
      ['euclidean', 'euclidean'],
    ]),
  ];
}

/** Reads the values of a card. */
export class Values {
  constructor(private readonly raw: Record<string, FieldValue>) {}

  number(key: string): number {
    return Number(this.raw[key]);
  }

  /** The number, or nothing for a blank control. */
  optional(key: string): number | undefined {
    const value = this.raw[key];
    return value === '' || value === undefined ? undefined : Number(value);
  }

  flag(key: string): boolean {
    return this.raw[key] === true;
  }

  text(key: string): string {
    return String(this.raw[key]);
  }

  tile(key: string): Tile {
    return this.number(key) as Tile;
  }

  /** The `Range` of the controls `keyMin` and `keyMax`. */
  range(key: string): Range {
    return {
      min: this.number(`${key}Min`),
      max: this.number(`${key}Max`),
    };
  }

  /** A single number as a range of that one value, or nothing when it is blank. */
  fixed(key: string): Range | undefined {
    const value = this.optional(key);
    return value === undefined ? undefined : { min: value, max: value };
  }

  verge(): Verge {
    return {
      clearance: this.number('clearance'),
      falloff: this.number('falloff'),
      distance: this.text('distance') as DistanceMetric,
    };
  }

  /** The parsed JSON of a text area, or nothing when it is blank. */
  json(key: string): unknown {
    const text = this.text(key).trim();
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  }
}
