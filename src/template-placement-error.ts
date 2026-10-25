/** Thrown when a room template cannot be placed. The message says why. */
export class TemplatePlacementError extends Error {
  /** Position of the template in the `templates` option. */
  readonly templateIndex: number;
  /** The template's `name`, if it has one. */
  readonly templateName: string | undefined;
  /** Why the template could not be placed, without the template's name. */
  readonly reason: string;

  constructor(
    templateIndex: number,
    templateName: string | undefined,
    cause: string,
  ) {
    super(`${describeTemplate(templateIndex, templateName)}: ${cause}`);
    this.name = 'TemplatePlacementError';
    this.templateIndex = templateIndex;
    this.templateName = templateName;
    this.reason = cause;
  }
}

function describeTemplate(index: number, name: string | undefined): string {
  return name === undefined
    ? `Template #${String(index)}`
    : `Template "${name}" (#${String(index)})`;
}
