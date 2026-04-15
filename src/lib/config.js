/**
 * Single-tenant resort configuration.
 * Each deployment serves one resort — change via environment variable.
 */
export const RESORT_ID = Number(import.meta.env.VITE_RESORT_ID) || 1;
