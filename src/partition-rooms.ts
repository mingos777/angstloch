import { blend } from './blend';
import { createCentreRoom } from './create-centre-room';
import { pickRoomSize } from './pick-room-size';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlacer, RoomPlan } from './room-plan';
import type { Random } from './random';
import type { Room } from './room';
import { roomsConflict } from './rooms-conflict';
import { symmetricExtent } from './symmetric-extent';

/** Attempts at partitioning the map with more leaves, when the rooms fall short of the fill. */
const MAX_ATTEMPTS = 6;

/** An area that holds exactly one room, in floor coordinates. */
interface Leaf {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a leaf could be cut along one axis: the cut positions run from `first` to `last`. */
function cutRange(
  start: number,
  length: number,
  smallest: number,
  plan: RoomPlan,
): { first: number; last: number } | undefined {
  const first = start + smallest;
  const last = start + length - plan.spacing - smallest;
  return first <= last ? { first, last } : undefined;
}

function split(random: Random, plan: RoomPlan, target: number): Leaf[] {
  // on the lattice the floor area must end on an even tile
  const end =
    plan.step === 2 ? 2 * Math.floor((plan.width - 1) / 2) : plan.width - 1;
  const bottom =
    plan.step === 2 ? 2 * Math.floor((plan.height - 1) / 2) : plan.height - 1;
  const leaves: Leaf[] = [
    {
      x: EDGE_CLEARANCE,
      y: EDGE_CLEARANCE,
      width: end - EDGE_CLEARANCE,
      height: bottom - EDGE_CLEARANCE,
    },
  ];

  while (leaves.length < target) {
    const splittable = leaves.filter(
      (leaf) =>
        cutRange(leaf.x, leaf.width, plan.widths.min, plan) ??
        cutRange(leaf.y, leaf.height, plan.heights.min, plan),
    );
    if (splittable.length === 0) {
      break;
    }

    let leaf: Leaf;
    if (random() < plan.spacingUniformity) {
      leaf = splittable.reduce((a, b) =>
        b.width * b.height > a.width * a.height ? b : a,
      );
    } else {
      const total = splittable.reduce((sum, l) => sum + l.width * l.height, 0);
      let pick = random() * total;
      leaf =
        splittable.find((l) => (pick -= l.width * l.height) < 0) ??
        (splittable[0] as Leaf);
    }

    const across = cutRange(leaf.x, leaf.width, plan.widths.min, plan);
    const down = cutRange(leaf.y, leaf.height, plan.heights.min, plan);
    const ratio = leaf.width / leaf.height;
    const vertical =
      across && down
        ? ratio > 1.25 || (ratio >= 0.8 && random() < 0.5)
        : across !== undefined;
    const range = (vertical ? across : down) as { first: number; last: number };
    const count = (range.last - range.first) / plan.step + 1;
    const cut =
      range.first +
      plan.step *
        Math.min(
          count - 1,
          Math.floor(blend(random, plan.spacingUniformity) * count),
        );

    leaves.splice(leaves.indexOf(leaf), 1);
    if (vertical) {
      leaves.push(
        { ...leaf, width: cut - leaf.x },
        {
          ...leaf,
          x: cut + plan.spacing,
          width: leaf.x + leaf.width - cut - plan.spacing,
        },
      );
    } else {
      leaves.push(
        { ...leaf, height: cut - leaf.y },
        {
          ...leaf,
          y: cut + plan.spacing,
          height: leaf.y + leaf.height - cut - plan.spacing,
        },
      );
    }
  }
  return leaves;
}

function placeInLeaf(
  random: Random,
  plan: RoomPlan,
  leaf: Leaf,
  id: number,
): Room {
  const width = pickRoomSize(
    random,
    { min: plan.widths.min, max: Math.min(plan.widths.max, leaf.width) },
    plan.step,
    plan.sizeUniformity,
  );
  const height = pickRoomSize(
    random,
    { min: plan.heights.min, max: Math.min(plan.heights.max, leaf.height) },
    plan.step,
    plan.sizeUniformity,
  );
  const offset = (slack: number): number =>
    plan.step *
    Math.min(
      slack / plan.step,
      Math.floor(
        blend(random, plan.spacingUniformity) * (slack / plan.step + 1),
      ),
    );
  return {
    id,
    x: leaf.x + offset(leaf.width - width),
    y: leaf.y + offset(leaf.height - height),
    width,
    height,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  };
}

/** A room and the area it was placed in. */
interface Placed {
  leaf: Leaf;
  room: Room;
}

/**
 * Cuts the map in two again and again, and puts one room in every resulting
 * area. The number of areas is estimated from the fill and the typical room
 * size, and grown if the rooms fall short.
 */
function partition(random: Random, plan: RoomPlan): Placed[] {
  const { roomCount, fill } = plan;
  const area = plan.width * plan.height;
  const typicalArea =
    ((plan.widths.min + plan.widths.max) / 2) *
    ((plan.heights.min + plan.heights.max) / 2);
  let target = Math.min(
    roomCount.max,
    Math.max(roomCount.min, Math.ceil((fill * area) / typicalArea)),
  );

  let placed: Placed[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && target > 0; ++attempt) {
    const leaves = split(random, plan, target);
    placed = leaves
      .filter(
        (leaf) =>
          leaf.width >= plan.widths.min && leaf.height >= plan.heights.min,
      )
      .map((leaf, id) => ({ leaf, room: placeInLeaf(random, plan, leaf, id) }));
    const rooms = placed.map(({ room }) => room);
    const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
    const full = leaves.length < target;
    const satisfied = rooms.length >= roomCount.min && covered >= fill * area;
    if (full || satisfied || target >= roomCount.max) {
      break;
    }
    target = Math.min(roomCount.max, Math.ceil(target * 1.3) + 1);
  }
  return placed;
}

/**
 * Places a room in the middle that is its own mirror image, and the rest of
 * the rooms in one half or quarter of the map, which is partitioned. Every
 * other part of the map gets the mirror images of those rooms, or with a
 * chance below 1, rooms of its own in the mirrored areas.
 */
function partitionSymmetric(random: Random, plan: RoomPlan): Room[] {
  const centre = createCentreRoom(random, plan);
  if (!centre) {
    return [];
  }
  const lattice = plan.step === 2;
  const copies = plan.transforms.length + 1;
  const mirrorsX = plan.layout !== 'vertical';
  const mirrorsY = plan.layout === 'vertical' || plan.layout === 'both';
  // the part that is partitioned ends a spacing before its mirror image starts
  const part = (size: number, mirrors: boolean): number =>
    mirrors
      ? Math.floor((symmetricExtent(size, lattice) - plan.spacing) / 2) + 1
      : size;
  const [width, height] = [
    part(plan.width, mirrorsX),
    part(plan.height, mirrorsY),
  ];
  const share = (plan.width * plan.height) / (copies * width * height);
  const region: RoomPlan = {
    ...plan,
    width,
    height,
    fill: Math.min(1, plan.fill * share),
    roomCount: {
      min: Math.max(0, Math.ceil((plan.roomCount.min - 1) / copies)),
      max: Math.max(0, Math.floor((plan.roomCount.max - 1) / copies)),
    },
    transforms: [],
  };

  const shape = (leaf: Leaf): Room => ({
    id: 0,
    ...leaf,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  });
  const groups = partition(random, region).map(({ leaf, room }) => [
    room,
    ...plan.transforms.map((transform) => {
      if (plan.symmetryChance > random()) {
        return transform.room(room);
      }
      const { x, y, width: w, height: h } = transform.room(shape(leaf));
      return placeInLeaf(random, region, { x, y, width: w, height: h }, 0);
    }),
  ]);
  return [
    centre,
    ...groups
      .filter((group) =>
        group.every((room) => !roomsConflict(room, centre, plan.spacing)),
      )
      .flat(),
  ].map((room, id) => ({ ...room, id }));
}

/**
 * Places rooms by binary space partitioning: the map is cut in two again and
 * again, and every resulting area gets one room. With a symmetric layout, only
 * a part of the map is partitioned and the rooms are mirrored.
 */
export const partitionRooms: RoomPlacer = (random, plan) =>
  plan.transforms.length > 0
    ? partitionSymmetric(random, plan)
    : partition(random, plan).map(({ room }) => room);
