/** Pontos de interesse: restaurantes, endereços de cliente e a casa do jogador, cada um preso a um ponto de uma rua. */
import { createPolyline, distance } from './geometry.js';

const RESTAURANTS = [
  'Pastelaria do Zé',
  'Cantina Bela Massa',
  'Sushi da Esquina',
  'Brasa Burguer',
  'Açaí da Praça',
  'Marmitas da Dona Cida',
  'Pizzaria Forno a Lenha',
  'Tapiocaria da Lu',
  'Churrasquinho do Tio',
  'Yakisoba do Bairro',
  'Esfiharia Sultão',
  'Feijoada da Sexta',
  'Poke do Centro',
  'Coxinha Dourada',
  'Cachorro-Quente do Careca',
  'Temakeria Onda',
  'Padoca da Madrugada',
  'Galeto na Brasa',
];

const STREETS = [
  'das Acácias', 'do Ipê', 'dos Jasmins', 'da Mangueira', 'do Cajueiro', 'das Palmeiras', 'do Jequitibá', 'da Aroeira',
  'Dona Zilda', 'Seu Honório', 'Professora Alzira', 'Doutor Peçanha', 'Maestro Belmiro', 'Irmã Dulcineia',
  'do Sabiá', 'do Bem-te-vi', 'da Capivara', 'do Tamanduá', 'da Garça', 'do Quero-quero',
  'da Estação', 'do Mercado', 'da Olaria', 'do Estaleiro', 'da Fundição', 'do Armazém', 'da Balsa', 'do Farol',
  'Sete de Abril', 'Treze de Junho', 'Dois de Outubro', 'Nove de Março',
];

export function streetName(edge) {
  const title = edge.kind === 'avenida' ? 'Av.' : 'Rua';
  return `${title} ${STREETS[(edge.id * 7 + 3) % STREETS.length]}`;
}

export function placePois(city, cfg, districtAt, rng) {
  const river = createPolyline(city.river.points);
  const centro = { x: cfg.centro.x * cfg.size, z: cfg.centro.z * cfg.size };
  const middle = (edge) => {
    const a = city.nodes[edge.a];
    const b = city.nodes[edge.b];
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  };
  // Sobra de rua entre as duas áreas de cruzamento, com folga para o marcador não cair na esquina.
  const span = (edge) => {
    const from = (city.nodes[edge.a].radius + 6) / edge.length;
    const to = 1 - (city.nodes[edge.b].radius + 6) / edge.length;
    return to - from > 0.05 ? [from, to] : null;
  };
  const usable = city.edges.filter((edge) => !edge.bridge && span(edge));
  const districtOf = new Map(usable.map((edge) => [edge.id, districtAt(middle(edge).x, middle(edge).z)]));
  const pois = [];

  function place(type, pool, nameFor) {
    let fallback = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const edge = rng.pick(pool);
      const [from, to] = span(edge);
      const t = rng.range(from, to);
      const side = rng.chance(0.5) ? 1 : -1;
      const along = t * edge.length;
      const lateral = side * (edge.halfWidth - 1);
      const a = city.nodes[edge.a];
      const x = a.x + edge.dir.x * along - edge.dir.z * lateral;
      const z = a.z + edge.dir.z * along + edge.dir.x * lateral;
      const poi = { id: pois.length, type, name: nameFor(edge, t, side), edge: edge.id, t, side, x, z };
      fallback = poi;
      if (pois.every((other) => distance(x, z, other.x, other.z) >= cfg.poiSpacing)) break;
    }
    pois.push(fallback);
  }

  const inCentro = usable.filter((edge) => districtOf.get(edge.id) === 'centro');
  const names = shuffledNames(rng);
  for (let i = 0; i < cfg.restaurants; i++) {
    const pool = inCentro.length && rng.chance(cfg.restaurantsInCentro) ? inCentro : usable;
    place('restaurante', pool, () => names[i % names.length] + (i >= names.length ? ' II' : ''));
  }

  const houseNumber = (edge, t, side) => 10 + 2 * Math.round(t * edge.length) + (side > 0 ? 0 : 1);
  for (let i = 0; i < cfg.customers; i++) {
    place('cliente', usable, (edge, t, side) => `${streetName(edge)}, ${houseNumber(edge, t, side)}`);
  }

  place('casa', homeStreets(city, cfg, usable, districtOf, river, centro, middle), () => 'Casa');
  return pois;
}

function shuffledNames(rng) {
  const names = [...RESTAURANTS];
  for (let i = names.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

/** A casa fica numa rua do Bairro do outro lado do rio em relação ao Centro, de preferência num beco. */
function homeStreets(city, cfg, usable, districtOf, river, centro, middle) {
  const quiet = usable.filter((edge) => edge.kind === 'rua' && districtOf.get(edge.id) === 'bairro');
  const far = quiet.filter((edge) => {
    const m = middle(edge);
    return river.nearest(m.x, m.z).signed > 0 && distance(m.x, m.z, centro.x, centro.z) >= cfg.homeFromCentro * cfg.size;
  });
  const isDeadEnd = (edge) => city.nodes[edge.a].edges.length === 1 || city.nodes[edge.b].edges.length === 1;
  const deadEnds = far.filter(isDeadEnd);
  if (deadEnds.length) return deadEnds;
  if (far.length) return far;
  return quiet.length ? quiet : usable;
}
