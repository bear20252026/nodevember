"""Join matched camera retreats with a short circular dissolve through mist."""
import argparse
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='MP4 produced by capture-server.py')
    parser.add_argument('output', type=Path, help='Final looping MP4')
    parser.add_argument('--blend-frames', type=int, help='Shorten the dissolve within the recorded overlap')
    args = parser.parse_args()
    metadata = json.loads(args.source.with_suffix('.json').read_text())
    frames = metadata['frames']
    fps = metadata['fps']
    padding = metadata['loopBlendFrames']
    blend = args.blend_frames if args.blend_frames is not None else padding
    if not 0 < blend <= padding < frames / 2:
        parser.error('Capture is too short for the loop overlap')
    if args.output.exists() or args.output.with_suffix('.json').exists():
        parser.error('Output exists; choose another filename')
    if frames - padding != round(metadata['finalDuration'] * fps):
        parser.error('Source length and overlap do not produce the requested final duration')
    tail = frames - blend
    head = padding - blend
    # Move the opening overlap to the end. The last blended frame is exactly
    # the opening's frame padding-1; playback continues at frame padding.
    ramp = f'min(1,(T+1/{fps})/({blend}/{fps}))'
    alpha = f'({ramp})*({ramp})*(3-2*({ramp}))'
    graph = (
        '[0:v]split=3[middle][tail][head];'
        f'[middle]trim=start_frame={padding}:end_frame={tail},setpts=PTS-STARTPTS[m];'
        f'[tail]trim=start_frame={tail}:end_frame={frames},setpts=PTS-STARTPTS[t];'
        f'[head]trim=start_frame={head}:end_frame={padding},setpts=PTS-STARTPTS[h];'
        f"[t][h]blend=all_expr='A*(1-({alpha}))+B*({alpha})'[wrap];"
        '[m][wrap]concat=n=2:v=1:a=0[out]'
    )
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'warning', '-n',
        '-i', str(args.source), '-filter_complex', graph, '-map', '[out]',
        '-an', '-c:v', 'libx264', '-threads', '4', '-preset', 'medium',
        '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        str(args.output),
    ], check=True)
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-count_frames', '-show_entries',
        'stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration',
        '-of', 'json', str(args.output),
    ]))
    stream = probe['streams'][0]
    output_frames = frames - padding
    if (int(stream['nb_read_frames']) != output_frames
            or (stream['width'], stream['height']) != (1024, 1024)
            or stream['avg_frame_rate'] != f'{fps}/1'
            or abs(float(probe['format']['duration']) - output_frames / fps) > .001):
        raise RuntimeError('Loop encoding failed verification')
    events = [{**event, 'frame': event['frame'] - padding, 'time': event['time'] - padding / fps}
              for event in metadata.get('events', []) if padding / fps <= event['time'] < tail / fps]
    report = {
        **{k: v for k, v in metadata.items()
           if k not in ('sourceFrameSHA256', 'uniqueSourceFrames', 'elapsedSeconds')},
        'source': str(args.source), 'sourceFrames': frames,
        'sourceUniqueFrames': metadata['uniqueSourceFrames'],
        'sourceDuration': metadata['duration'], 'sourceEvents': metadata.get('events', []),
        'sourcePaddingFrames': padding, 'loopBlendFrames': blend,
        'frames': output_frames, 'totalFrames': output_frames,
        'duration': output_frames / fps, 'events': events, 'probe': probe,
        'loop': {
            'overlapFrames': blend,
            'overlapSeconds': blend / fps,
            'method': 'Smooth circular crossfade between matching camera retreats after every loaded path has broken',
            'firstSourceFrame': padding,
            'lastSourceFrame': padding - 1,
        },
    }
    args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'path': str(args.output), 'frames': output_frames, 'seconds': output_frames / fps}))


if __name__ == '__main__':
    main()
