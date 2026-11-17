// Демонстрационные данные видеомониторинга: показывают, как будет выглядеть раздел с подключёнными камерами.
// Время событий отсчитывается от момента загрузки, чтобы журнал выглядел «живым».
import type { Camera, Room, Rule, VideoEvent, VideoOverview } from './types';

const rooms: Room[] = [
  { id: 'r1', name: 'Помещение 1', purpose: 'Коровник, дойное стадо' },
  { id: 'r2', name: 'Помещение 2', purpose: 'Телятник' },
  { id: 'r3', name: 'Помещение 3', purpose: 'Санпропускник и зона дезинфекции' },
  { id: 'r4', name: 'Помещение 4', purpose: 'Карантинный изолятор' },
  { id: 'r5', name: 'Помещение 5', purpose: 'Склад кормов' },
];

const cam = (id: string, roomId: string, name: string, status: Camera['status'] = 'online'): Camera => ({
  id,
  roomId,
  name,
  status,
  aiEnabled: status === 'online',
  streamUrl: null,
});

const cameras: Camera[] = [
  cam('c11', 'r1', 'Вход и ворота'),
  cam('c12', 'r1', 'Кормовой проход'),
  cam('c13', 'r1', 'Стойла, ряд А'),
  cam('c14', 'r1', 'Стойла, ряд Б'),
  cam('c21', 'r2', 'Боксы телят'),
  cam('c22', 'r2', 'Зона выпойки'),
  cam('c23', 'r2', 'Выход на выгул', 'offline'),
  cam('c31', 'r3', 'Санпропускник'),
  cam('c32', 'r3', 'Дезбарьер для транспорта'),
  cam('c41', 'r4', 'Изолятор, общий план'),
  cam('c51', 'r5', 'Склад, вход'),
  cam('c52', 'r5', 'Склад, стеллажи'),
];

const rules: Rule[] = [
  {
    id: 'ppe',
    name: 'Работа без СИЗ',
    description: 'Человек без халата, перчаток или респиратора в зоне с животными или дезинфекции',
    severity: 'gross',
    roomIds: ['r1', 'r2', 'r3', 'r4'],
    enabled: true,
  },
  {
    id: 'stranger',
    name: 'Посторонний в помещении',
    description: 'Человек без допуска (не опознан по форме или бейджу)',
    severity: 'gross',
    roomIds: [],
    enabled: true,
  },
  {
    id: 'cruelty',
    name: 'Жестокое обращение с животным',
    description: 'Удары, волочение, применение палки или электропогонялки',
    severity: 'gross',
    roomIds: ['r1', 'r2', 'r4'],
    enabled: true,
  },
  {
    id: 'disinfection',
    name: 'Проход мимо дезбарьера',
    description: 'Человек или транспорт миновали дезковрик или дезбарьер',
    severity: 'gross',
    roomIds: ['r3'],
    enabled: true,
  },
  {
    id: 'down',
    name: 'Животное неподвижно',
    description: 'Животное лежит без движения дольше 30 минут',
    severity: 'violation',
    roomIds: ['r1', 'r2', 'r4'],
    enabled: true,
  },
  {
    id: 'door',
    name: 'Ворота открыты',
    description: 'Ворота или дверь открыты дольше 10 минут',
    severity: 'violation',
    roomIds: [],
    enabled: true,
  },
  {
    id: 'smoking',
    name: 'Курение',
    description: 'Курение или открытый огонь в помещении',
    severity: 'violation',
    roomIds: [],
    enabled: true,
  },
  {
    id: 'crowd',
    name: 'Скопление людей',
    description: 'Больше трёх человек в изоляторе одновременно',
    severity: 'notice',
    roomIds: ['r4'],
    enabled: true,
  },
];

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type Seed = [number, string, string, string, number, string, VideoEvent['review']?];

/** [минут назад, помещение, камера, правило, уверенность, что увидела модель, разметка] */
const seeds: Seed[] = [
  [4, 'r3', 'c31', 'ppe', 0.93, 'Сотрудник прошёл в зону без респиратора'],
  [11, 'r1', 'c11', 'door', 0.88, 'Ворота открыты 14 минут'],
  [26, 'r1', 'c13', 'down', 0.71, 'Корова в стойле А-12 лежит без движения 35 минут'],
  [48, 'r3', 'c32', 'disinfection', 0.9, 'Грузовик объехал дезбарьер'],
  [73, 'r5', 'c51', 'stranger', 0.66, 'Неопознанный человек у входа на склад', 'false'],
  [95, 'r2', 'c21', 'ppe', 0.84, 'Работа в боксах без перчаток', 'confirmed'],
  [140, 'r5', 'c52', 'smoking', 0.79, 'Курение между стеллажами', 'confirmed'],
  [210, 'r4', 'c41', 'crowd', 0.82, 'Пять человек в изоляторе'],
  [320, 'r1', 'c12', 'cruelty', 0.74, 'Удар палкой при перегоне', 'confirmed'],
  [415, 'r2', 'c22', 'door', 0.91, 'Дверь в зону выпойки открыта 22 минуты', 'confirmed'],
];

const severityOf = new Map(rules.map((r) => [r.id, r.severity]));

const events: VideoEvent[] = seeds.map(([minutes, roomId, cameraId, ruleId, confidence, note, review], i) => {
  const severity = severityOf.get(ruleId) ?? 'notice';
  return {
    id: `e${i + 1}`,
    at: ago(minutes),
    roomId,
    cameraId,
    ruleId,
    severity,
    confidence,
    note,
    telegram: severity === 'gross' ? 'sent' : null,
    review: review ?? 'pending',
  };
});

export function demoOverview(): VideoOverview {
  return { rooms, cameras, rules, events, demo: true };
}
