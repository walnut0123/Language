// Compact study notes. Structural decomposition is never presented as an invented etymology.
const fs = require('node:fs');
const path = require('node:path');
const aliases = {
  '氵':'水', '氺':'水', '扌':'手', '忄':'心', '亻':'人', '艹':'艸', '灬':'火', '衤':'衣', '礻':'示', '飠':'食', '讠':'言', '钅':'金', '糹':'糸', '糸':'糸', '釒':'金', '阝':'阜', '刂':'刀', '⺼':'肉', '⺮':'竹', '爫':'爪', '⺈':'刀', '⺊':'卜', '⺌':'小', '⺍':'小', '罒':'网', '耂':'老', '⺤':'爪', '⺧':'牛', '⺶':'羊', '⺷':'羊', '丬':'爿', '⻊':'足', '⺀':'冫', '⺗':'心', '⺝':'月', '⺳':'网', '⻂':'衣', '⻌':'辶', '⻍':'辶', '辶':'辶', '艹':'艸', '靑':'青',
  '买':'買', '亚':'亞', '产':'産', '从':'從', '兑':'兌', '关':'關', '冝':'宜', '刍':'芻', '务':'務', '劵':'券', '匀':'勻', '吕':'呂', '吴':'吳', '囱':'囪', '复':'復', '娄':'婁', '巩':'鞏', '带':'帶', '并':'幷', '开':'開', '录':'錄', '彥':'彦', '戋':'戔', '户':'戶', '显':'顯', '术':'朮', '杀':'殺', '竞':'競', '贝':'貝', '鄉':'鄕', '隽':'雋', '飞':'飛', '㠯':'以', '㐬':'旒', '㐱':'鬒', '㳄':'涎'
};
const componentLabels = {
  '辶':'쉬엄쉬엄 갈 착', '宀':'집 면', '广':'집 엄', '厂':'기슭 엄', '冖':'덮을 멱', '囗':'에워쌀 위', '冂':'멀 경', '凵':'입 벌릴 감', '勹':'쌀 포', '匚':'상자 방', '匸':'감출 혜', '彳':'조금 걸을 척', '亍':'조금 걸을 촉', '夂':'뒤져 올 치', '夊':'천천히 걸을 쇠', '攵':'칠 복', '攴':'칠 복', '疒':'병들 녁', '虍':'범 호', '廴':'길게 걸을 인', '厶':'사사 사', '丷':'여덟 팔의 변형', '巛':'내 천', '廾':'두 손 받들 공', '彐':'돼지 머리 계', '彑':'돼지 머리 계', '彡':'터럭 삼', '爿':'나뭇조각 장', '罓':'그물 망', '禸':'발자국 유', '屮':'싹날 철', '丨':'뚫을 곤', '丶':'점 주', '丿':'삐침 별', '乀':'파임 불', '乁':'흐를 이', '乛':'구결자 야', '亅':'갈고리 궐', '龶':'푸를 청 머리', '业':'업 업의 간략형', '乂':'벨 예', '丄':'위 상', '丅':'아래 하', '丂':'공교할 교', '龺':'아침 해 돋을 간', '𠬝':'다스릴 복', '朩':'삼 껍질 빈', '𠂉':'사람 인의 변형', '𠂊':'칼 도의 변형', '𠂇':'왼손 모양', '𠂒':'손 모양', '𠂆':'길게 걸을 예', '𠆢':'사람 인의 변형', '𭕄':'작을 소의 변형'
};
Object.assign(componentLabels, {
  '丩':'넝쿨 구', '乇':'풀잎 적', '亼':'모을 집', '俞':'대답할 유', '倠':'추할 휴', '兟':'나아갈 신', '冋':'들 경', '冎':'뼈 발라낼 과', '劦':'힘 합할 협', '卌':'마흔 십', '厃':'우러러볼 점', '厤':'다스릴 력', '叀':'삼갈 전', '叚':'빌 가', '咅':'침 부', '啇':'나무뿌리 적', '啚':'더러울 비', '喿':'새 떼지어 울 소', '囪':'굴뚝 창', '圣':'흙 일할 골', '垔':'막을 인', '埶':'심을 예', '堇':'진흙 근', '壴':'북 주', '夅':'내릴 강', '夗':'누워 뒹굴 원', '妟':'편안할 안', '它':'다를 타', '尃':'펼 부', '尗':'콩 숙', '尞':'횃불 료', '屰':'거스를 역', '巠':'물줄기 경', '帀':'두를 잡', '廌':'해태 치', '戉':'도끼 월', '戠':'찰흙 시', '敫':'노래할 교', '旡':'목멜 기', '昜':'볕 양', '朿':'가시 자', '枼':'나뭇잎 엽', '犮':'달릴 발', '畀':'줄 비', '畐':'가득할 복', '畾':'밭 사이 뢰', '睘':'놀라 볼 경', '睪':'엿볼 역', '罙':'깊을 심', '羍':'어린양 달', '羕':'길게 흐를 양', '肰':'개고기 연', '臤':'굳을 간', '臱':'보이지 않을 면', '蒦':'헤아릴 확', '褱':'품을 회', '豦':'싸울 거', '隺':'높이 날 학', '㒼':'평평할 만', '㔾':'병부 절', '㢟':'천천히 걸을 천', '㥯':'삼갈 은', '䍃':'질그릇 요', '䜌':'어지러울 련', '亲':'친할 친', '斦':'밝을 은', '炏':'불탈 염', '龹':'구부릴 권'
});
Object.assign(componentLabels, { '亠':'돼지해머리 두', '儿':'어진사람 인', '乚':'숨을 은', '北':'북녘 북', '並':'나란할 병', '丁':'고무래 정', '本':'근본 본', '目':'눈 목', '人':'사람 인', '心':'마음 심', '土':'흙 토', '犬':'개 견', '又':'또 우', '口':'입 구', '木':'나무 목', '月':'달 월', '日':'날 일', '青':'푸를 청', '者':'사람 자' });
Object.assign(componentLabels, { '冫':'얼음 빙', '歹':'죽을 사', '卩':'병부 절', '殳':'몽둥이 수', '气':'기운 기', '犭':'개 견', '癶':'등질 발', '即':'곧 즉', '糸':'실 사', '匈':'가슴 흉', '駄':'짐 실을 태' });
const extraShapes = {
  金:'금속 덩어리를 나타낸 옛 모습', 角:'동물의 뿔', 身:'사람의 몸', 面:'사람의 얼굴', 長:'머리카락이 긴 사람', 立:'땅 위에 선 사람', 主:'등잔의 불꽃', 丘:'나란한 언덕', 丁:'못 모양으로 풀이되는 옛 자형', 土:'땅 위에 쌓인 흙', 自:'코', 門:'두 짝의 문', 車:'바퀴와 차축이 있는 수레', 片:'나무를 가른 한쪽', 缶:'흙으로 만든 항아리', 豆:'받침이 있는 그릇', 皮:'손으로 가죽을 벗기는 옛 모습', 革:'펼친 짐승의 가죽', 示:'제물을 놓는 제단', 食:'그릇에 담긴 음식', 止:'발', 足:'다리와 발', 工:'일할 때 쓰는 도구', 白:'흰빛을 나타낸 옛 자형', 文:'몸에 새긴 무늬', 申:'번개가 뻗는 모습', 能:'곰을 나타낸 옛 모습', 農:'농기구로 밭을 가는 옛 모습', 辛:'형벌에 쓰던 도구', 卵:'알이 나란한 모습', 卒:'병사의 옷', 弁:'두 손으로 관을 씌우는 모습', 平:'평평함을 표시한 옛 모습', 黄:'장식용 패옥', 曲:'굽은 물건', 了:'몸을 감싼 어린아이', 射:'손으로 활을 당기는 옛 모습', 干:'막대 모양의 도구', 宣:'집과 실내 공간을 나타낸 옛 자형', 幹:'나무의 줄기와 관련된 옛 자형', 異:'머리가 두드러진 사람의 옛 모습', 高:'높은 건물의 모습', 夕:'저녁에 보이는 달의 모습', 力:'힘을 쓰는 농기구의 옛 모습', 業:'악기 거치대의 장식과 관련된 옛 모습'
};
const arity = { '⿰':2,'⿱':2,'⿲':3,'⿳':3,'⿴':2,'⿵':2,'⿶':2,'⿷':2,'⿸':2,'⿹':2,'⿺':2,'⿻':2 };
function leaves(text) { return Array.from(text || '').filter(c => !arity[c] && c !== '？' && c !== '?' && c !== ' '); }

module.exports = function compact({ base, dictionary, variants, korean, pictographs }) {
  const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/kanji-formation-overrides.json'), 'utf8'));
  const missingLabels = new Set();
  const label = c => {
    const canonical = aliases[c] || c;
    const raw = componentLabels[c] || korean.get(canonical) || korean.get(variants.get(canonical));
    if (!raw) { missingLabels.add(c); return '훈음 미확인'; }
    const options = raw.split(',').map(s => s.replace(/\s*\([^)]*\)/g, '').trim());
    const complete = options.find(s => /\s[가-힣]$/.test(s));
    return complete || options[0];
  };
  const describe = (c, owner, index, parts) => {
    const canonical = c === '阝' && index === parts.length - 1 && (dictionary.get(owner)?.decomposition || '').startsWith('⿰') ? '邑' : aliases[c];
    if (canonical && canonical !== c) return `${c}[${canonical}, ${label(canonical)}]`;
    return `${c}(${label(c)})`;
  };
  const result = {}, counts = { total: 0, editorial: 0, phonetic: 0, pictographic: 0, structural: 0 };
  for (const [character, previous] of Object.entries(base)) {
    const override = overrides[character];
    const old = variants.get(character);
    const entry = dictionary.get(character) || dictionary.get(old);
    const etymology = entry?.etymology;
    let parts, formation, kind;
    if (override) {
      parts = override.parts; formation = override.formation; kind = 'editorial';
    } else if (etymology?.type === 'pictophonetic' && etymology.semantic && etymology.phonetic) {
      parts = [etymology.semantic, etymology.phonetic];
      formation = `${etymology.semantic}는 뜻, ${etymology.phonetic}는 소리 담당 → ${previous.meaning.replace(/[,，].*$/, '').replace(/[.。]$/, '')}.`;
      kind = 'phonetic';
    } else if (pictographs[character] || extraShapes[character]) {
      parts = [character];
      formation = `${pictographs[character] || extraShapes[character]} → ${previous.meaning.replace(/[,，].*$/, '').replace(/[.。]$/, '')}.`;
      kind = 'pictographic';
    } else {
      // Some source entries explicitly identify a sound element despite classifying the character as ideographic.
      const phonetic = etymology?.hint?.match(/([\p{Script=Han}⺀-⻿])\s+(?:also\s+)?provides the pronunciation/u)?.[1];
      if (phonetic && entry.radical && phonetic !== entry.radical) {
        parts = [entry.radical, phonetic];
        formation = `${entry.radical}는 뜻, ${phonetic}는 소리 담당 → ${previous.meaning.replace(/[,，].*$/, '').replace(/[.。]$/, '')}.`;
        kind = 'phonetic';
      } else {
        parts = [...new Set(leaves(entry?.decomposition))];
        if (!parts.length) parts = [character];
        formation = `자형 구성만 확인됨. 역사적 형성 원리는 미확정.`;
        kind = 'structural';
      }
    }
    const components = override?.components || parts.map((c, i) => describe(c, character, i, parts)).join(' + ');
    const usesOldShape = !override && entry?.character !== character && old;
    result[character] = {
      label: previous.label, meaning: previous.meaning,
      components: usesOldShape ? `${old}(구자체) 기준: ${components}` : components,
      formation, formationKind: kind, componentCharacters: parts,
      source: override?.source || 'libhangul / Make Me a Hanzi',
      ...(old ? { traditional: old } : {})
    };
    counts[kind]++; counts.total++;
  }
  return { notes: result, report: { ...counts, unnamedComponents: [...missingLabels].sort() } };
};
