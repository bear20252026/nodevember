// Extends the MIT Three.js SunLight nodes pinned by the import map.
import { SunLightNode } from 'three/addons/lights/SunLightNode.js';
import { SunShadowNode } from 'three/addons/lights/SunShadowNode.js';
import { If, float, lightPosition, mix, normalWorld, positionView, reference, renderGroup, shadowPositionWorld, smoothstep, uniform, vec4 } from 'three/tsl';

class MirageSunShadowNode extends SunShadowNode {
  _setupCascades(builder, filterFn) {
    builder.observer.hasNode = true;
    const { shadow, shadowMap } = this;
    const intensity = reference('intensity', 'float', shadow).setGroup(renderGroup);
    // Use the geometric normal, not the rock's fine material relief. Evaluate
    // shared nodes outside branches so they remain in scope for both cascades.
    const position = shadowPositionWorld.toVar(), normal = normalWorld.toVar();
    const cosine = normal.dot(lightPosition(this.light).normalize()).abs().clamp(0, 1).toVar();
    const slope = cosine.pow2().oneMinus().sqrt().toVar();
    const viewDepth = positionView.z.negate().toVar();
    const value = float(1).toVar('sunShadowValue');
    for (let i = shadow.getViewportCount() - 1; i >= 0; i--) {
      const matrix = uniform('mat4').setGroup(renderGroup).onRenderUpdate(() => shadow.getMatrix(i));
      const cascade = uniform('vec4').setGroup(renderGroup).onRenderUpdate(() => shadow._cascadeData[i]);
      const texel = uniform(0).setGroup(renderGroup).onRenderUpdate(() => {
        const c = shadow.getCamera(i);
        return Math.max((c.right - c.left) / shadow.mapSize.x, (c.top - c.bottom) / shadow.mapSize.y);
      });
      const depthSpan = uniform(1).setGroup(renderGroup).onRenderUpdate(() => {
        const c = shadow.getCamera(i); return c.far - c.near;
      });
      If(viewDepth.greaterThanEqual(cascade.x).and(viewDepth.lessThan(cascade.y)), () => {
        // World-space offsets follow the footprint of this cascade. The near
        // rover cascade stays millimetric; the far map gets enough clearance
        // for PCF's neighbouring samples on steep, front-face rock casters.
        const offset = normal.mul(texel.mul(slope.mul(1.6).add(.15)));
        const coord = this.setupShadowCoord(builder, matrix.mul(vec4(position.add(offset), 1))).toVar();
        const depthBias = texel.mul(.35).div(depthSpan);
        coord.z.addAssign(builder.renderer.reversedDepthBuffer ? depthBias : depthBias.negate());
        const filtered = this.setupShadowFilter(builder, {
          filterFn, shadowTexture: shadowMap.texture, depthTexture: shadowMap.depthTexture,
          shadowCoord: coord, shadow: this._filterShadow, depthLayer: this.depthLayer
        });
        value.assign(mix(filtered, value, smoothstep(cascade.z, cascade.y, viewDepth)));
      });
    }
    return mix(1, value, intensity);
  }
}

export class MirageSunLightNode extends SunLightNode {
  setupShadowNode() { return new MirageSunShadowNode(this.light); }
  setupDirect() {
    const direct = super.setupDirect();
    if (this.light.cloudShadowNode) direct.lightColor = direct.lightColor.mul(this.light.cloudShadowNode);
    return direct;
  }
}
