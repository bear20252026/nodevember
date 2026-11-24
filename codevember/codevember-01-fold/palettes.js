import * as THREE from 'three';
// sorbet: soft pastels on a warm cream ground; each cube gets its own slight variation of one of the colors
export const PALETTE = {
  bg: '#fbf3ea',
  colors: ['#f7a1b5', '#fbc4a6', '#fde2a3', '#c9e4b4', '#a7dcd6', '#b5c8f2', '#d4b8ef', '#f2b8de'].map((c) => new THREE.Color(c)),
};
