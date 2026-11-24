import { MeshletDrawingPipeline } from './vendor/MirageMeshletDrawingPipeline.js';
import { StorageBufferAttribute } from 'three/webgpu';

export class MirageDrawingPipeline extends MeshletDrawingPipeline {
  constructor(options) {
    super(options);
    this._scaledClusters = new WeakSet();
    const pool = this._geometryPool;
    // Upstream grows these shared buffers by 50%. Spare capacity can cross
    // the device binding limit even when all actual geometry fits comfortably.
    // Cap the allocation, keeping the normal incremental upload mechanism.
    pool.reserve = (vertices, indices) => {
      const limit = Math.min(this.renderer.backend.device.limits.maxStorageBufferBindingSize, this.renderer.backend.device.limits.maxBufferSize);
      for (const [name, required, used, Type, stride] of [
        ['vertex', vertices * 4, pool.vertexEnd * 4, Float32Array, 4],
        ['index', indices, pool.indexEnd, Uint32Array, 1]
      ]) {
        const current = pool[`${name}Array`];
        if (required <= current.length) continue;
        const maxElements = Math.floor(limit / (4 * stride)) * stride;
        if (required > maxElements) throw new Error(`Meshlet ${name} data exceeds the device storage-buffer limit.`);
        const capacity = Math.min(maxElements, Math.max(required, Math.ceil(current.length * 1.5 / stride) * stride));
        const array = new Type(capacity); array.set(current.subarray(0, used));
        pool.retired.push(pool[`${name}Attribute`]);
        const attribute = new StorageBufferAttribute(array, stride);
        pool[`${name}Array`] = array; pool[`${name}Attribute`] = attribute;
        pool[`${name}Node`].value = attribute; pool[`${name}Node`].bufferCount = attribute.count;
      }
    };
  }
  _getClusters(geometry, group = null, prepare = false) {
    const clusters = super._getClusters(geometry, group, prepare);
    if (clusters !== null && !this._scaledClusters.has(clusters)) {
      this._scaledClusters.add(clusters);
      const scale = geometry.userData.meshletErrorScale ?? 1;
      if (scale !== 1) for (const level of clusters.lodOffsetValues) level.w *= scale;
    }
    // Vehicle contacts, wheel tracks and stitched terrain rings sample these
    // exact triangles. Keep their surfaces fixed across perspective and shadow
    // passes while retaining GPU cluster and frustum culling.
    if (clusters !== null && Boolean(geometry.userData.preserveSurface)) clusters.lodCount = 1;
    return clusters;
  }
  _getBatchKey(clusters) {
    // Articulated rover parts share a small material family. Batch these
    // together so every bolt assembly does not require its own GPU dispatch.
    const family = clusters.geometry.userData.meshletFamily;
    if (typeof family === 'string') return `${family}:${clusters.layoutKey}`;
    // Gravel must not inherit the much larger per-object work queues of a cliff.
    return clusters;
  }
  _getCullingCapacity(entries, capacities, occlusion, shadow, clusterBudget = 0) {
    // Small masonry/tire batches can all enter a cascade after a camera cut.
    // Keep their complete queues: the upstream asynchronous estimate can
    // shrink them to a distant view and then omit casters on the first frame
    // of a closer view. Large cliff batches retain measured allocation.
    if (shadow) for (const entry of entries) {
      if (entry.maxChunks <= 128) { entry.queueBudget = Infinity; entry.queueMeasured = true; }
    }
    // Reserve the actual largest adjacent pair, not two copies of LOD 0.
    // Doubling every initial queue exceeds the 128 MiB storage binding limit.
    entries.forEach((entry, i) => {
      if (entry.queueBudget !== Infinity) return;
      let largestPair = 0;
      for (const clusters of entry.objectClusters) {
        const levels = clusters.lodOffsetValues.slice(0, clusters.lodCount);
        for (let j = 0; j < levels.length; j++) {
          largestPair = Math.max(largestPair, (levels[j].y + (levels[j + 1]?.y ?? 0)) / 64);
        }
      }
      entry.queueBudget = capacities[i] * Math.max(entry.maxChunks, largestPair);
      // Large rock/terrain batches need a visible-cluster budget, not every
      // instance at its finest LOD. Otherwise modest instance-count growth
      // can overflow the shared 128 MiB queue before startup's first frame.
      // Measured overflow still grows the queue through the normal readback.
      if (entry.maxChunks > 128) entry.queueBudget = Math.min(entry.queueBudget, 131072);
    });
    const capacity = super._getCullingCapacity(entries, capacities, occlusion, shadow, clusterBudget);
    // The upstream four-million-cluster initial budget is very expensive on
    // a shared-memory GPU, especially with two cascades and a reflected view.
    // Retain its overflow-driven growth, starting with a measured-safe 1M.
    capacity.clusters = Math.min(capacity.clusters, Math.max(1 << 20, Math.ceil(clusterBudget * 1.5)));
    return capacity;
  }
}
