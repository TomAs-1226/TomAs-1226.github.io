"""Export an O0X board from KiCad to a web-ready GLB.

    python tools/export-board.py o0x-m
    python tools/export-board.py o0x-s
    python tools/export-board.py mote=~/dev/F1C200sBoard/f1c200s_core.kicad_pcb
    python tools/export-board.py fox80=~/dev/Fox80/hardware/Fox80.kicad_pcb

The board files are read from ~/dev/O0X/hardware and never written. Two things stand between a
plain `kicad-cli pcb export glb` and a complete model:

1. The parts inherited from O1X point at EasyEDA's .wrl models (`easyeda/o1x.3dshapes/X.wrl`).
   KiCad's raytracer can draw VRML, but the GLB export goes through OpenCascade, which only reads
   STEP, so the camera connectors, microSD slot, terminal block and half the passives silently drop
   out. The STEP twins sit in hardware/lib/o1x-inherited/o1x.3dshapes, so a scratch copy of the
   board is pointed at those instead.
2. The export is 20+ MB of uncompressed per-part meshes; tools/bake-board.mjs fixes that.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
O0X = os.path.expanduser("~/dev/O0X/hardware")
STEPS = os.path.join(O0X, "lib", "o1x-inherited", "o1x.3dshapes").replace("\\", "/")
CLI = os.path.expanduser("~/AppData/Local/Programs/KiCad/10.0/bin/kicad-cli.exe")


def main(arg):
    # "tag" is an O0X board; "name=path/to/board.kicad_pcb" is any other board.
    tag, _, path = arg.partition("=")
    src = os.path.expanduser(path) if path else os.path.join(O0X, tag + ".kicad_pcb")
    out = os.path.join(SITE, "models", tag + ".glb")
    stem = os.path.splitext(src)[0]
    with tempfile.TemporaryDirectory() as tmp:
        # The project file carries the board's settings; copy it beside the board.
        shutil.copy(src, os.path.join(tmp, tag + ".kicad_pcb"))
        if os.path.exists(stem + ".kicad_pro"):
            shutil.copy(stem + ".kicad_pro", os.path.join(tmp, tag + ".kicad_pro"))
        board = os.path.join(tmp, tag + ".kicad_pcb")
        text = open(board, encoding="utf-8").read()
        text, n = re.subn(r'\(model "easyeda/o1x\.3dshapes/([^"]+)\.wrl"',
                          lambda m: '(model "%s/%s.step"' % (STEPS, m.group(1)), text)
        missing = [p for p in re.findall(r'\(model "%s/([^"]+)"' % re.escape(STEPS), text)
                   if not os.path.exists(os.path.join(STEPS, p))]
        if missing:
            sys.exit("no STEP for: " + ", ".join(sorted(set(missing))))
        open(board, "w", encoding="utf-8", newline="\n").write(text)
        print("%s: %d EasyEDA models pointed at STEP" % (tag, n))

        raw = os.path.join(tmp, tag + "-raw.glb")
        r = subprocess.run([CLI, "pcb", "export", "glb", "-f", "--subst-models",
                            "--include-tracks", "--include-pads", "--include-soldermask",
                            "--include-silkscreen", "-o", raw, board],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(raw):
            sys.exit("export failed (rc=%d): %s" % (r.returncode, (r.stderr or r.stdout)[-500:]))
        skipped = r.stdout.count("without geometry data") + r.stderr.count("without geometry data")
        print("%s: exported %.1f MB (%d empty nodes skipped by KiCad)" % (tag, os.path.getsize(raw) / 1e6, skipped))

        r = subprocess.run(["node", os.path.join(HERE, "bake-board.mjs"), raw, out], cwd=HERE)
        if r.returncode != 0:
            sys.exit("bake failed")


if __name__ == "__main__":
    for t in sys.argv[1:] or ["o0x-m", "o0x-s"]:
        main(t)
