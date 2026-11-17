// Sun-soaked look: sky gradient dome with sun disc, warm directional sun with shadows, haze fog, golden-hour blend.
import * as THREE from 'three';
import { W } from './world.js';

let sun, hemi, sky, fog;
export function initLighting(scene) {
  fog = new THREE.Fog(0xf3c9a0, 150, 720); scene.fog = fog;
  hemi = new THREE.HemisphereLight(0xcfe6ff, 0xd9b78a, 1.05); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe2b0, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = c.bottom = -110; c.right = c.top = 110; c.near = 10; c.far = 500; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.5, 0.8) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,low,sunDir; void main(){ float h=clamp(vP.y,0.,1.); vec3 c=mix(low,mid,smoothstep(0.,.18,h)); c=mix(c,top,smoothstep(.15,.8,h)); float s=max(dot(normalize(vP),normalize(sunDir)),0.); c+=vec3(1.,.8,.5)*pow(s,24.)*.6+vec3(1.,.95,.8)*pow(s,900.)*3.; gl_FragColor=vec4(c,1.); }',
  }));
  scene.add(sky);
  scene.background = new THREE.Color(0xf3c9a0);
  setGolden(0.35);
}
/** 0 = bright afternoon, 1 = deep golden hour (used for the title screen). */
export function setGolden(g) {
  const L = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), g);
  const elev = 0.9 - g * 0.5;
  sunDirection.set(Math.cos(0.6) * Math.cos(elev), Math.sin(elev), Math.sin(0.6) * Math.cos(elev) + 0.2).normalize();
  sun.color.copy(L(0xffe8c0, 0xffa65c)); sun.intensity = 2.5 - g * 0.3; hemi.intensity = 1.05 - g * 0.25; hemi.color.copy(L(0xcfe6ff, 0xffd2b0));
  fog.color.copy(L(0xe8d2b4, 0xf0a878)); sky.material.uniforms.top.value.copy(L(0x2f86e0, 0x4a5fa8)); sky.material.uniforms.mid.value.copy(L(0x8fc7f0, 0xf2a58a)); sky.material.uniforms.low.value.copy(L(0xf4dcb8, 0xffc27a));
  sky.material.uniforms.sunDir.value.copy(sunDirection); W.scene.background.copy(fog.color);
}
const sunDirection = new THREE.Vector3();
export function updateLighting(focus) {
  sun.target.position.set(focus.x, 0, focus.z); sun.position.set(focus.x + sunDirection.x * 220, sunDirection.y * 220, focus.z + sunDirection.z * 220);
  sky.position.set(focus.x, 0, focus.z);
}
