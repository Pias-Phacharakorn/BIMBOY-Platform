# Guest demo models

The `.frag` files served to guests at `/demo`. Everything here is a plain static
asset: Vite copies `public/` into `dist/` verbatim, and Cloudflare serves it. No
Supabase, no auth, no RLS is involved in the guest demo.

## Adding models

1. Drop your `.frag` files in this folder.
2. List them in `manifest.json` — a static host cannot list a directory, so this
   file is the index. Order matters: **the first entry loads alone** before the
   rest (ADR-0015 — FRAGS and OBC must agree on the base model, or section fills
   land displaced from their geometry). Put your main coordination model first.

```json
{
  "models": [
    { "file": "architecture.frag", "label": "Architecture" },
    { "file": "structure.frag",    "label": "Structure" },
    { "file": "mep-hvac.frag",     "label": "MEP — HVAC" }
  ]
}
```

`label` is optional and becomes the model id shown in the Models list; it
defaults to the file name without its extension.

An empty `models` array is valid — the demo simply opens an empty viewer and logs
a console warning.

## Constraints

- **25 MiB per file** is Cloudflare Workers' hard limit for a static asset. A
  larger `.frag` cannot be served this way; host it in Supabase storage instead.
- These are binaries in git history forever. `public/` is already ~24 MB
  (Cesium), so consider Git LFS if the demo set is large.
- Filenames are URL-encoded when fetched, but spaces and `#` still make for
  fragile URLs — prefer `kebab-case.frag`.
