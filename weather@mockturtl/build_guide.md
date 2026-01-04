# Build Guide

Requires node/npm.

```bash
npm ci
```

## Build for 3.8

To build and watch for changes

```bash
npm run watch

```

To Test

```bash
# Will copy the built files into the correct folder and restart the applet - only the applet!
./test.sh
```

## Build for 3.0

3.0 was deprecated in April 2021, but the src is kept for that version. can build it with `./src/3_0/build3_0.sh`.

_Note: You won't be able to build it anymore unless you fix all type errors - the library declarations need `strict` and `exactOptionalPropertyTypes` enabled._
