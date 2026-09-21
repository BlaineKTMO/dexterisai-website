# Dexteris AI — website

Static site. No build step, no dependencies. Open `index.html`, or drop the folder on
any static host (Netlify, Vercel, Cloudflare Pages, S3, GitHub Pages).

```
index.html                 all page content
favicon.svg
assets/styles.css          design system + layout
assets/app.js              theme toggle, nav, reveal, hero canvas
assets/logo.svg            the mark, standalone
assets/dexteris-mark.png   original logo (OG share image)
```

## Deployment

Served by GitHub Pages from `main`, at the apex domain in `CNAME` (dexterisai.com). `.nojekyll`
disables Jekyll processing. Push to `main` to publish.

Pages caches assets for 10 minutes, so `index.html` loads `styles.css` and `app.js` with a
`?v=` query. After editing either file, bump its value (the first 8 characters of
`md5 -q assets/app.js` is what's used now) or returning visitors keep the old copy.

## Design

Soft-UI, used sparingly. Depth is spent on four things only: the header bar, the hero
stage, the form fields, and the primary button. Everything else is flat and separated
by hairline rules, so the page reads as documentation rather than as a demonstration
of the shadow technique.

Palette comes from the logo — `#e8703a` orange, `#3a5d80` navy, on a blue-grey neutral
mixed toward the navy. Type is **Archivo** (display) over **IBM Plex Sans** (body) with
**IBM Plex Mono** for labels and data. Both light and dark themes are designed; the
theme follows the OS, and the header toggle overrides and persists it.

The hero canvas is the logo animated: the filled node is the base joint, the two
strokes are links, the open ring is the end effector, and the navy stroke is the rail.
It solves two-link IK toward targets it picks at random, and holds still under
`prefers-reduced-motion`.

## The contact form

Submissions POST to [Web3Forms](https://web3forms.com) from the browser and are delivered
to the inbox the access key was issued to. The key is public by design and lives in
`FORM_KEY` at the top of the form block in `assets/app.js`. A hidden `botcheck` checkbox
is the spam honeypot. If `FORM_KEY` is empty the form falls back to opening the visitor's
mail client addressed to `MAIL_TO`.

## Accessibility

Skip link, visible focus rings, `aria-expanded` on the mobile menu, reduced motion
respected. Content is visible at rest — the reveal animation only arms elements that
start below the fold, so the first paint is the finished page.
