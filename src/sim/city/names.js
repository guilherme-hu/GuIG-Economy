/** Nomes de vias e de restaurantes (pt-BR), e o encadeamento de trechos em "vias" que dividem o mesmo nome. */
import { angleGap, shuffle } from './geometry.js';

export const MARGINAL_NAME = 'Av. Marginal';

const AVENUES = [
  'Av. Brasil', 'Av. Independência', 'Av. das Nações', 'Av. Central', 'Av. Presidente Juscelino',
  'Av. dos Trabalhadores', 'Av. Getúlio Vargas', 'Av. do Contorno',
];
const BRIDGES = [
  'Ponte Velha', 'Ponte do Limoeiro', 'Ponte Torta', 'Ponte dos Motoboys', 'Ponte Estaiada',
  'Ponte do Meio', 'Ponte Nova', 'Ponte da Balsa',
];
const STREETS = [
  'das Acácias', 'dos Ipês', 'das Palmeiras', 'dos Jacarandás', 'das Mangueiras', 'dos Girassóis',
  'das Hortênsias', 'dos Flamboyants', 'das Jabuticabeiras', 'dos Coqueiros', 'das Orquídeas', 'dos Cajueiros',
  'das Paineiras', 'dos Manacás', 'das Azaleias', 'das Laranjeiras', 'dos Pinheiros', 'das Goiabeiras',
  'das Samambaias', 'dos Bambus', 'da Saudade', 'do Sossego', 'da Paz', 'do Comércio', 'da Feira', 'da Matriz',
  'do Mercado', 'da Estação', 'da Aurora', 'da Harmonia', 'do Progresso', 'da Liberdade', 'da Glória',
  'do Rosário', 'da Consolação', 'das Flores', 'da Alegria', 'do Sol', 'da Lua', 'das Estrelas', 'da Boa Vista',
  'do Cruzeiro', 'da Fonte', 'do Mirante', 'da Ladeira', 'do Chafariz', 'Quinze de Novembro', 'Treze de Maio',
  'Primeiro de Maio', 'Vinte e Um de Abril', 'Nove de Julho', 'Dois de Julho', 'Sete de Setembro', 'São Benedito',
  'Santa Luzia', 'São Jorge', 'Santo Antônio', 'São Judas', 'Santa Rita', 'São Cosme', 'Santa Edwiges',
  'São Expedito', 'do Fuxico', 'da Pamonha', 'do Pião', 'da Pipa', 'do Violeiro', 'da Seresta', 'do Sabiá',
  'do Bem-Te-Vi', 'da Maritaca', 'do Tatu', 'da Capivara', 'do Quero-Quero',
];
const INDUSTRIAL_STREETS = [
  'dos Torneiros', 'do Aço', 'das Caldeiras', 'dos Ferroviários', 'da Fundição', 'dos Metalúrgicos',
  'das Chaminés', 'do Estaleiro', 'dos Tecelões', 'da Olaria', 'do Curtume', 'dos Estivadores', 'da Cerâmica',
  'do Frigorífico', 'das Docas', 'dos Operários', 'da Serraria', 'do Guindaste',
];
const TITLES = ['Dr.', 'Cel.', 'Prof.', 'Padre', 'Vereador', 'Marechal', 'Comendador', 'Dona', 'Profa.', 'Irmã'];
const FEMALE_TITLES = 3; // os últimos de TITLES
const MALE_NAMES = ['Epaminondas', 'Fagundes', 'Olegário', 'Anacleto', 'Juvenal', 'Belarmino', 'Osvaldo', 'Tibúrcio', 'Agenor', 'Honório', 'Zeferino', 'Custódio'];
const FEMALE_NAMES = ['Zuleica', 'Mirtes', 'Odete', 'Dulcinéia', 'Jurema', 'Hermínia', 'Clotilde', 'Iracema', 'Lindalva', 'Marlene', 'Noêmia', 'Aparecida'];
const SURNAMES = ['Peixoto', 'Bulhões', 'Quintela', 'Sardinha', 'Pacheco', 'Varejão', 'Brandão', 'Cavalcanti', 'Miranda', 'Falcão', 'Bezerra', 'Taveira'];

const DISHES = [
  'Pastel', 'Xis', 'Temaki', 'Marmitex', 'Açaí', 'Podrão', 'Coxinha', 'Tapioca', 'Churrasquinho', 'Dogão',
  'Pizza', 'Esfiha', 'Hambúrguer', 'Yakisoba', 'Acarajé', 'Feijoada', 'Caldo de Cana', 'Empada', 'Baião de Dois',
  'Parmegiana', 'Galeto', 'Cuscuz', 'Moqueca', 'Pão de Queijo', 'Espetinho', 'Crepe', 'Batata Recheada', 'Sushi',
];
const OWNERS = [
  'do Zé', 'do Gordo', 'da Praça', 'da Dona Cida', 'do Tio Beto', 'da Vó Zilda', 'do Careca', 'do Bigode',
  'da Tia Nena', 'do Alemão', 'da Esquina', 'do Seu Jorge', 'da Baixinha', 'do Tonhão', 'da Estação', 'do Mineiro',
  'da Baiana', 'do Gaúcho', 'da Madrugada', 'do Ponto Final', 'do Chefe', 'da Lurdinha', 'do Juninho',
  'da Ladeira', 'do Barbudo', 'da Rodoviária',
];
const FUNNY_PLACES = [
  'Pizzaria Forno Nervoso', 'Hamburgueria Dois Pães', 'Boteco Fim de Expediente', 'Self-Service Prato Cheio',
  'Frango Assado Giratório', 'Pastelaria Vento Leve', 'Marmitaria Sustança', 'Hot Dog Prensadão',
  'Casa do Norte Oxente', 'Açaí Roxo de Fome', 'Cantina Massa Braba', 'Sushi Que Eu Gosto',
];
const FUNNY_SHARE = 0.3;

const take = (pool, rng, n) => shuffle(pool.slice(), rng).slice(0, n);
export const pickAvenueNames = (rng, n) => take(AVENUES, rng, n);
export const pickBridgeNames = (rng, n) => take(BRIDGES, rng, n);

/** `n` nomes de restaurante sem repetir prato nem dono. */
export function pickRestaurantNames(rng, n) {
  const funny = take(FUNNY_PLACES, rng, Math.round(n * FUNNY_SHARE));
  const dishes = take(DISHES, rng, n);
  const owners = take(OWNERS, rng, n);
  const composed = dishes.slice(0, n - funny.length).map((dish, i) => `${dish} ${owners[i]}`);
  return shuffle(funny.concat(composed), rng);
}

/** Fonte de nomes de rua que nunca se repetem: listas curadas, depois gente ilustre, depois "Projetada N". */
function createStreetNamer(rng) {
  const pools = { geral: shuffle(STREETS.slice(), rng), industrial: shuffle(INDUSTRIAL_STREETS.slice(), rng) };
  const used = new Set();
  let projected = 0;

  function illustrious() {
    const t = rng.int(0, TITLES.length - 1);
    const first = rng.pick(t >= TITLES.length - FEMALE_TITLES ? FEMALE_NAMES : MALE_NAMES);
    return `${TITLES[t]} ${first} ${rng.pick(SURNAMES)}`;
  }

  return function next(district) {
    const pool = district === 'industrial' && pools.industrial.length ? pools.industrial : pools.geral;
    if (pool.length) return pool.pop();
    for (let tries = 0; tries < TITLES.length; tries++) {
      const name = illustrious();
      if (!used.has(name)) return used.add(name), name;
    }
    return `Projetada ${++projected}`;
  };
}

/**
 * Agrupa as ruas ainda sem nome em vias (trechos consecutivos e alinhados), orienta cada trecho no sentido
 * da via (a→b) e dá o nome. Devolve `{ vias: [{ edges: [id] }], houseBase }`, onde `houseBase[edgeId]` é a
 * metragem da via no nó `a` do trecho (base da numeração dos endereços).
 */
export function nameStreets(city, edgeDistricts, cfg, rng) {
  const partner = pairStraightEdges(city, cfg.viaMaxTurn);
  const namer = createStreetNamer(rng);
  const houseBase = avenueHouseBases(city);
  const seen = new Set();
  const vias = [];
  for (const start of city.edges) {
    if (start.name || seen.has(start.id)) continue;
    const via = walkVia(city, start, partner, seen, rng);
    const name = `${viaPrefix(city, via, edgeDistricts, cfg, rng)} ${namer(edgeDistricts[start.id])}`;
    let meters = 0;
    for (const id of via.edges) {
      city.edges[id].name = name;
      houseBase[id] = meters;
      meters += city.edges[id].length;
    }
    vias.push(via);
  }
  return { vias, houseBase };
}

/** Avenidas já vêm nomeadas e orientadas em sequência: a numeração acumula na ordem dos ids. */
function avenueHouseBases(city) {
  const base = new Array(city.edges.length).fill(0);
  const meters = new Map();
  for (const edge of city.edges) {
    if (!edge.name) continue;
    base[edge.id] = meters.get(edge.name) ?? 0;
    meters.set(edge.name, base[edge.id] + edge.length);
  }
  return base;
}

const partnerKey = (edgeId, nodeId) => `${edgeId}:${nodeId}`;
const outwardAngle = (city, edge, nodeId) =>
  edge.a === nodeId ? Math.atan2(edge.dir.z, edge.dir.x) : Math.atan2(-edge.dir.z, -edge.dir.x);

/** Em cada nó, casa os pares de ruas sem nome que seguem quase em linha reta (os mais retos primeiro). */
function pairStraightEdges(city, maxTurn) {
  const partner = new Map();
  for (const node of city.nodes) {
    const free = node.edges.map((id) => city.edges[id]).filter((e) => !e.name);
    const pairs = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const turn = Math.PI - angleGap(outwardAngle(city, free[i], node.id), outwardAngle(city, free[j], node.id));
        if (turn <= maxTurn) pairs.push({ turn, e: free[i].id, f: free[j].id });
      }
    }
    pairs.sort((p, q) => p.turn - q.turn);
    for (const { e, f } of pairs) {
      if (partner.has(partnerKey(e, node.id)) || partner.has(partnerKey(f, node.id))) continue;
      partner.set(partnerKey(e, node.id), f);
      partner.set(partnerKey(f, node.id), e);
    }
  }
  return partner;
}

/** Recua até uma ponta da via e a percorre inteira, virando cada trecho para o sentido da caminhada. */
function walkVia(city, start, partner, seen, rng) {
  let edge = start;
  let node = rng.chance(0.5) ? start.a : start.b;
  const guard = new Set([edge.id]);
  for (;;) {
    const prev = partner.get(partnerKey(edge.id, node));
    if (prev === undefined || guard.has(prev)) break;
    guard.add(prev);
    edge = city.edges[prev];
    node = edge.a === node ? edge.b : edge.a;
  }
  const edges = [];
  while (edge && !seen.has(edge.id)) {
    orient(edge, node);
    seen.add(edge.id);
    edges.push(edge.id);
    node = edge.b;
    edge = city.edges[partner.get(partnerKey(edge.id, node))];
  }
  return { edges };
}

function orient(edge, from) {
  if (edge.a === from) return;
  [edge.a, edge.b] = [edge.b, edge.a];
  edge.dir = { x: -edge.dir.x, z: -edge.dir.z };
}

function viaPrefix(city, via, edgeDistricts, cfg, rng) {
  const first = city.edges[via.edges[0]];
  const last = city.edges[via.edges[via.edges.length - 1]];
  const deadEnd = city.nodes[first.a].edges.length === 1 || city.nodes[last.b].edges.length === 1;
  if (via.edges.length === 1) return deadEnd ? 'Beco' : 'Travessa';
  if (edgeDistricts[first.id] === 'bairro' && rng.chance(cfg.alamedaShare)) return 'Alameda';
  return 'Rua';
}
