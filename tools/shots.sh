#!/usr/bin/env bash
# Screenshot every page through headless Edge, so the site can be checked without a visible browser.
#   bash tools/shots.sh <out-dir> [width] [height]
# tools/scroll-harness.html frames a scrolly page once per panel; tools/phone-harness.html?p=/x/&y=0,900
# frames any page at 390 px (headless windows cannot go below ~500). Needs the preview server (tools/serve.py) on :4317. WebGL runs on SwiftShader, so 3D stages are slow
# and big robot models may not finish within the budget; that is the harness, not the page.
set -u
out="${1:?out dir}"; w="${2:-1440}"; h="${3:-5200}"
edge="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
mkdir -p "$out"
for p in "" ornimetrics comu catalyst robotics hardware channel; do
  name="${p:-home}"
  "$edge" --headless=new --hide-scrollbars --use-angle=swiftshader --enable-unsafe-swiftshader \
    --window-size="$w,$h" --virtual-time-budget=40000 \
    --screenshot="$out/$name-$w.png" "http://localhost:4317/$p${p:+/}" >/dev/null 2>&1
  echo "$name-$w.png"
done
