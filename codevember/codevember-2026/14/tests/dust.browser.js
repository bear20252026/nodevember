import { Vector3 } from "three/webgpu";

export async function checkDust(app) {
  const { dust, renderer, camera } = app;
  const empty = { shots: [] };
  const read = async (node) =>
    new Float32Array(await renderer.getArrayBufferAsync(node.value));
  const initialize = () => {
    dust.clear();
    dust.update(renderer, empty, camera);
  };
  const savedStrength = dust.strength.value;
  const checkDisabled = () => {
    dust.strength.value = 0;
    dust.advance(1);
    dust.update(
      {
        compute() {
          throw new Error("Disabled dust cannot dispatch GPU work");
        },
      },
      empty,
      camera,
    );
    if (dust.mesh.visible || dust.wakeCount !== 0)
      throw new Error("Disabled dust must be hidden and inactive");
    dust.strength.value = 1;
  };
  try {
    checkDisabled();
    initialize();
    if (!dust.mesh.visible)
      throw new Error("Re-enabling dust must restore rendering");
    const positions = await read(dust.positions);
    const point = new Vector3(...positions.slice(0, 3));
    dust.advance(1 / 60);
    dust.update(renderer, empty, camera);
    const ambient = await read(dust.velocities);
    initialize();
    const moving = {
      shots: [
        {
          z: 0,
          simulation: {
            links: [
              {
                position: [point.x - 0.15, point.y, point.z],
                velocity: [3, 0, 0],
              },
            ],
            fragments: [],
          },
        },
      ],
    };
    dust.advance(1 / 60);
    dust.update(renderer, moving, camera);
    const wake = await read(dust.velocities);
    if (!wake.every(Number.isFinite) || wake[0] - ambient[0] < 0.08)
      throw new Error("Moving links must accelerate nearby GPU dust");
    checkDisabled();
    initialize();
    dust.burst(new Vector3(point.x - 0.3, point.y, point.z));
    dust.advance(1 / 60);
    dust.update(renderer, empty, camera);
    const shock = await read(dust.velocities);
    if (!shock.every(Number.isFinite) || shock[0] - ambient[0] < 0.08)
      throw new Error("Fractures must push GPU dust outward");
    initialize();
    return {
      disabledSkipsCompute: true,
      particles: dust.mesh.geometry.instanceCount,
      wake: wake[0] - ambient[0],
      shock: shock[0] - ambient[0],
    };
  } finally {
    dust.strength.value = savedStrength;
    dust.clear();
    dust.update(renderer, empty, camera);
  }
}
