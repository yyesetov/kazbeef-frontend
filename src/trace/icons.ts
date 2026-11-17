// Значок каждого этапа: один и тот же на схеме процесса и в панели этапа.
import {
  IconBuildingStore,
  IconBuildingWarehouse,
  IconHourglass,
  IconPackage,
  IconSlice,
  IconSnowflake,
  IconStethoscope,
  IconTruckLoading,
  type Icon,
} from '@tabler/icons-react';
import type { StageId } from './types';

export const STAGE_ICON: Record<StageId, Icon> = {
  slaughter: IconStethoscope,
  aging: IconHourglass,
  cutting: IconSlice,
  packing: IconPackage,
  freezing: IconSnowflake,
  storage: IconBuildingWarehouse,
  shipping: IconTruckLoading,
  delivered: IconBuildingStore,
};
