# IRMA IDeal server

This is the webapp for the iDeal-only issuer. It can be used as a front-end for the 
[go-ideal-server](https://github.com/privacybydesign/go-ideal-issuer).

## Configuration
In `config.js` the URL of go-ideal-server's IDeal API endpoint must be specified.

## Building
The following commands have to be run:

    yarn install
    ./build.sh <language>

The build will be in the `build` directory.
