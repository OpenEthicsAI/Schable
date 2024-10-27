# Schable
Schable: Schema into Table

A JavaScript tool to visualize JSON Schema as HTML Table.

To test, install `node.js` if not yet installed, navigate to the repo folder and launch `server.js`.

1. Add JS and CSS in the header

```html
<link href="/src/schable.css" rel="stylesheet" >
<script src="/src/schable.js"></script>
```

2. Call schable(), specifying the div class

```html
<script>
    const jsonSchemaUrl = "https://openethics.ai/schema/oedp.passport.schema.json";
    schable(jsonSchemaUrl, ".oedp", captions = true, proxy = true, max_depth = 12);
</script>
<div class="oedp"></div>
```