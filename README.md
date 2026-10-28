# First responding host

A static GitHub Pages app: opening the page loads a text list, checks HTTPS hosts one by one in file order, and displays only the winning hostname and a **Go** button linking to it. Reload to check again. No dependencies or build step.

GitHub Pages only serves static files; it cannot run a Rust or FastAPI server. This implementation runs in each visitor's browser, so it returns a hostname on the page, not through a server API or DNS response.

## Configure

Replace the examples in `hosts.txt` with your hostnames, one per line:

```text
# Mirrors
one.example.com
two.example.com
```

### Multiple lists

Add named files beside `index.html`, for example `motchill.txt` and `rophim.txt`, with the same one-hostname-per-line format. No code changes or list registry required.

| URL relative to your Pages site | List |
| --- | --- |
| `/` | `hosts.txt` |
| `/?list=motchill` | `motchill.txt` |
| `/?list=rophim` | `rophim.txt` |
| `/motchill` or `/motchill/` | Redirects to `/?list=motchill` |
| `/rophim` or `/rophim/` | Redirects to `/?list=rophim` |

For a project site, keep the repository prefix: `https://USER.github.io/REPO/motchill`. Named paths use GitHub Pages' `404.html` fallback to redirect to the main page. They are browser navigation routes, not plain-text API endpoints. Use `?list=NAME` locally because Python's basic static server does not serve the custom fallback. List names may contain letters, numbers, hyphens and underscores. Missing files or failed checks display a short error; **Go** is hidden until a host wins.

Blank lines and lines starting with `#` are ignored. Hostnames and full HTTPS URLs (for example `https://motchillt.cx/`) are accepted. URLs are reduced to their hostname; paths, queries and fragments are ignored, and checks always request the HTTPS root. URLs containing credentials or custom ports are rejected. Bare names must use ASCII DNS syntax (punycode for international names). Duplicates are removed after normalization. Every host must support HTTPS on port 443. The list is public; include only hosts you intend visitors to contact.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Opening `index.html` directly as a file will not work because the browser needs to fetch the text file.

## Publish on GitHub Pages

1. Upload these files to a GitHub repository, including `.nojekyll`.
2. Open **Settings → Pages → Build and deployment**.
3. Select **Deploy from a branch**, your branch, and **/ (root)**, then save.
4. Open the Pages URL GitHub provides. Relative asset paths support repository subpaths.

See [GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## What a response means

Cross-origin requests use `no-cors`, so hosts do not need to enable CORS. The browser hides status codes and response content: **404, 500, redirects, and network blocking pages can win**. This checks reachability, not application health. Browser policy, extensions, TLS failures, redirects and the visitor's network can affect results. Requests omit credentials and referrers and bypass the browser HTTP cache; intermediaries may still cache responses. Redirects are followed, and the result is the original configured hostname.

Checks start at the top of the selected text file and run one at a time. The first reachable host is selected, and later entries are not requested. A failed request, a visible HTTP error, or an 8-second timeout advances to the next host. Cross-origin opaque responses still hide HTTP errors, as described above. Each host has its own timeout, so a list of N unreachable hosts can take about N × 8 seconds, plus list loading. Loading the text file has a separate 8-second deadline. Requests are cancelled after each attempt; cancellation does not undo a request already received by a host.

For guaranteed HTTP success/content validation, use CORS-enabled health endpoints or host a backend outside GitHub Pages. See [MDN's description of opaque responses](https://developer.mozilla.org/en-US/docs/Web/API/Response/type).

## Test

With a modern Node.js version:

```sh
node --test --experimental-test-coverage *.test.mjs
```
