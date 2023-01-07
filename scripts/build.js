const flags = [];
const DEBUG = Deno.env.get('DEBUG');

if (Deno.env.get('FAST')) {
  flags.push('--no-check', '--quiet');
}

function logPublicContent() {
  console.table(
    Array.from(Deno.readDirSync('public')).reduce((table, entry) => {
      const { size, mtime } = Deno.statSync('public/' + entry.name);

      table[entry.name] = {
        size,
        modified: new Date(mtime).toLocaleTimeString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
          fractionalSecondDigits: 3,
        }),
      };

      return table;
    }, {}),
  );
}

if (DEBUG) {
  logPublicContent();

  await Deno.run({
    cmd: ['git', 'branch', '--all'],
  }).status();
}

async function downloadVendor(source, filename, modify = (c) => c) {
  try {
    await Deno.stat(`public/${filename}`);
  } catch {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${res.url}. ${res.status} ${res.statusText}`);
    }
    const content = await res.text();
    await Deno.writeTextFile(`public/${filename}`, modify(content));
  }
}

const result = Promise.all([
  Deno.run({
    cmd: ['deno', 'bundle', ...flags, 'app/src/main.ts', 'public/main.bundle.js'],
  }).status(),

  Deno.run({
    cmd: ['deno', 'bundle', ...flags, 'client/src/script.ts', 'public/script.bundle.js'],
  }).status(),

  downloadVendor('https://unpkg.com/mermaid@9.2.1/dist/mermaid.min.js', 'mermaid.min.js'),

  downloadVendor(
    'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.1.0/github-markdown.min.css',
    'github-markdown.min.css',
    (content) => {
      return content
        .replace('@media (prefers-color-scheme:dark){', '')
        .replace('}@media (prefers-color-scheme:light){.markdown-body', '.markdown-body.light')
        .replace('--color-danger-fg:#cf222e}', '--color-danger-fg: #cf222e;');
    },
  ),
]);

result.catch(console.error);

if (DEBUG) {
  result.then(logPublicContent);
}
