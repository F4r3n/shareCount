#!/usr/bin/env bash

# Usage: ./generate-assetlinks.sh <keystore.jks> <keystore-password> <tauri.conf.json> <alias>
# Example: ./generate-assetlinks.sh my-release-key.jks myPassword ./src-tauri/tauri.conf.json myappalias

set -euo pipefail

KEYSTORE="$1"
PASS="$2"
CONF="$3"
ALIAS="$4"
OUTPUT_FILE="assetlinks.json"

# 1. Extract bundle identifier from tauri.conf.json using grep and sed
APP_BUNDLE_ID=$(grep -oP '(?<="identifier": ")[^"]+' "$CONF")

# 2. Replace - with _ for Android asset link format
ANDROID_PACKAGE="${APP_BUNDLE_ID//-/_}"

# 3. Extract SHA256 cert fingerprints using keytool
FINGERPRINTS=$(keytool -list -v -keystore "$KEYSTORE" -storepass "$PASS" -alias "$ALIAS" \
  | grep "SHA256:" | awk '{print "\"" $2 "\""}' | paste -sd, -)

if [ -z "$FINGERPRINTS" ]; then
  echo "No SHA256 fingerprints found."
  exit 1
fi

cat > "$OUTPUT_FILE" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "$ANDROID_PACKAGE",
      "sha256_cert_fingerprints": [
        $FINGERPRINTS
      ]
    }
  }
]
EOF

echo "Generated $OUTPUT_FILE successfully."
