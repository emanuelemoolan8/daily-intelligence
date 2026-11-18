#!/usr/bin/env bash
set -euo pipefail

# Extract a pinned eSpeak NG toolchain for the Ubuntu 24.04 x64 runner.
if command -v espeak-ng >/dev/null; then
  exit 0
fi

target="$RUNNER_TEMP/di-espeak"
mkdir -p "$target"
cd "$target"

while read -r digest directory package; do
  curl --fail --silent --show-error --location --connect-timeout 6 --max-time 20 \
    --retry 2 --retry-max-time 45 "https://deb.debian.org/debian/pool/main/$directory/$package" -o "$package"
  printf '%s  %s\n' "$digest" "$package" | sha256sum --check -
  dpkg-deb -x "$package" .
done <<'PACKAGES'
7c239b30e419897313b5b8c98123cf3ec871cfedbf43bbb956b985a492e37f19 e/espeak-ng espeak-ng-data_1.52.0+dfsg-5_amd64.deb
b64da7b5e21b3540a5cfe5a2fd5c650f6f366ffccb9b810eb337ea4677435d31 e/espeak-ng espeak-ng_1.52.0+dfsg-5_amd64.deb
845886095f5be3ba7680c8e15de068f76d67600275cbd7b6f6c7d00e53c05b34 e/espeak-ng libespeak-ng1_1.52.0+dfsg-5_amd64.deb
db95c30434707a60774ed9ad0193ba680e061ae7d99f354a1a93f147317a4ea5 p/pcaudiolib libpcaudio0_1.3-1_amd64.deb
07a1d67546465f07638be05f0931d79e0d6bb1a7831e1f67ac6611d1ba297009 s/sonic libsonic0_0.2.0-13+b1_amd64.deb
PACKAGES

lib="$target/usr/lib/x86_64-linux-gnu"
export LD_LIBRARY_PATH="$lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ESPEAK_DATA_PATH="$lib"
"$target/usr/bin/espeak-ng" --version
printf '%s\n' "$target/usr/bin" >> "$GITHUB_PATH"
printf 'LD_LIBRARY_PATH=%s\nESPEAK_DATA_PATH=%s\n' "$LD_LIBRARY_PATH" "$ESPEAK_DATA_PATH" >> "$GITHUB_ENV"
