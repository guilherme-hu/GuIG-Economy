/**
 * Céu: domo com gradiente horizonte → meio → zênite, brilho em volta do sol e estrelas.
 * Tudo no shader, sem texturas. O domo acompanha a câmera e é desenhado no plano distante.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w; // sempre no fundo: só pinta onde não há cidade
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizon, uMid, uZenith, uSunDir, uSunColor;
  uniform float uSunGlow, uStars, uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  vec3 gradient(float h) {
    vec3 low = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
    return mix(low, uZenith, smoothstep(0.12, 0.75, h));
  }

  float stars(vec3 dir) {
    vec3 p = dir * 150.0;
    vec3 cell = floor(p);
    float rnd = hash(cell);
    float dist = length(fract(p) - 0.5);
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 40.0);
    return step(0.992, rnd) * smoothstep(0.32, 0.05, dist) * twinkle;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = max(dir.y, 0.0);
    vec3 color = gradient(h);

    float toSun = max(dot(dir, uSunDir), 0.0);
    float halo = pow(toSun, 6.0) * 0.35 + pow(toSun, 40.0) * 0.6;
    float disc = smoothstep(0.9993, 0.9997, toSun);
    color += uSunColor * uSunGlow * (halo * (1.0 - 0.6 * h) + disc * 6.0);

    color += vec3(0.9, 0.95, 1.0) * stars(dir) * uStars * smoothstep(0.02, 0.3, dir.y) * 1.6;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSky({ radius }) {
  const uniforms = {
    uHorizon: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunGlow: { value: 0 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000; // depois dos opacos

  return {
    mesh,
    /** `frame`: quadro interpolado de `config.render.times` (cores já como THREE.Color). */
    apply(frame, sunDirection) {
      uniforms.uHorizon.value.copy(frame.horizon);
      uniforms.uMid.value.copy(frame.mid);
      uniforms.uZenith.value.copy(frame.zenith);
      uniforms.uSunColor.value.copy(frame.sunColor);
      uniforms.uSunGlow.value = frame.sunGlow;
      uniforms.uStars.value = frame.stars;
      uniforms.uSunDir.value.copy(sunDirection);
    },
    update(camera, dt) {
      mesh.position.copy(camera.position);
      uniforms.uTime.value += dt;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
