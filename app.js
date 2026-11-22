const $=id=>document.getElementById(id),M=BusModel,KEY='brain-bus-v3';let state;try{state=JSON.parse(localStorage.getItem(KEY));if(!state||state.version!==3||!Array.isArray(state.day.tasks))state=M.make()}catch{state=M.make()}M.rollover(state);
let page='assess',draft=state.day.capacity,ratings=[...state.day.ratings],load=1,editId=null;
const icons={brain:0,bus:1,station:2,drive:3,me:4,wardrobe:5,seat:6,person:7,sleep:8,energy:9,mood:10,speed:11,play:12,pause:13,check:14,warning:15,add:16,edit:17,back:18,close:19,settings:20,mute:21,pin:22,reset:23};
const KIT_S = 0.3995, KIT_W = 1254 * KIT_S;
function kitIcon(x, y, w, h, src = 'assets/ui-kit.png') {
  x *= KIT_S; y *= KIT_S; w *= KIT_S; h *= KIT_S;
  return `<span class="icon" aria-hidden="true"><img src="${src}"
    style="width:${KIT_W / w * 100}%;height:${KIT_W / h * 100}%;left:${-x / w * 100}%;top:${-y / h * 100}%" alt=""></span>`;
}
function squareIcon([x, y, w, h], src) {
  const size = Math.max(w, h);
  const insetX = (size - w) / 2;
  const insetY = (size - h) / 2;
  const clip = `inset(${insetY / size * 100}% ${insetX / size * 100}%)`;
  return `<span class="icon-frame" style="--icon-clip:${clip}">${kitIcon(x - insetX, y - insetY, size, size, src)}</span>`;
}
function icon(name) {
  const n = icons[name] ?? 0;
  const col = n % 8;
  const row = Math.floor(n / 8);
  const xs = [0, 185, 350, 490, 640, 780, 935, 1090];
  const ws = [180, 160, 140, 150, 140, 155, 155, 164];
  return kitIcon(xs[col], [45, 235, 405][row], ws[col], 170);
}
const outfits = [
  {id: 'bus', name: '基础巴士', min: 2, max: 20, period: 2.5},
  {id: 'cart', name: '双人板车', min: 2, max: 2, period: 20},
  {id: 'trike', name: '遮阳三轮车', min: 3, max: 4, period: 16, box: [485, 215, 440, 250]},
  {id: 'car', name: '复古老汽车', min: 5, max: 6, period: 12, box: [1015, 230, 640, 225]},
  {id: 'truck', name: '长凳小货车', min: 7, max: 10, period: 10, box: [50, 475, 570, 195]},
  {id: 'tram', name: '两节电车', min: 11, max: 14, period: 7, box: [690, 450, 985, 225]},
  {id: 'train', name: '蒸汽小火车', min: 15, max: 17, period: 5.5},
  {id: 'plane', name: '云朵飞机', min: 18, max: 20, period: 2.5, box: [990, 675, 770, 210]}
];
const limitedOutfit = capacity => outfits.find(o => o.id !== 'bus' && capacity >= o.min && capacity <= o.max);
// 一键在「基础巴士」和「今天座位数对应的特殊载具」之间切换
function toggleRide() {
  const special = limitedOutfit(state.day.capacity);
  const toSpecial = state.day.outfit === 'bus' && special;
  state.day.outfit = toSpecial ? special.id : 'bus';
  save();
  render();
  toast(toSpecial ? `今天换上${special.name}` : '换回基础巴士');
}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function save() {
  if (!state.day.tasks.some(t => t.status === 'onboard')) state.day.driving = false;
  M.archive(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('浏览器未能保存，请保持页面打开'); }
}
function syncAssessment() {
  draft = state.day.capacity;
  ratings = [...state.day.ratings];
}
function syncDay() {
  if (!M.rollover(state)) return false;
  syncAssessment();
  save();
  return true;
}
function act(type, params = {}) {
  const rolledOver = syncDay();
  const {capacity, outfit} = state.day;
  try {
    M.action(state, type, type === 'assess' ? {capacity: draft, ratings} : params);
  } catch (error) {
    if (rolledOver) render();
    if (type === 'board' && error.message === '今天的座位不够啦，可以换一组乘客，或再接一程') {
      const remaining = state.day.capacity - M.used(state.day);
      toast(remaining ? `今天还剩 ${remaining} 座，坐不下这一组乘客。` : `今天的 ${state.day.capacity} 个座位已用完，这组乘客可以先留在站台。`);
    } else {
      toast(error.message);
    }
    if (typeof Sound !== 'undefined') Sound.play('error');
    return;
  }
  if (typeof Sound !== 'undefined') {
    Sound.play({start: 'depart', end: 'end', done: 'done', board: 'board',
      add: 'pop', edit: 'pop', assess: 'pop', reopen: 'board', reset: 'tap'}[type] || 'tap');
  }
  if (type === 'assess' || type === 'add' || type === 'edit') page = 'tasks';
  if (type === 'start' || type === 'end') page = 'run';
  if (type === 'reset') {
    state.day.outfit = outfit;
    page = 'assess';
    syncAssessment();
  }
  if (type === 'add' || type === 'edit') $('task-dialog').close();
  state.day.outfit = displayedOutfit().id;
  save();
  render();
  if (type === 'done') {
    const finished = state.day.tasks.find(t => t.id === params.id);
    if (finished) paxLastTask = finished.title;
    sayBubble(pickPaxLine('done'));
  }
  if (type === 'start') sayBubble(pickPaxLine('depart'));
  if (type === 'end') sayBubble(pickPaxLine('end'));
}
function restoreOutfit() {
  if (state.day.outfit === 'bike') state.day.outfit = 'cart';
  if (state.day.outfit === 'tram3') state.day.outfit = 'train';
  if (!outfits.some(o => o.id === state.day.outfit)) state.day.outfit = 'bus';
  state.day.outfit = displayedOutfit().id;
}

function passengerCount(status) {
  return state.day.tasks.filter(t => t.status === status).reduce((sum, t) => sum + t.load, 0);
}

function seats(n) {
  const done = passengerCount('done');
  const on = passengerCount('onboard');
  return Array.from({length: n}, (_, i) => {
    const status = i < done ? 'done' : i < done + on ? 'onboard' : '';
    const label = status === 'done' ? '已送达' : status === 'onboard' ? '已上车' : '空座';
    return `<span class="seat ${status}" aria-label="座位 ${i + 1}：${label}"></span>`;
  }).join('');
}

function seatGrid(n) {
  return `<div class="seat-grid" style="--seat-count:${n};--seat-size:${n > 16 ? 14 : 18}px">${seats(n)}</div>`;
}

const PASSENGER_ATLAS = [2172, 724];
// Visible bounds of the six full figures in the atlas.
const PASSENGER_BOUNDS = [
  [129, 212, 354, 571],
  [450, 190, 696, 571],
  [782, 158, 1030, 571],
  [1127, 201, 1366, 571],
  [1462, 190, 1708, 570],
  [1797, 158, 2051, 571]
];
const FIG_H_RATIO = 0.86;

function croppedImage(src, alt, classes, [sourceW, sourceH], [x, y, width, height]) {
  return `<img class="${classes}" src="${src}" alt="${alt}"
    style="width:${sourceW / width * 100}%;height:${sourceH / height * 100}%;left:${-x / width * 100}%;top:${-y / height * 100}%;object-fit:contain;object-position:left top">`;
}

function seatedPassengers(slots, crop, clipSeats = false) {
  const [x, y, width, height] = crop;
  const seats = slots.slice(0, passengerCount('onboard'));
  const ratios = PASSENGER_BOUNDS.map(([l, t2, r, b]) => ({figW: r - l, figH: b - t2}));
  if (clipSeats) {
    // 舷窗模式：人放大 2.2 倍，只露头肩，四周都被窗框裁掉
    const SCALE = 2.0;
    return seats.map(([wx, wy, ww, wh], i) => {
      const variant = i % ratios.length;
      const {figW, figH} = ratios[variant];
      const [sheetW, sheetH] = PASSENGER_ATLAS;
      const positionX = PASSENGER_BOUNDS[variant][0] / (sheetW - figW) * 100;
      const positionY = PASSENGER_BOUNDS[variant][1] / (sheetH - figH) * 100;
      return `<div class="pax-cell" style="left:${(wx - x) / width * 100}%;top:${(wy - y) / height * 100}%;width:${ww / width * 100}%;height:${wh / height * 100}%">
        <div class="passenger-anchor" style="left:50%;top:1%;height:${SCALE * 100}%;aspect-ratio:${figW}/${figH};--seat-occlusion:0%">
          <div class="seated-person" role="img" aria-label="第 ${i + 1} 位乘客">
            <i class="tiny-pax v${variant}" style="background-size:${sheetW / figW * 100}% ${sheetH / figH * 100}%;background-position:${positionX}% ${positionY}%"></i>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  // 同一辆车里的人必须一样大：先算每个座位的可行身高，取最小值统一使用
  const fitHeight = (ww, wh, hidden, variant) => {
    const {figW, figH} = ratios[variant];
    return Math.min(wh * FIG_H_RATIO / (1 - hidden), ww * figH / figW);
  };
  const uniform = Math.min(...seats.map(([wx, wy, ww, wh, hidden = 0.16], i) =>
    fitHeight(ww, wh, hidden, i % ratios.length)));
  return seats.map(([wx, wy, ww, wh, hidden = 0.16, forward = 0], i) => {
    const variant = i % PASSENGER_BOUNDS.length;
    const {figW, figH} = ratios[variant];
    const figureHeight = uniform;
    const figureWidth = figureHeight * figW / figH;
    const offset = Math.min(ww * forward, (ww - figureWidth) / 2);
    const center = wx + ww / 2 + offset - x;
    // Place the clipping edge at the measured cushion or lower window edge.
    const bottom = height - (wy + wh + figureHeight * hidden - y);
    const [sheetW, sheetH] = PASSENGER_ATLAS;
    const positionX = PASSENGER_BOUNDS[variant][0] / (sheetW - figW) * 100;
    const positionY = PASSENGER_BOUNDS[variant][1] / (sheetH - figH) * 100;
    return `<div class="passenger-anchor"
      style="left:${center / width * 100}%;height:${figureHeight / height * 100}%;bottom:${bottom / height * 100}%;aspect-ratio:${figW}/${figH};--seat-occlusion:${hidden * 100}%">
      <div class="seated-person" role="img" aria-label="第 ${i + 1} 位乘客">
        <i class="tiny-pax v${variant}" style="background-size:${sheetW / figW * 100}% ${sheetH / figH * 100}%;background-position:${positionX}% ${positionY}%"></i>
      </div>
    </div>`;
  }).join('');
}

function vehicleArt(src, label, classes, art) {
  const [left, top, right, bottom] = art.bounds;
  const crop = [left, top, right - left, bottom - top];
  return {
    crop,
    style: `--art-w:${art.displayWidth}px;aspect-ratio:${crop[2]}/${crop[3]}`,
    img: croppedImage(src, label, classes, art.size, crop)
  };
}

function artPosition(x, y, [left, top, width, height]) {
  return `left:${(x - left) / width * 100}%;top:${(y - top) / height * 100}%`;
}

function wheelArcs(wheels, crop, period) {
  return `<div class="wheel-arcs" aria-hidden="true" style="--wheel-period:calc(${period}s / 3)">
    ${wheels.map(([x, y, diameter]) => `<i class="wheel-arc"
      style="${artPosition(x, y, crop)};width:${diameter * 0.9 / crop[2] * 100}%"></i>`).join('')}
  </div>`;
}

// 巴士素材已逐张裁剪到车身，几何按裁剪比例换算
const BUS_SCALE = {"2":{"w":760,"h":535,"scale":0.895171,"ox":460,"oy":190},"3":{"w":760,"h":459,"scale":0.764588,"ox":388,"oy":187},"4":{"w":760,"h":389,"scale":0.650128,"ox":297,"oy":187},"5":{"w":760,"h":321,"scale":0.537863,"ox":261,"oy":154},"6":{"w":760,"h":268,"scale":0.49576,"ox":277,"oy":160},"7":{"w":760,"h":243,"scale":0.437788,"ox":246,"oy":139},"8":{"w":760,"h":231,"scale":0.435031,"ox":211,"oy":144},"9":{"w":760,"h":458,"scale":0.606061,"ox":287,"oy":99},"10":{"w":760,"h":471,"scale":0.621423,"ox":296,"oy":93},"11":{"w":760,"h":417,"scale":0.584615,"ox":288,"oy":91},"12":{"w":760,"h":407,"scale":0.55313,"ox":213,"oy":110},"13":{"w":760,"h":395,"scale":0.538244,"ox":186,"oy":107},"14":{"w":760,"h":385,"scale":0.545585,"ox":196,"oy":114},"15":{"w":760,"h":353,"scale":0.511096,"ox":208,"oy":95},"16":{"w":760,"h":335,"scale":0.482234,"ox":214,"oy":78},"17":{"w":760,"h":281,"scale":0.413943,"ox":133,"oy":77},"18":{"w":760,"h":287,"scale":0.463415,"ox":268,"oy":82},"19":{"w":760,"h":259,"scale":0.415755,"ox":197,"oy":81},"20":{"w":760,"h":223,"scale":0.35514,"ox":0,"oy":80}};
// 20 座是重新生成的图：上层 10 + 下层 10，坐标实测
const BUS20 = {
  width: 760, height: 223, bounds: [0, 0, 760, 223],
  windows: [[122.5, 33.0, 40.8, 36.2], [122.5, 101.6, 40.8, 36.9], [176.1, 33.0, 40.8, 36.2], [176.1, 101.6, 40.8, 37.3], [229.8, 33.0, 40.8, 36.6], [229.8, 101.6, 40.8, 37.3], [283.4, 33.0, 40.8, 36.2], [283.4, 101.6, 40.8, 36.9], [337.0, 33.4, 40.1, 36.2], [337.0, 101.6, 40.1, 37.3], [390.3, 33.0, 40.1, 36.6], [390.3, 101.6, 40.1, 36.9], [443.6, 33.0, 40.5, 36.2], [443.6, 101.6, 40.5, 36.9], [496.8, 33.0, 40.5, 36.6], [496.8, 101.6, 40.1, 37.3], [550.1, 33.0, 40.5, 36.6], [550.1, 101.6, 40.5, 36.9], [603.7, 33.0, 40.1, 36.6], [603.7, 101.6, 40.1, 36.9]],
  wheels: [[122.8, 194.1, 22], [648.1, 194.1, 21]]
};

function busGeometry(n) {
  if (n === 20) return BUS20;
  const f = window.FLEET[n];
  const {w, h, scale, ox, oy} = BUS_SCALE[n];
  const map = ([x, y, ...rest]) => [x * scale - ox * scale, y * scale - oy * scale,
    ...rest.map(v => (typeof v === 'number' ? v * scale : v))];
  return {
    width: w, height: h, bounds: [0, 0, w, h],
    windows: f.windows.map(map),
    wheels: (f.wheels || []).map(map)
  };
}

function brainVehicle(n, preview = false) {
  const key = `bus-${String(n).padStart(2, '0')}`;
  const {width, height, windows, bounds, wheels} = busGeometry(n);
  const meta = BUS_SCALE[n];
  const displayWidth = n === 20 ? 291 : (meta.w / meta.scale) / window.FLEET[n].windowWidth * (291 * 114 / 1932);
  const art = {size: [width, height], bounds, displayWidth};
  const src = `assets/fleet/${key}.png`;
  const {style, img, crop} = vehicleArt(src, `${n} 座巴士`, 'fleet-art native-art', art);
  return `<div class="native-bus${n >= 9 ? ' double-decker' : ''}" data-vehicle="bus" style="${style}">
    <div class="art-crop fleet-shell native-crop">${img}</div>
    <div class="passenger-layer">${preview ? '' : seatedPassengers(windows.slice(0, n), crop)}</div>
    ${wheelArcs(wheels, crop, outfits[0].period)}
  </div>`;
}

// Atlas coordinates below are relative to the outfit's source box.
// Each rectangle ends at the visible cushion or the inside edge of the sill.
const outfitArt = {
  cart: {
    // 新板车：平整车斗；画布上留了 50px 空白，人坐着才有高度空间
    src: 'assets/fleet/cart.png', size: [255, 125],
    bounds: [0, 0, 255, 125], displayWidth: 118,
    seats: [[40, 24, 50, 48, 0.1], [96, 24, 50, 48, 0.1]]
  },
  trike: {
    // 实测座椅：靠背右缘 56/126/196/262，坐垫上表面 108；人底边压在坐垫上表面
    src: 'assets/fleet/trike.png', size: [380, 191],
    bounds: [0, 0, 380, 191], displayWidth: 152,
    seats: [[55, 76, 32, 32, 0.2], [125, 76, 32, 32, 0.2],
      [194, 76, 32, 32, 0.2], [259, 76, 32, 32, 0.2]]
  },
  car: {
    // 去掉多余车轮的版本，六扇窗坐标已换算
    src: 'assets/fleet/car.png', size: [465, 166],
    bounds: [0, 0, 465, 166], displayWidth: 186,
    mask: 76.8 / 166,
    seats: [[71.2, 35, 33.2, 55, 0], [116.9, 35, 33.2, 55, 0], [162, 35, 32.5, 55, 0], [207.7, 35, 31.7, 55, 0], [252.7, 35, 32.5, 55, 0], [295.5, 35, 39.1, 55, 0]]
  },
  truck: {
    // 新版带 10 个靠背的货车；底边压在木栏上沿，被栏杆挡住
    src: 'assets/fleet/truck.png', size: [600, 160],
    bounds: [0, 0, 600, 160], displayWidth: 240,
    mask: 70 / 160,
    seats: [[30.1, 22, 36, 64, 0], [71.3, 22, 36, 64, 0], [112.5, 22, 36, 64, 0], [153.7, 22, 36, 64, 0], [194.9, 22, 36, 64, 0], [236.1, 22, 36, 64, 0], [277.3, 22, 36, 64, 0], [318.5, 22, 36, 64, 0], [359.7, 22, 36, 64, 0], [400.9, 22, 36, 64, 0]]
  },
  tram: {
    // 和巴士同一套做法：玻璃区就是座位框，底部 16% 收在坐垫后面
    src: 'assets/fleet/tram.png', size: [710, 143],
    bounds: [0, 0, 710, 143], displayWidth: 284,
    seats: [[54, 60, 27, 28], [94, 60, 27, 28], [134, 60, 26, 28], [171, 60, 27, 28], [211, 60, 27, 28], [249, 60, 27, 28], [290, 60, 27, 28], [371, 60, 27, 28], [412, 60, 28, 28], [453, 60, 27, 28], [494, 60, 26, 28], [532, 60, 26, 28], [572, 60, 25, 28], [608, 60, 27, 28]]
  },
  train: {
    src: 'assets/fleet/train.png', size: [760, 131],
    bounds: [0, 0, 760, 131], displayWidth: 304,
    seats: [[19.3, 32.8, 251.2, 55.3], [299.5, 32.8, 251.2, 55.3]]
  },
  plane: {
    // 舷窗实测 y 98–119；人底边与窗框下沿对齐
    src: 'assets/fleet/plane.png', size: [845, 226],
    bounds: [0, 0, 845, 226], displayWidth: 338,
    clipSeats: true,
    seats: [[132, 98, 13, 21, 0], [161, 98, 12, 21, 0], [191, 98, 11, 21, 0], [220, 98, 15, 21, 0], [250, 98, 14, 21, 0], [280, 98, 12, 21, 0], [310, 98, 12, 21, 0], [340, 98, 13, 21, 0], [368, 98, 14, 21, 0], [398, 98, 14, 21, 0], [427, 98, 15, 21, 0], [457, 98, 12, 21, 0], [486, 98, 14, 21, 0], [515, 98, 14, 21, 0], [545, 98, 14, 21, 0], [575, 98, 12, 21, 0], [604, 98, 14, 21, 0], [634, 98, 14, 21, 0], [663, 98, 14, 21, 0], [693, 98, 14, 21, 0]]
  }
};

// 素材已按显示宽度约 2.5 倍裁好，座位/轮子/特效坐标要同比缩放
const ART_SCALE = {
  cart: 0.1733514615907546, trike: 0.9245742092457421, car: 0.7416267942583732,
  truck: 1.1049723756906078, tram: 0.7395833333333334, train: 0.3863751906456533,
  plane: 1.1418918918918919
};

const outfitWheels = {
  cart: [[39, 102, 40], [140, 102, 40]],   // 板车图是 255×125，之前写的是旧图集坐标（x 798 早就出画布了）
  trike: [[130, 194, 33], [396, 194, 33]],
  car: [[93, 130, 37], [402, 130, 37]],
  truck: [[111, 130, 27], [509, 130, 28]],
  train: [
    ...[142, 374, 609, 867, 1099, 1333].map(x => [x, 296, 37]),
    [1602, 288, 51], [1713, 288, 51], [1824, 299, 33]
  ]
};

// 座位与轮子坐标按裁剪比例缩放，一次性算好
const PRE_SCALED = new Set(['train', 'truck', 'car', 'cart', 'tram', 'plane', 'trike']);   // 火车坐标已手工换算过
Object.entries(ART_SCALE).forEach(([id, s]) => {
  const art = outfitArt[id];
  if (art && !PRE_SCALED.has(id)) {
    art.seats = art.seats.map(([x, y, w, h, hidden = 0]) => [x * s, y * s, w * s, h * s, hidden]);
  }
});
Object.entries(outfitWheels).forEach(([id, list]) => {
  const s = ART_SCALE[id];
  if (s && !PRE_SCALED.has(id)) outfitWheels[id] = list.map(([x, y, d]) => [x * s, y * s, d * s]);
});

function outfitDetail(id, crop) {
  const effect = {
    cart: [0, 0, ''],
    car: [24, 140, 2],
    truck: [6, 118, 2],
    tram: [0, 0, '<i class="tram-cables"></i>'],
    train: [705, 2, 3],
    plane: [347, 196, 3],
    trike: [0, 0, '']
  }[id];
  // 已裁到车身的素材（PRE_SCALED）坐标就是裁剪空间的真实像素，不能再乘一次
  const s = PRE_SCALED.has(id) ? 1 : (ART_SCALE[id] || 1);
  const [x, y, detail] = [effect[0] * s, effect[1] * s, effect[2]];
  const pieces = typeof detail === 'number' ? '<i class="vehicle-puff"></i>'.repeat(detail) : detail;
  return `<div class="outfit-detail" aria-hidden="true" style="${artPosition(x, y, crop)}">${pieces}</div>`;
}

function divideWindow([x, y, width, height], count) {
  return Array.from({length: count}, (_, i) => [x + i * width / count, y, width / count, height]);
}

function outfitSeats(id, windows, capacity) {
  if (id === 'train') {
    return windows.flatMap((window, i) => divideWindow(window, Math.floor((capacity + 1 - i) / 2)));
  }
  if (id === 'car') {
    const shared = capacity - windows.length;
    const divided = windows.map((window, i) => i < shared ? divideWindow(window, 2) : [window]);
    // Fill every drawn seat before adding a second rider to a window.
    return [...divided.map(([seat]) => seat), ...divided.slice(0, shared).map(([, seat]) => seat)];
  }
  return windows;
}

function otherVehicle(o, capacity, preview = false) {
  const {id} = o;
  const art = outfitArt[id];
  // 素材已经裁到车身，bounds 一律从 0,0 开始，不再叠加图集偏移
  const {style, img, crop} = vehicleArt(art.src, o.name, 'fleet-art', art);
  const cropAttributes = 'class="art-crop sprite"';
  const legacyClass = {cart: ' bike', train: ' tram3'}[id] || '';
  const localCrop = crop;
  const detailCrop = crop;
  return `<div class="other-vehicle ${id}${legacyClass}" data-vehicle="${id}" style="${style}">
    <div ${cropAttributes}>${img}</div>
    <div class="outfit-passengers">${preview ? '' : seatedPassengers(
      outfitSeats(id, art.seats, capacity), localCrop, !!art.clipSeats
    )}</div>
    ${art.mask ? `<div class="vehicle-mask" style="--mask-top:${art.mask * 100}%" aria-hidden="true"><img src="${art.src}" alt=""></div>` : ''}
    ${outfitWheels[id] ? wheelArcs(outfitWheels[id], detailCrop, o.period) : ''}
    ${outfitDetail(id, detailCrop)}
  </div>`;
}

// The journey scenery is drawn in independent parallax layers.
const path = (d, color = 'ink') => `<path class="" d="${d}" fill="var(--${color})"/>`;
const rect = (x, y, w, h, color) =>
  `<rect class="" x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--${color})"/>`;

function displayedOutfit() {
  const {outfit, capacity} = state.day;
  return outfits.find(o => o.id === outfit && capacity >= o.min && capacity <= o.max) || outfits[0];
}

function hasArrived(day) {
  return day.tasks.some(t => t.status === 'done') && !day.tasks.some(t => t.status === 'onboard');
}

function terminalScenery() {
  return `<div class="scenery terminal-scenery" aria-hidden="true">
    <div class="clouds"></div>
    <div class="terminal-platform"></div>
    <div class="terminal-building">
      <div class="terminal-wall"><i></i><i></i><i></i></div>
      <div class="terminal-roof"></div>
      <div class="terminal-sign"><i class="terminal-clock"></i></div>
    </div>
  </div>`;
}

function scenery({id: outfit, period}) {
  const cloud = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">
    ${path('M0 20v-6h8V8h10V2h16v4h10v6h12v8Z', 'blue-edge')}
    ${path('M0 16v-4h8V6h10V0h16v4h10v6h12v6Z', 'paper')}
  </g>`;
  const bird = (x, y) => `<g transform="translate(${x} ${y})">
    ${path('M0 0h4v2h2v2h2V2h2V0h4v2h-2v2h-2v2H8v2H6V6H4V4H2V2H0Z', 'ink')}
  </g>`;
  // 树按“底边贴地”摆放：先定比例 s，再把它推到地线 y=70 上，避免有的树悬空
  const tree = (x, s, color, edge) => {
    const baseY = 70 - 48 * s;
    return `<g transform="translate(${x} ${baseY}) scale(${s})">
    ${rect(14, 28, 6, 20, 'trunk')}
    ${path('M0 28v-8h4v-8h6V6h6V0h6v6h6v6h6v8h4v8h-6v6H6v-6Z', edge)}
    ${path('M4 24v-4h4v-8h6V6h8v6h6v8h4v4h-6v4H10v-4Z', color)}
  </g>`;
  };
  const flower = (x, y, color) => `<g transform="translate(${x} ${y})">
    ${path('M4 16V8h2v2h4v4H6v2Z', 'green-edge')}
    ${path('M4 0h4v2h4v4H8v4H4V6H0V2h4Z', color)}
    ${rect(4, 4, 4, 2, 'paper')}
  </g>`;
  const dirt = ['cart', 'trike', 'car', 'truck'].includes(outfit);
  const layers = outfit === 'plane' ? [
    ['clouds-far', 100, cloud(0, 54, 0.65) + cloud(70, 22, 0.55) +
      cloud(137, 46, 0.8) + cloud(210, 8, 0.55) + cloud(272, 66, 0.75)],
    ['clouds', 95, cloud(13, 4) + cloud(82, 38, 0.9) + cloud(146, 9, 1.05) +
      cloud(208, 68, 0.9) + cloud(260, 37)],
    ['birds', 95, bird(78, 48) + bird(98, 61) + bird(216, 35)],
    ['air-wisps', 95, cloud(42, 61, 0.5) + cloud(240, 79, 0.55)],
    ['speed-lines', 95, rect(35, 66, 48, 2, 'blue-edge') + rect(182, 29, 32, 2, 'blue-edge')]
  ] : [
    ['clouds', 36, cloud(24, 6) + cloud(138, 0) + cloud(248, 14)],
    ['trees', 70, tree(10, 0.82, 'green', 'green-edge') + tree(52, 1, 'green', 'green-edge') +
      tree(104, 0.72, 'green', 'green-edge') + tree(150, 0.92, 'green', 'green-edge') +
      tree(206, 0.78, 'green', 'green-edge') + tree(254, 1, 'green', 'green-edge') +
      tree(300, 0.68, 'green', 'green-edge')],
    ['flowers', 24, rect(0, 10, 320, 14, 'verge') +
      Array.from({length: 10}, (_, i) => flower(4 + 32 * i, 8, i % 3 ? 'pink' : 'yellow')).join('')],
    ['road-line', 10, Array.from({length: 8}, (_, i) => dirt
      ? rect(8 + 40 * i, i % 2 ? 2 : 6, 4, 2, 'ground-mark') + rect(24 + 40 * i, i % 2 ? 7 : 3, 2, 2, 'ground-mark')
      : rect(8 + 40 * i, 4, 22, 2, 'ground-mark')).join('')]
  ];
  return `<div class="scenery" aria-hidden="true" style="--scene-period:${period}s">${layers.map(([name, height, art]) => {
    // 不拉伸：每块按 320 设计尺寸原样排，铺 4 块保证宽屏也铺满，动画每次移动一块
    const tile = `<svg viewBox="0 0 320 ${height}" shape-rendering="crispEdges">${art}</svg>`;
    return `<div class="${name}">${tile.repeat(4)}</div>`;
  }).join('')}</div>`;
}

function hero(n = state.day.capacity, variant = 'compact') {
  const d = state.day;
  const finished = d.ended ? ' finished' : '';

  if (variant === 'compact') {
    return `<section class="hero hero-compact${finished}"><div class="hero-bottom"><div class="capacity">${n}<small> 座今日运力</small></div>${seatGrid(n)}</div></section>`;
  }

  const o = displayedOutfit();
  const name = o.id === 'bus' ? (n >= 9 ? '双层巴士' : '今日小巴士') : o.name;
  const html = o.id === 'bus' ? brainVehicle(n) : otherVehicle(o, n);
  const scene = 'scene-' + o.id + ({cart: ' scene-bike', train: ' scene-tram3'}[o.id] || '');
  const vehicle = `<div class="vehicle-scroll" role="region" aria-label="车辆与乘客"><div class="vehicle-track">${html}</div></div>`;
  const used = M.used(d);
  const summary = variant === 'station'
    ? `共 ${n} 座${used ? ` · 还剩 ${n - used} 座` : ''}`
    : `已到达 ${passengerCount('done')} 位乘客 · 还剩 ${passengerCount('onboard')} 位`;
  const seatSummary = `<div class="hero-bottom">${seatGrid(n)}<div class="station-seat-counts">${summary}</div></div>`;
  if (variant === 'station') {
    return `<section class="hero hero-station${finished}">
      <div class="hero-top"><span class="badge">${name}</span></div>
      <div class="vehicle">${vehicle}</div>
      ${seatSummary}
    </section>`;
  }

  const arrived = !!d.ended;   // 只有收车后才进终点站，任务全部打钩仍继续开
  // 发车后一直动：即使本趟乘客都下车了也不停，直到收车进终点站
  const running = !arrived && (d.driving || d.tasks.some(t => t.status === 'done' || t.status === 'onboard'));
  return `<section class="hero hero-journey${finished}">
    <div class="hero-top"><span class="badge">${name}</span><small>${d.ended ? '已到站 · 已收车' : running ? '行驶中' : '已停稳'}</small></div>
    <div class="vehicle ${running ? 'running' : ''} ${scene}">
      ${arrived ? terminalScenery() : scenery(o)}
      <div id="pax-message" class="pax-message" hidden></div>
      ${vehicle}
    </div>
    ${seatSummary}
  </section>`;
}
const pages = [
  ['assess', '今日评估', '按今天的状态，做好准备。', [179, 338, 885, 607], 'assets/logo.png'],
  ['tasks', '候车站台', '把要做的事，请上车。', [363, 45, 109, 170]],
  ['run', '旅程进行', '先完成眼前这一小段。', [492, 59, 143, 145]],
  ['me', '我的记录', '不用坐满，也是好旅程。', [657, 59, 113, 143]]
];
function nav() {
  $('nav').innerHTML = pages.map(([id, name, , crop, src]) => {
    const glyph = id === 'assess' ? icon('brain') : squareIcon(crop, src);
    return `<button class="${page === id ? 'active' : ''}" data-page="${id}" data-label="${name}" aria-label="${name}"${page === id ? ' aria-current="page"' : ''}>${glyph}</button>`;
  }).join('');
  const [, , guide] = pages.find(([id]) => id === page);
  document.querySelector('.page-guide').textContent = guide;
}
function ratingStatus(value) {
  return value < 35 ? '需要照顾' : value < 70 ? '还不错' : '状态很好';
}

function assess() {
  return `<div class="assessment">
    ${['睡眠质量', '身体精力', '主观心情'].map((label, i) => `<div class="rating">
      <label for="rating-${i}">${icon(['sleep', 'energy', 'mood'][i])}${label}</label>
      <input id="rating-${i}" data-rating="${i}" type="range" min="0" max="100" value="${ratings[i]}">
      <output for="rating-${i}"><b>${ratings[i]}</b><span>${ratingStatus(ratings[i])}</span></output>
    </div>`).join('')}
  </div>
  <div class="actions">
    <div class="capacity-adjust">
      <label for="capacity">微调<br>座位</label>
      <button type="button" class="capacity-step" data-step="-1" aria-label="减少一座">−</button>
      <input id="capacity" type="number" min="2" max="20" step="1" value="${draft}" aria-label="今日座位数（座）">
      <button type="button" class="capacity-step" data-step="1" aria-label="增加一座">＋</button>
    </div>
    <button class="primary" data-action="assess">${state.day.assessed ? '更新今日运力' : '确认今日运力'} ${icon('play')}</button>
  </div>
  ${state.day.ended ? '<div class="notice">今天已收车。<button class="quiet" data-action="reopen">继续今天</button></div>' : ''}
  ${hero(draft)}`;
}
const taskButtons = {
  board: ['上车', 'up', ''],
  leave: ['回站台', 'down', ''],
  edit: ['编辑', 'edit', 'quiet'],
  delete: ['删除', 'close', 'quiet'],
  done: ['到站完成', 'check', 'primary'],
  undo: ['撤销完成', 'reset', 'quiet']
};
const taskIconCrops = {
  edit: [178, 410, 132, 132],
  close: [488, 422, 114, 114],
  check: [946, 250, 132, 132],
  reset: [1088, 413, 134, 134]
};
function taskButton(action, id, title) {
  const [label, symbol, classes] = taskButtons[action];
  const attrs = action === 'edit' ? `data-edit="${id}"` : `data-action="${action}" data-id="${id}"`;
  const art = symbol === 'up' || symbol === 'down'
    ? `<svg class="task-arrow ${symbol}" aria-hidden="true" viewBox="0 0 18 18" shape-rendering="crispEdges">
        <path d="M8 2h2v2h2v2h2v2h2v2h-4v6H6v-6H2V8h2V6h2V4h2Z" fill="var(--blue)"/>
        <path d="M8 0h2v2h2v2h2v2h2v2h2v4h-6v6H6v-6H0V8h2V6h2V4h2V2h2Zm0 4v2H6v2H4v2h4v6h2v-6h4V8h-2V6h-2V4Z" fill="var(--ink)" fill-rule="evenodd"/>
      </svg>`
    : kitIcon(...taskIconCrops[symbol]);
  return `<button class="${classes}" ${attrs} aria-label="${label} ${title}" title="${label}">${art}</button>`;
}
function task(t) {
  const title = escapeHTML(t.title);
  const actions = {
    waiting: ['board', 'edit', 'delete'],
    onboard: [page === 'run' ? 'done' : 'leave'],
    done: ['undo']
  }[t.status];
  return `<article class="task">
    <div class="task-copy"><strong title="${title}">${title}</strong></div>
    <div class="load-badge" role="img" aria-label="${t.load} 位乘客">${'<i class="pax-mini" aria-hidden="true"></i>'.repeat(t.load)}</div>
    <div class="task-actions">${actions.map(action => taskButton(action, t.id, title)).join('')}</div>
  </article>`;
}
function group(status, title) {
  const a = state.day.tasks.filter(t => t.status === status);
  const empty = {waiting: '站台还空着', onboard: '还没有乘客上车', done: '还没有乘客到站'}[status];
  return `<section class="section"><div class="section-heading"><h3>${title}</h3><small>${a.length} 件事 · ${a.reduce((s,t)=>s+t.load,0)} 位乘客</small></div><div class="task-list">${a.length ? a.map(task).join('') : `<div class="empty${status === 'waiting' ? ' station-empty' : ''}">${empty}</div>`}</div></section>`;
}
function tasks() {
  return `${hero(state.day.capacity, 'station')}
  <div class="actions station-departure">
    <button class="secondary" data-new>${squareIcon([24, 410, 140, 140])}<span>添加待办</span></button>
    <button class="primary" data-action="start">${squareIcon([678, 244, 113, 133])}<span>准备发车</span></button>
    <button id="wardrobe" class="tertiary">${squareIcon([935, 45, 155, 170])}<span>${state.day.outfit === 'bus' ? '换个载具' : '换回巴士'}</span></button>
  </div>
  <div class="task-scroll" tabindex="0" role="region" aria-label="站台任务">
    ${group('onboard', '已上车')}
    ${group('waiting', '在等车')}
  </div>`;
}
function run() {
  const d = state.day;
  const on = d.tasks.some(t => t.status === 'onboard');
  const waiting = d.tasks.filter(t => t.status === 'waiting').length;
  return `${hero(d.capacity, 'journey')}
    ${d.ended ? `<div class="big-copy"><h2>今天就到这里，辛苦了。</h2><p class="muted">${waiting ? `还有 ${waiting} 件事留在站台，也没关系。` : '给自己留一点安静的时间。'}</p><div class="actions actions-pair"><button data-page="tasks">返回站台</button><button class="primary" data-action="reopen">继续今天</button></div></div>`
    : hasArrived(d) ? `<div class="notice"><h2>本趟乘客，平安到站。</h2><p>${waiting ? `站台还有 ${waiting} 件事，可以继续安排，也可以今天收车。` : '今天安排的乘客都已送达。'}</p></div>`
    : !on ? '<div class="big-copy"><h2>不着急，准备好了再出发。</h2></div>'
    : ''}
    ${d.ended ? '' : '<div class="actions"><button data-page="tasks">返回站台</button><button class="primary" data-action="end">今天收车</button></div>'}
    <div class="task-scroll" tabindex="0" role="region" aria-label="旅程任务">
      ${on ? group('onboard', '这一程的乘客') : ''}
      ${group('done', '已送达')}
    </div>`;
}
function me() {
  const d = state.day;
  const history = Object.entries(state.history).sort(([a], [b]) => a.localeCompare(b));
  const totals = history.reduce((sum, [, record]) => ({
    load: sum.load + record.load,
    trips: sum.trips + record.trips
  }), {load: 0, trips: 0});
  const stats = [
    ['seat', d.capacity, '今日总座位'],
    ['check', d.tasks.filter(t => t.status === 'done').length, '今日完成的事'],
    ['person', totals.load, '累计送达乘客']
  ];
  const days = history.filter(([, record]) => record.assessed).slice(-14);
  const bars = days.map(([date, record]) =>
    `<div class="bar" style="height:${record.capacity / 20 * 100}%"><b>${record.capacity}</b><span>${date.slice(5).replace('-', '/')}</span></div>`
  ).join('');
  return `
    <section class="hero hero-compact record-hero">
      <div class="stats">${stats.map(([ic, value, label]) => `<div class="stat">${icon(ic)}<b>${value}</b><small>${label}</small></div>`).join('')}</div>
    </section>
    <section class="section">
      <div class="section-heading"><h3>近 14 天 · 运力记录</h3><small>每天只记一条</small></div>
      <div class="trend">${bars || '<p class="muted">完成一次评估，开始记录。</p>'}</div>
    </section>
    <div class="notice">累计发车 ${totals.trips} 次。</div>
    <section class="section">
      <div class="section-heading"><h3>设置</h3><small>只存在这台设备</small></div>
      <div class="actions"><button data-action="reset">${icon('reset')} 重新评估</button><small>清空今日任务，保留历史与累计记录。</small></div>
      <div class="sound-row">
        <button class="sound-toggle" data-sound aria-pressed="${typeof Sound !== 'undefined' && Sound.enabled}">
          <img class="icon" src="assets/icons/${typeof Sound !== 'undefined' && Sound.enabled ? 'sound-on' : 'mute'}.png" alt="">
          <span>音乐音量</span>
        </button>
        <input class="music-slider" type="range" min="0" max="100" step="5"
          value="${typeof Sound !== 'undefined' ? Sound.musicVolume : 60}"
          aria-label="音乐音量" oninput="Sound.setMusicVolume(this.value)">
      </div>
    </section>`;
}
function render() {
  syncDay();
  nav();
  if (typeof Sound !== 'undefined') {
    Sound.setStage(page === 'tasks' ? 'station' : page === 'run' ? 'run' : page === 'me' ? 'me' : 'assess');
  }
  $('date').textContent = state.day.date;
  const content = $('content');
  const scrollTop = content.classList.contains('page-' + page) ? content.querySelector('.task-scroll')?.scrollTop : 0;
  content.classList.remove('page-assess', 'page-tasks', 'page-run', 'page-me');
  content.classList.add('page-' + page);
  content.innerHTML = ({assess, tasks, run, me}[page])();
  if (scrollTop) content.querySelector('.task-scroll').scrollTop = scrollTop;
  if (page === 'me') requestAnimationFrame(fitTrendLabels);
}
// 日期标签：先都横排，检查是否互相压住，压住就整体转竖排
function fitTrendLabels() {
  const trend = document.querySelector('.trend');
  if (!trend) return;
  trend.classList.remove('vertical');
  const labels = [...trend.querySelectorAll('.bar span')];
  if (labels.length < 2) return;
  let crowded = false;
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].getBoundingClientRect().left < labels[i - 1].getBoundingClientRect().right - 0.5) {
      crowded = true;
      break;
    }
  }
  trend.classList.toggle('vertical', crowded);
}

function showTitleError(show) {
  $('task-title-error').hidden = !show;
  $('task-title').setAttribute('aria-invalid', String(show));
}
function openTask(id) {
  editId = id || null;
  const task = state.day.tasks.find(t => t.id === id);
  load = task?.load || 1;
  $('task-title').value = task?.title || '';
  showTitleError(false);
  drawDifficulty();
  $('task-dialog').showModal();
  $('task-title').focus();
}
function drawDifficulty() {
  $('difficulty').querySelectorAll('button').forEach(button => {
    const selected = Number(button.dataset.load) === load;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected);
  });
}

const actionCopy = {
  end: ['今天收车？', '未完成的事会留在站台，可以随时继续今天。', '再想想', '今天收车'],
  reset: ['重新评估？', '清空今天的任务并重新评估，历史与累计记录保留。', '取消', '确认']
};
function openActionDialog(action) {
  const [title, copy, cancel, accept] = actionCopy[action];
  $('action-title').textContent = title;
  $('action-copy').textContent = copy;
  $('action-cancel').textContent = cancel;
  $('action-accept').textContent = accept;
  const dialog = $('action-dialog');
  $('action-accept').onclick = () => {
    dialog.close();
    act(action);
    const next = action === 'end' ? '[data-action="reopen"]' : '#rating-0';
    document.querySelector(next)?.focus();
  };
  dialog.showModal();
  $('action-cancel').focus();
}
$('action-cancel').onclick = () => $('action-dialog').close();
for (const dialog of [$('action-dialog')]) {
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const {left, right, top, bottom} = dialog.getBoundingClientRect();
    if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) dialog.close();
  });
}

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button) return;
  const {page: targetPage, edit, load: targetLoad, outfit, action, id, step} = button.dataset;
  if ('sound' in button.dataset) {
    if (typeof Sound !== 'undefined') Sound.toggle();
    render();
    return;
  }
  if (targetPage) {
    if (typeof Sound !== 'undefined') Sound.play('nav');
    page = targetPage;
    render();
  }
  if ('new' in button.dataset) openTask();
  if (edit) openTask(edit);
  if (targetLoad) {
    load = Number(targetLoad);
    drawDifficulty();
  }
  if (button.id === 'wardrobe') toggleRide();
  if (step) {
    if (syncDay()) {
      render();
      return;
    }
    const input = $('capacity');
    draft = Math.max(Number(input.min), Math.min(Number(input.max), draft + Number(step)));
    refreshAssess();
  }
  if (action) {
    // 防手抖连点：同一个动作 400ms 内只执行一次
    const key = action + ':' + (id || '');
    const now = Date.now();
    if (act.lastKey === key && now - act.lastAt < 400) return;
    act.lastKey = key;
    act.lastAt = now;
    const pending = state.day.tasks.some(t => t.status !== 'done');
    if (action === 'end' && !pending) { act('end'); render(); if (page === 'run') page = 'run'; return; }
    if (Object.hasOwn(actionCopy, action)) openActionDialog(action);
    else act(action, {id});
  }
});
document.addEventListener('input', e => {
  const {id, dataset, value} = e.target;
  if (id === 'task-title' && value.trim()) showTitleError(false);
  if (id !== 'capacity' && dataset.rating === undefined) return;
  if (syncDay()) {
    render();
    return;
  }
  if (id === 'capacity') {
    if (!e.target.validity.valid || value === '') return;
    draft = Number(value);
  } else {
    ratings[Number(dataset.rating)] = Number(value);
    draft = Math.round(2 + ratings.reduce((a, b) => a + b, 0) / 300 * 18);
  }
  refreshAssess();
});
document.addEventListener('focusout', e => {
  if (e.target.id === 'capacity') e.target.value = draft;
});
function refreshAssess() {
  document.querySelector('.hero').outerHTML = hero(draft);
  $('capacity').value = draft;
  ratings.forEach((value, i) => {
    const output = document.querySelector('#rating-' + i + ' + output');
    output.querySelector('b').textContent = value;
    output.querySelector('span').textContent = ratingStatus(value);
  });
}
$('task-form').onsubmit = e => {
  e.preventDefault();
  const input = $('task-title');
  const title = input.value.trim();
  if (!title) {
    showTitleError(true);
    input.focus();
    return;
  }
  act(editId ? 'edit' : 'add', {id: editId, title, load, urgency: 'normal'});
};
function refreshDay() {
  if (syncDay()) render();
}
window.addEventListener('focus', refreshDay);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshDay();
});
restoreOutfit();
save();
render();

// 乘客语料：按场景分组，{vehicle} {task} {onboard} {waiting} {left} 会被真实数据替换
const PAX_LINES = {
  depart: [
    '{vehicle}要出发了，都坐稳。',
    '今天坐 {vehicle}，慢慢开就好。',
    '{onboard} 位乘客都上车了，走吧。',
    '不着急，先把这一趟开完。',
    '{task}坐好啦，可以走了。',
    '路线不长，走一步算一步。'
  ],
  cruise: [
    '窗外的云，慢慢走也很好。',
    '{vehicle}开得很稳，{task}还有一小段。',
    '师傅不用赶，我们都在车上。',
    '先完成眼前这一小段吧。',
    '路边有小花，你看到了吗？',
    '今天的风不吵，适合做点事。',
    '{task}这站不远，再开一会儿。',
    '还有 {onboard} 位乘客坐在车上。',
    '累了就靠一会儿，座位给你留着。',
    '车不赶时间，你也可以不赶。',
    '这一趟不需要完美，开到就算。',
    '{vehicle}的轮子转得很轻。',
    '有人在车上打盹，别叫醒他。',
    '路还长，但不用一次走完。'
  ],
  done: [
    '{task}到站了，谢谢你。',
    '{task}下车啦，路上小心。',
    '{task}这一程到了，歇一下吧。',
    '{task}送到了，车里轻了一点。',
    '又送走一位，{task}到站了。',
    '{task}到站，剩下的不急。'
  ],
  allDone: [
    '乘客都到站了，还想再开一段吗？',
    '车上空了，{vehicle}还在慢慢走。',
    '今天该做的都做完了，收车也行。',
    '都送到啦，剩下的时间归你。',
    '空车也很好，就当兜风。'
  ],
  end: [
    '今天就到这里，辛苦了。',
    '{vehicle}进站了，明天见。',
    '收车啦，{onboard} 位乘客都平安。',
    '这一天开得不错，先停一停。',
    '车停好了，你也休息吧。'
  ],
  idle: [
    '站台还空着，先接几位乘客吧。',
    '不着急，想清楚了再上车。',
    '{vehicle}在等，你也在等。',
    '今天想做点什么？先写一件也行。'
  ]
};

let paxRecent = [];

function paxContext() {
  const o = displayedOutfit();
  const shortTask = title => (title && title.length > 8 ? title.slice(0, 8) + '…' : (title || ''));
  const onboard = passengerCount('onboard');
  const waiting = state.day.tasks.filter(t => t.status === 'waiting').length;
  const task = state.day.tasks.find(t => t.status === 'onboard')?.title
    || state.day.tasks.find(t => t.status === 'waiting')?.title || '';
  return {
    // 跟车卡上的名字保持一致
    vehicle: o.id === 'bus' ? (state.day.capacity >= 9 ? '双层巴士' : '今日小巴士') : o.name,
    onboard,
    waiting,
    left: Math.max(0, state.day.capacity - onboard),
    task: shortTask(task)
  };
}

let paxLastTask = '';

function pickPaxLine(kind) {
  const ctx = paxContext();
  if (kind === 'done' && paxLastTask) {
    ctx.task = paxLastTask.length > 8 ? paxLastTask.slice(0, 8) + '…' : paxLastTask;
  }
  let pool = PAX_LINES[kind] || PAX_LINES.cruise;
  // 没有任务名 / 没有乘客时，去掉对应句子，避免说出空白或怪话
  if (!ctx.task) pool = pool.filter(line => !line.includes('{task}'));
  if (!ctx.onboard) pool = pool.filter(line => !line.includes('{onboard}'));
  if (!pool.length) pool = PAX_LINES.cruise;
  const fresh = pool.filter(line => !paxRecent.includes(line));
  const line = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
  paxRecent.push(line);
  if (paxRecent.length > 6) paxRecent.shift();
  return line
    .replace(/\{vehicle\}/g, ctx.vehicle)
    .replace(/\{task\}/g, ctx.task)
    .replace(/\{onboard\}/g, ctx.onboard)
    .replace(/\{waiting\}/g, ctx.waiting)
    .replace(/\{left\}/g, ctx.left);
}

function sayBubble(text) {
  const el = $('pax-message');
  if (!el || !text) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(sayBubble.timer);
  sayBubble.timer = setTimeout(() => {
    if (el.isConnected) el.hidden = true;
  }, 4200);
}

// 旅程页每隔一阵说一句：乘客都在就聊路上，空车就聊收车
function passengerTalk() {
  if (page === 'run' && !state.day.ended) {
    const anyOnboard = state.day.tasks.some(t => t.status === 'onboard');
    const allDone = state.day.tasks.length && state.day.tasks.every(t => t.status === 'done');
    sayBubble(pickPaxLine(allDone ? 'allDone' : anyOnboard ? 'cruise' : 'idle'));
  }
  setTimeout(passengerTalk, 7000 + Math.random() * 5000);
}
setTimeout(passengerTalk, 5000);
