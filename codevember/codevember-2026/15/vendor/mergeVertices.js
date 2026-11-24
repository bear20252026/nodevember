// Three.js MIT, pinned at 4f5d6bc0c7ec777e06703b56c7b7089e99be11d5. See THREE-LICENSE.
// Temporary local copy of https://github.com/mrdoob/three.js/pull/35563.
import { Uint16BufferAttribute, Uint32BufferAttribute } from 'three/webgpu';
import { remapAttribute } from 'three/addons/utils/BufferGeometryUtils.js';

const _hashFloat64 = new Float64Array( 1 );
const _hashInt32 = new Int32Array( _hashFloat64.buffer );

export function mergeVertices( geometry, tolerance = 1e-4 ) {

	tolerance = Math.max( tolerance, Number.EPSILON );

	const indices = geometry.getIndex();
	const attributes = Object.values( geometry.attributes );

	let stride = 0;
	for ( const attr of attributes ) stride += attr.itemSize;

	const sourceCount = attributes.length > 0 ? attributes[ 0 ].count : 0;
	const vertexCount = indices ? indices.count : sourceCount;

	// quantize source attributes to the tolerance grid
	const halfTolerance = tolerance * 0.5;
	const hashMultiplier = Math.pow( 10, Math.log10( 1 / tolerance ) );
	const hashAdditive = halfTolerance * hashMultiplier;

	const quantized = new Float64Array( sourceCount * stride );
	let offset = 0;

	for ( const attr of attributes ) {

		const itemSize = attr.itemSize;

		for ( let i = 0; i < sourceCount; i ++ ) {

			for ( let k = 0; k < itemSize; k ++ ) {

				const v = Math.trunc( attr.getComponent( i, k ) * hashMultiplier + hashAdditive ) + 0;
				quantized[ i * stride + offset + k ] = v === v ? v : 0.5;

			}

		}

		offset += itemSize;

	}

	// deduplicate via open-addressed hash table (slots hold source index + 1, 0 means empty)
	let tableSize = 1;
	while ( tableSize < sourceCount * 2 ) tableSize <<= 1;
	const tableMask = tableSize - 1;
	const table = new Int32Array( tableSize );

	const remap = new Int32Array( sourceCount );
	const sourceIndicesAll = new Uint32Array( sourceCount );
	const newIndices = new Uint32Array( vertexCount );
	let nextIndex = 0;

	for ( let i = 0; i < vertexCount; i ++ ) {

		const index = indices ? indices.getX( i ) : i;
		let merged = remap[ index ];

		if ( merged === 0 ) {

			const base = index * stride;
			let hash = 0x811c9dc5 | 0;

			for ( let k = 0; k < stride; k ++ ) {

				_hashFloat64[ 0 ] = quantized[ base + k ];
				hash = ( Math.imul( hash, 0x9e3779b1 ) + ( _hashInt32[ 0 ] ^ _hashInt32[ 1 ] ) ) | 0;

			}

			let slot = ( Math.imul( hash ^ ( hash >>> 16 ), 0x85ebca6b ) >>> 13 ) & tableMask;

			while ( true ) {

				const entry = table[ slot ];

				if ( entry === 0 ) {

					sourceIndicesAll[ nextIndex ] = index;
					merged = ++ nextIndex;
					table[ slot ] = index + 1;
					break;

				}

				const otherBase = ( entry - 1 ) * stride;
				let match = true;

				for ( let k = 0; k < stride; k ++ ) {

					if ( quantized[ otherBase + k ] !== quantized[ base + k ] ) {

						match = false;
						break;

					}

				}

				if ( match ) {

					merged = remap[ entry - 1 ];
					break;

				}

				slot = ( slot + 1 ) & tableMask;

			}

			remap[ index ] = merged;

		}

		newIndices[ i ] = merged - 1;

	}

	// generate result BufferGeometry
	const sourceIndices = sourceIndicesAll.subarray( 0, nextIndex );
	const buffers = new Map();
	const result = geometry.clone();
	for ( const name in geometry.attributes ) {

		result.setAttribute( name, remapAttribute( geometry.attributes[ name ], sourceIndices, buffers ) );

	}

	for ( const name in geometry.morphAttributes ) {

		result.morphAttributes[ name ] = geometry.morphAttributes[ name ].map( attribute => remapAttribute( attribute, sourceIndices, buffers ) );

	}

	// indices

	result.setIndex( nextIndex > 65535 ? new Uint32BufferAttribute( newIndices.buffer, 1 ) : new Uint16BufferAttribute( newIndices, 1 ) );

	return result;

}
