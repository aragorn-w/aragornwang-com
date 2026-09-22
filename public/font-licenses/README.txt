Third-party fonts bundled with this site
========================================

This site vendors its webfonts instead of fetching them from a CDN at build
time, so the build does not depend on a third-party network service. The font
binaries live in src/assets/fonts/ and are emitted to /_astro/fonts/.

Both families are licensed under the SIL Open Font License, Version 1.1. The
complete license texts, including the upstream copyright notices, are in this
directory and are served with the site.

  JetBrains Mono  Copyright 2020 The JetBrains Mono Project Authors
                  https://github.com/JetBrains/JetBrainsMono
                  see JetBrains-Mono-OFL.txt

  Newsreader      Copyright 2020 The Newsreader Project Authors
                  http://github.com/productiontype/Newsreader
                  see Newsreader-OFL.txt

The fonts remain under the OFL; the site's own source code is licensed
separately (see LICENSE at the repository root). The binaries are unmodified
copies of the Fontsource distributions. src/assets/fonts/MANIFEST.json records
the source URL and a SHA-256 for each file, which is the durable identifier
because the upstream URLs are @latest and their contents can change.
