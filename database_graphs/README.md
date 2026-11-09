# RYA Wellbeing Data Platform

## Local development

Install dependencies with `npm install`, keep the existing database configuration in `.env`, then run:

```sh
node server.js
```

The default port is 3000. Restart the server after changing `server.js`.

## Pages

| Page | File | Local URL |
| --- | --- | --- |
| Home | `public/index.html` | `http://localhost:3000/` or `http://localhost:3000/index.html` |
| Explore Data | `public/explore.html` | `http://localhost:3000/explore.html` |
| About | `public/about.html` | `http://localhost:3000/about.html` |

The old `/home.html` URL redirects to `/index.html`. The old `/explore` URL redirects to `/explore.html`, retaining query parameters.

Domain and indicator links continue to work, for example:

```text
/explore.html?domain=mental&indicator=depression
```

`explore.html` loads `app.js` followed by `explore-entry.js`, so direct page visits support domain selection and the unified navigation without server-side script injection.

Home and About share `home.css` and `home.js`; these asset names are unchanged. Data continues to use `style.css`, `app.js`, and the scoped `explore-header` adapter. Data APIs and database configuration are unchanged.
