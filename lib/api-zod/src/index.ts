// Re-export the Zod runtime validators generated from the OpenAPI spec.
//
// The generated TypeScript interfaces in ./generated/types share the same
// identifiers as the validators (Orval's `mode: split` design), so a flat
// `export * from "./generated/types"` collides on every shared name. Consumers
// who need the TypeScript types should import them from
// `@workspace/api-client-react` (which already exposes them) or pull them
// directly out of the namespaced re-export below.
export * from "./generated/api";
export * as Types from "./generated/types";
