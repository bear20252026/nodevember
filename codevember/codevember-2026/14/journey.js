import { TensionSimulation, STEP, LINK_COUNT } from "./tension-simulation.js";

export const CHAIN_SPACING = 6.4;
export const CAMERA_DISTANCE = 3.15;
export const cameraDistance = (chainCount = 1) =>
  [3.15, 4.05, 4.45, 4.85][chainCount - 1];
export const TRANSITION_DURATION = 5.2;
export const cameraFov = (aspect, chainCount = 1) =>
  aspect < 0.8 ? [60, 70, 78, 84][chainCount - 1] : 46;
// Covers the complete link, surface irregularities, and a little screen margin.
const RETIRE_RADIUS = 0.6;
export function belowRetirementView(shot, pose, futurePose, aspect) {
  const tangent = Math.tan((cameraFov(aspect, 4) * Math.PI) / 360);
  return [
    ...shot.simulation.links,
    ...shot.simulation.fragments,
    ...(shot.simulation.rocks ?? []),
    ...(shot.simulation.tetherLinks ?? []),
  ].every(
    (body) =>
      !body ||
      [body.position, body.previousPosition].every((p) =>
        [pose, futurePose].every(
          (view) =>
            p[1] - view.y + (view.z - shot.z - p[2]) * tangent <
            -(body.radius ?? RETIRE_RADIUS) * Math.sqrt(1 + tangent * tangent),
        ),
      ),
  );
}
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export function chainAngle(index) {
  return (
    [0.42, -0.55, 0.86, -0.22, -0.92, 0.14][index % 6] +
    Math.sin(index * 1.73) * 0.045
  );
}

export class BreakingJourney {
  constructor({
    onCreate = () => {},
    onBreak = () => {},
    onCrack = () => {},
    onRemove = () => {},
    onAdvance = () => {},
    seed = Math.floor(Math.random() * 4294967296),
    getAspect = () => 16 / 9,
    rockShapes = null,
    linkCount = LINK_COUNT,
    branchLinkCount = 9,
    rockTethers = false,
  } = {}) {
    this.callbacks = { onCreate, onBreak, onCrack, onRemove, onAdvance };
    this.randomState = seed >>> 0;
    this.getAspect = getAspect;
    this.rockShapes = rockShapes;
    this.linkCount = linkCount;
    this.branchLinkCount = branchLinkCount;
    this.rockTethers = rockTethers;
    this.spacing = rockShapes ? 34 : CHAIN_SPACING;
    this.lastBreak = null;
    this.lastChainCount = 0;
    this.lastFractureMode = null;
    this.time = 0;
    this.physicsTime = 0;
    this.accumulator = 0;
    this.shots = [];
    this.index = 0;
    this.transitionAge = -1;
    this.fractureAge = -1;
    this.breaks = 0;
    this.current = this.createShot(0);
    this.next = null;
    this.cameraZ = this.cameraDistance(
      this.current.simulation.chainCount,
      this.getAspect(),
    );
    this.cameraVelocity = 0;
  }
  createShot(index) {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    const choices = [2, 3, 4].filter((n) => n !== this.lastChainCount);
    const chainCount =
      index === 0
        ? 2
        : choices[Math.floor((this.randomState / 4294967296) * choices.length)];
    this.lastChainCount = chainCount;
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    const modes = ["snap", "tear", "shatter"].filter(
      (mode) => mode !== this.lastFractureMode,
    );
    const fractureMode =
      index === 0
        ? "snap"
        : modes[Math.floor((this.randomState / 4294967296) * modes.length)];
    this.lastFractureMode = fractureMode;
    const shot = {
      index,
      z: index * this.spacing,
      outsideTime: 0,
      viewDepth: 0,
      viewCenter: [0, 0],
      viewVelocity: [0, 0],
      pushIn: 0,
      closestCameraZ: Infinity,
      reportedCracks: 0,
      reportedBreaks: 0,
      stressLink: null,
      stressSince: null,
      simulation: new TensionSimulation({
        angle: chainAngle(index),
        seed: index,
        chainCount,
        fractureMode,
        centerPull: true,
        rockShapes: this.rockShapes,
        linkCount: this.linkCount,
        branchLinkCount: this.branchLinkCount,
        rockTethers: this.rockTethers,
        chooseBreakLink: (sim) => this.chooseBreakLink(sim),
        strength: 35000 * (1 + 0.07 * Math.sin(index * 2.1)),
      }),
    };
    this.shots.push(shot);
    this.callbacks.onCreate(shot);
    return shot;
  }
  chooseBreakLink(sim, eligible) {
    const shot = this.shots.find((shot) => shot.simulation === sim);
    // Incoming chains can take up slack, but their first failure stays on camera.
    if (shot !== this.current) return null;
    // Physics may only fracture a previously illuminated link. A fast load
    // spike must not choose and break a new link within the same time step.
    if (eligible === undefined) {
      if (
        !sim.failureCandidates.includes(shot.stressLink) ||
        this.time - shot.stressSince < 0.25
      )
        return null;
      const p = sim.links[shot.stressLink].position,
        pose = this.cameraPose();
      const height =
        (pose.z - shot.z - p[2]) * Math.tan((pose.fov * Math.PI) / 360);
      const radius = Math.hypot(
        (p[0] - pose.x) / (height * this.getAspect()),
        (p[1] - pose.y) / height,
      );
      // If a loaded link drifts while the camera catches up, keep its warning
      // instead of fracturing it at the edge of the frame.
      return height > 0 && radius < 0.42 ? shot.stressLink : null;
    }
    // Once the warning light chooses a link, keep it through release and
    // renewed pulling. Wait for its own path to carry the failure load.
    if (shot?.stressLink !== null && shot?.stressLink !== undefined)
      return eligible.includes(shot.stressLink) ? shot.stressLink : null;
    const aspect = this.getAspect(),
      pose = this.cameraPose(aspect);
    const tangent = Math.tan((pose.fov * Math.PI) / 360);
    // Favor an already visible failure site; the camera eases toward it.
    const central = eligible.flatMap((index) => {
      const p = sim.links[index]?.position;
      if (!p) return [];
      const halfHeight = (pose.z - shot.z - p[2]) * tangent;
      if (halfHeight <= 0) return [];
      const x = (p[0] - pose.x) / (halfHeight * aspect);
      const y = (p[1] - pose.y) / halfHeight;
      const distance = Math.hypot(x, y);
      return distance < 0.45 ? [{ index, distance }] : [];
    });
    if (!central.length) return null;
    const different = central.filter(({ index }) => index !== this.lastBreak);
    const pool = different.length ? different : central;
    const nearest = Math.min(...pool.map(({ distance }) => distance));
    const candidates = pool.filter(({ distance }) => distance < nearest + 0.12);
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    const index =
      candidates[
        Math.floor((this.randomState / 4294967296) * candidates.length)
      ]?.index ?? null;
    return index;
  }
  advance(dt, { auto = true, pulling = false, speed = 1, strength = 1 } = {}) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.accumulator += dt * speed;
    while (this.accumulator >= STEP - 1e-10) {
      this.time += STEP;
      const transition = this.transitionAge >= 0;
      if (this.fractureAge >= 0) this.fractureAge += STEP;
      const scale = transition
        ? 0.22 + 0.78 * smooth(0.8, 1.55, this.transitionAge)
        : this.fractureAge >= 0
          ? 0.3 + 0.7 * smooth(0.18, 0.65, this.fractureAge)
          : 1;
      const physicalStep = STEP * scale;
      this.physicsTime += physicalStep;
      for (const shot of this.shots) {
        // Start as soon as the camera clears the incoming opening, while the
        // dolly is still easing out. Keep the aperture still during the crossing.
        if (shot === this.next && this.cameraZ < shot.z + 0.45) continue;
        const loading = shot === this.current || shot === this.next;
        const pull = loading ? (auto ? 1 : 0) + (pulling ? 2.7 : 0) : 0;
        if (loading && !shot.simulation.broken)
          shot.simulation.strength =
            35000 * (1 + 0.07 * Math.sin(shot.index * 2.1)) * strength;
        shot.simulation.advance(physicalStep, pull);
      }
      this.callbacks.onAdvance(physicalStep);
      const shot = this.current,
        active = shot.simulation;
      if (!active.fractures.length)
        shot.viewDepth = active.links[active.centerLink].position[2];
      else if (!active.broken) {
        const target = active.pendingFracture
            ? active.fracture.position
            : active.focusPoint(),
          blend = 1 - Math.exp(-STEP * (active.pendingFracture ? 6 : 3));
        shot.viewDepth += (target[2] - shot.viewDepth) * blend;
      }
      if (!active.broken) {
        const distance = this.cameraDistance(
          active.chainCount,
          this.getAspect(),
        );
        const push =
          Math.min(2.6, distance * 0.18) *
          smooth(0.2, 0.85, active.extension / active.slack);
        shot.pushIn += (push - shot.pushIn) * (1 - Math.exp(-STEP * 1.5));
        const target = active.pendingFracture
          ? active.fracture.position
          : this.fractureAge >= 0 && this.fractureAge < 0.65
            ? active.fracture.position
            : (active.links[shot.stressLink]?.position ??
              (active.fractures.length
                ? active.focusPoint()
                : active.links[active.centerLink].position));
        // A damped dolly: bounded acceleration and speed, no recoil shake.
        const acceleration = shot.viewCenter.map(
          (v, k) => (target[k] - v) * 2.25 - shot.viewVelocity[k] * 3,
        );
        const scale = Math.min(
          1,
          0.9 / Math.max(1e-8, Math.hypot(...acceleration)),
        );
        for (let k = 0; k < 2; k++)
          shot.viewVelocity[k] += acceleration[k] * scale * STEP;
        const speed = Math.min(
          1,
          0.85 / Math.max(1e-8, Math.hypot(...shot.viewVelocity)),
        );
        for (let k = 0; k < 2; k++) {
          shot.viewVelocity[k] *= speed;
          shot.viewCenter[k] += shot.viewVelocity[k] * STEP;
        }
      }
      if (active.fractures.length > shot.reportedCracks) {
        shot.reportedCracks = active.fractures.length;
        if (active.pendingFracture) this.callbacks.onCrack(shot);
      }
      const completed = active.fractures.filter(
        (f) => f.completeTime !== undefined,
      ).length;
      if (completed > shot.reportedBreaks) {
        this.lastBreak = active.fracture.index;
        shot.stressLink = null;
        shot.stressSince = null;
        shot.reportedBreaks = completed;
        shot.breakDepth = shot.viewDepth;
        this.fractureAge = 0;
        this.breaks++;
        this.callbacks.onBreak(shot);
      }
      if (
        shot.stressLink === null &&
        !active.broken &&
        !active.pendingFracture &&
        (auto || pulling) &&
        active.slackRemaining < 0.12 &&
        active.load > active.strength * 0.35 &&
        (this.fractureAge < 0 || this.fractureAge > 0.55)
      ) {
        const loading = new Set(
          active.loadedComponents
            .filter((component) => component.load > active.strength * 0.35)
            .flatMap((component) => [...component.links]),
        );
        shot.stressLink =
          !active.fractures.length && active.forcedWeakLink !== null
            ? active.forcedWeakLink
            : this.chooseBreakLink(
                active,
                active.eligibleLinks.filter((i) => loading.has(i)),
              );
        if (shot.stressLink !== null) shot.stressSince = this.time;
      }
      if (active.broken && !transition) {
        this.transitionAge = 0;
        shot.transitionStartZ = this.cameraZ;
        this.next = this.createShot(this.index + 1);
      } else if (transition) {
        this.transitionAge += STEP;
        if (this.transitionAge >= TRANSITION_DURATION) {
          // Once the camera has moved on, let the broken chain fall freely.
          this.current.simulation.releaseAnchors();
          this.current = this.next;
          this.next = null;
          this.index++;
          this.transitionAge = -1;
          this.fractureAge = -1;
        }
      }
      // A single persistent dolly state carries velocity across every handoff.
      // Neither a new failure target nor a new assembly can teleport the camera.
      if (!this.current.simulation.broken)
        this.current.closestCameraZ = Math.min(
          this.current.closestCameraZ,
          this.cameraZ,
        );
      const targetZ = this.cameraDestination(this.getAspect());
      const acceleration = Math.max(
        -8,
        Math.min(8, (targetZ - this.cameraZ) * 9 - this.cameraVelocity * 6),
      );
      this.cameraVelocity = Math.max(
        -14,
        Math.min(14, this.cameraVelocity + acceleration * STEP),
      );
      this.cameraZ += this.cameraVelocity * STEP;
      this.retireFallenChains(STEP);
      this.accumulator -= STEP;
    }
  }
  retireFallenChains(dt) {
    const aspect = this.getAspect(),
      pose = this.cameraPose(aspect);
    // Include the next retreat: an old chain must not re-enter the wider view.
    const futurePose = {
      y: 0,
      z:
        this.current.z +
        this.cameraDistance(4, aspect) +
        this.spacing +
        Math.max(
          0,
          ...this.current.simulation.eligibleLinks.map(
            (i) => this.current.simulation.links[i]?.position[2] ?? 0,
          ),
        ),
    };
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      if (shot === this.current || shot === this.next) continue;
      const clear = belowRetirementView(shot, pose, futurePose, aspect);
      shot.outsideTime = clear ? shot.outsideTime + dt : 0;
      if (shot.outsideTime < 0.75) continue;
      this.shots.splice(i, 1);
      this.callbacks.onRemove(shot);
      shot.simulation.dispose();
    }
  }
  cameraDistance(chainCount, aspect) {
    // The longer chain-only layouts need room for an opening tear now that
    // the camera holds its depth throughout the remaining failures.
    if (!this.rockShapes) return cameraDistance(chainCount) + 2;
    // Move the dolly closer so the breaking links read clearly. The existing
    // tracking and clearance checks keep the active fracture in view.
    const halfWidth =
      (this.rockTethers ? (aspect < 0.8 ? 6.6 : 8.2) : 4.7) +
      (chainCount - 1) * 0.65;
    const tangent = Math.tan((cameraFov(aspect, chainCount) * Math.PI) / 360);
    return (
      Math.max(
        cameraDistance(chainCount) + (this.rockTethers ? 8.6 : 3.4),
        halfWidth / (aspect * tangent),
      ) * 0.64
    );
  }
  cameraDestination(aspect) {
    const shot = this.current;
    const distance = this.cameraDistance(shot.simulation.chainCount, aspect);
    const start = shot.z + distance - shot.pushIn;
    // Surviving paths are followed laterally, at the closest depth reached.
    // Only the completed assembly is allowed to start a backward dolly.
    if (!this.next) return Math.min(start, shot.closestCameraZ);
    const end =
      this.next.z +
      this.cameraDistance(this.next.simulation.chainCount, aspect);
    const retreat = smooth(0.48, TRANSITION_DURATION, this.transitionAge);
    return shot.transitionStartZ + (end - shot.transitionStartZ) * retreat;
  }
  cameraPose(aspect = this.getAspect()) {
    const shot = this.current,
      sim = shot.simulation;
    const centerDepth = sim.broken
      ? shot.breakDepth
      : sim.fractures.length
        ? shot.viewDepth
        : sim.links[sim.centerLink].position[2];
    const age = this.transitionAge;
    // Hold the fracture briefly, then ease into the incoming chain.
    const follow = sim.broken
      ? (aspect < 0.8 ? 0.85 : 0.25) * smooth(0, 0.3, age)
      : 0;
    const focalDepth =
      centerDepth +
      ((sim.fracture?.position[2] ?? centerDepth) - centerDepth) * follow;
    const retreat = age >= 0 ? smooth(0.48, TRANSITION_DURATION, age) : 0;
    // Ease focal depth toward the incoming chain during the retreat.
    const track = age >= 0 ? 1 - smooth(0.6, 1.55, age) : 1;
    const distance = this.cameraDistance(sim.chainCount, aspect);
    const startZ = shot.transitionStartZ ?? shot.z + distance - shot.pushIn;
    const z = this.cameraZ;
    const incoming = this.next && z > this.next.z + 0.06;
    const recenter = this.next ? 1 - smooth(startZ, this.next.z - 0.5, z) : 1;
    const x = shot.viewCenter[0] * recenter;
    const y = shot.viewCenter[1] * recenter;
    const targetZ = incoming ? this.next.z : shot.z + focalDepth * track;
    const focus = Math.max(0.12, z - targetZ);
    const fov = cameraFov(aspect, sim.chainCount);
    const nextFov = this.next
      ? cameraFov(aspect, this.next.simulation.chainCount)
      : fov;
    return {
      fov: fov + (nextFov - fov) * retreat,
      x,
      y,
      z,
      target: [x, y, targetZ],
      focus,
      retreat,
      lightZ:
        shot.z + retreat * ((this.next?.z ?? shot.z + this.spacing) - shot.z),
    };
  }
  inspect() {
    return {
      time: this.time,
      index: this.index,
      breaks: this.breaks,
      transitionAge: this.transitionAge,
      fractureAge: this.fractureAge,
      stressLink: this.current.stressLink,
      shots: this.shots.length,
      angle: this.current.simulation.angle,
      camera: this.cameraPose(),
      physics: this.current.simulation.inspect(),
    };
  }
  dispose() {
    for (const shot of this.shots) {
      this.callbacks.onRemove(shot);
      shot.simulation.dispose();
    }
    this.shots.length = 0;
  }
}
