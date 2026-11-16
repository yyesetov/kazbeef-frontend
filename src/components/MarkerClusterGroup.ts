import ClusterModule from 'react-leaflet-cluster';

// react-leaflet-cluster 2.x собран только как CommonJS. Сборщик отдаёт его default-импорт по-разному:
// либо сам компонент, либо объект модуля { default: компонент }. Берём компонент в обоих случаях.
// Обёртку можно убрать после перехода на версию пакета с ES-модулями (она требует react-leaflet 5 и React 19).
type ClusterGroup = typeof ClusterModule;

const resolved = ClusterModule as ClusterGroup | { default: ClusterGroup };

export const MarkerClusterGroup: ClusterGroup = 'default' in resolved ? resolved.default : resolved;
