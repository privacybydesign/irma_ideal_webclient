#!/usr/bin/env bash

set -euxo pipefail

if [ "$#" != 1 ]
then
  echo "No language specified, assuming nl"
  LANG="nl"
else
  LANG="$1"
fi

rm -rf build

cp -r src build
rm build/messages.*
cp "src/messages.$LANG.js" "build/messages.$LANG.js"
rm build/*.example.*

mkdir build/assets
cp node_modules/bootstrap/dist/css/bootstrap.min.css build/assets/bootstrap.min.css
cp node_modules/bootstrap/dist/css/bootstrap.min.css.map build/assets/bootstrap.min.css.map
cp node_modules/jquery/dist/jquery.min.js build/assets/jquery.min.js
cp node_modules/@privacybydesign/irma-frontend/dist/irma.js build/assets/irma.js
