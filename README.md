# Schable
Schable: Schema into Table

A JavaScript tool to visualize JSON Schema as HTML Table.

To test, install `node.js` if not yet installed, navigate to the repo folder and launch `server.js`.

1. Add JS and CSS in the header

```html
<link href="/src/css/schable.css" rel="stylesheet" >
<script src="/src/js/schable.js"></script>
```

2. Call schable(), specifying the div class. Set `proxy = true` when using on `localhost`.

```html
<script>
    const jsonSchemaUrl = "https://openethics.ai/schema/oedp/oedp.passport.schema.json";
    schable(jsonSchemaUrl, ".oedp", captions = true, proxy = false, max_depth = 12);
</script>
<div class="oedp"></div>
```