/**
 * Bundle validator caps, in a module with no Node-only imports so client
 * components (the Creator UI) can surface them without pulling in zlib.
 */
export const BUNDLE_MAX_ZIP_BYTES = 25 * 1024 * 1024;
export const BUNDLE_MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
export const BUNDLE_MAX_FILES = 500;
