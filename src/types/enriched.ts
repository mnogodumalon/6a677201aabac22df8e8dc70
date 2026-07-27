import type { FritzBoxen } from './app';

export type EnrichedFritzBoxen = FritzBoxen & {
  wohnungName: string;
};
