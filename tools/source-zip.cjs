const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const limit = 5_000_000;
const git = args => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });

try {
  if (git(['status', '--porcelain', '--untracked-files=no']).toString().trim()) {
    throw new Error('Commit tracked changes before exporting so the ZIP matches the source commit.');
  }
  const files = git(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).toString().split('\0').filter(Boolean);
  const excluded = files.filter(file =>
    /^(?:node_modules|out|data|dist|\.git)\//i.test(file) ||
    (/(?:^|\/)\.env(?:\.|$)/i.test(file) && file !== '.env.example') ||
    /\.(?:db|sqlite|sqlite3)(?:-wal|-shm)?$/i.test(file));
  if (excluded.length) throw new Error(`Remove private or generated files from Git before exporting: ${excluded.join(', ')}`);
  const commit = git(['rev-parse', '--short', 'HEAD']).toString().trim();
  const output = path.resolve(process.argv[2] || path.join(root, '..', `InvenTrack-Source-${commit}.zip`));
  if (path.extname(output).toLowerCase() !== '.zip') throw new Error('Choose a .zip output path.');
  const archive = git(['archive', '--format=zip', '--prefix=InvenTrack/', 'HEAD']);
  if (archive.length >= limit) throw new Error(`Source ZIP is ${archive.length} bytes. The upload limit is strictly below ${limit} bytes.`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, archive, { flag: 'wx' });
  console.log(`Created ${output}\n${archive.length} bytes (${(archive.length / 1_000_000).toFixed(2)} MB), below the 5 MB upload limit.\nSource commit: ${commit}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
