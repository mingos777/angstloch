import type { Verge } from '../roads/verge';
import type { RoomTemplate } from '../rooms/templates/room-template';

/**
 * Options of `placeTemplates`: the templates, and how the `margin` of a clearing
 * of its own is measured. The width of that ramp is the `margin` of each
 * template, so only the `distance` of the verge is taken.
 */
export interface PlaceTemplatesOptions extends Pick<Verge, 'distance'> {
  /** The templates to place, the same `RoomTemplate` objects as the dungeons take, but with no exits, `positions` or `areas`. A `clearing` template goes on a free clearing or makes one of its own, and any other goes to a random spot. */
  templates: RoomTemplate[];
}
