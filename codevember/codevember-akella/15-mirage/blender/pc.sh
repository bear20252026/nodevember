#!/bin/sh
# build.py on the Windows RTX PC, detached, so it keeps going if this Mac sleeps.
#   ./pc.sh sync                      upload build.py, data/ and assets/ (assets only once: they do not change)
#   ./pc.sh start <job> [build args]  build the scene there and render into renders/<job>/
#   ./pc.sh status <job>              frames done, the last lines of its log
#   ./pc.sh fetch <job>               copy the frames back into renders/<job>/
#   ./pc.sh stop                      stop this script's renders, and nothing else
# Needs Tailscale up on the Mac (/Applications/Tailscale.app/Contents/MacOS/Tailscale up).
set -e
cd "$(dirname "$0")"

HOST=${RENDER_HOST:-akell@100.73.214.25}
BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
RDIR=renders/mirage

# LogLevel=ERROR drops the post-quantum warning at the source
rsh() { ssh -o BatchMode=yes -o LogLevel=ERROR "$HOST" "$@" 2>&1 || true; }

case "$1" in
sync)
    rsh "New-Item -ItemType Directory -Force $RDIR/data, $RDIR/assets | Out-Null"
    scp -q -o BatchMode=yes -o LogLevel=ERROR build.py "$HOST:$RDIR/"
    scp -q -o BatchMode=yes -o LogLevel=ERROR data/* "$HOST:$RDIR/data/"
    THERE=$(rsh "(Get-ChildItem $RDIR/assets -Recurse -File | Measure-Object).Count" | tr -dc 0-9)
    if [ "${THERE:-0}" -lt "$(find assets -type f | wc -l | tr -dc 0-9)" ]; then
        scp -q -r -o BatchMode=yes -o LogLevel=ERROR assets/* "$HOST:$RDIR/assets/"
    fi
    echo synced
    ;;
start)
    JOB=$2
    shift 2
    scp -q -o BatchMode=yes -o LogLevel=ERROR build.py "$HOST:$RDIR/"
    # Win32_Process.Create starts Blender outside the SSH session, so it survives disconnects
    rsh "\$d = (Resolve-Path $RDIR).Path
         \$cmd = 'cmd /c \"\"$BLENDER\" -b --factory-startup -P build.py -- --out renders/$JOB --device OPTIX $* > $JOB.log 2>&1\"'
         \$r = Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine=\$cmd; CurrentDirectory=\$d}
         'started pid ' + \$r.ProcessId"
    ;;
status)
    rsh "\$n = @(Get-ChildItem $RDIR/renders/$2/f_*.png -ErrorAction SilentlyContinue).Count
         \$run = @(Get-CimInstance Win32_Process -Filter \"Name='blender.exe'\" | Where-Object { \$_.CommandLine -like '*build.py*' }).Count
         'frames: ' + \$n + '   running: ' + \$run
         Select-String -Path $RDIR/$2.log -Pattern '\[mirage\]|Error|Traceback' | Select-Object -Last 6 | % { \$_.Line.Trim() }
         Get-Content $RDIR/$2.log -Tail 1"
    ;;
fetch)
    mkdir -p "renders/$2"
    scp -q -o BatchMode=yes -o LogLevel=ERROR "$HOST:$RDIR/renders/$2/f_*.png" "renders/$2/"
    echo "fetched $(ls renders/$2/*.png | wc -l | tr -d ' ') frames into renders/$2/"
    ;;
stop)
    rsh "Get-CimInstance Win32_Process -Filter \"Name='blender.exe'\" | Where-Object { \$_.CommandLine -like '*build.py*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId }; 'stopped'"
    ;;
*)
    sed -n 2,8p "$0"; exit 1
    ;;
esac
