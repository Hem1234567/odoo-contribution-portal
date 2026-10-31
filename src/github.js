import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import archiver from 'archiver';
import unzipper from 'unzipper';
import path from 'node:path';
import { packages, target, isPackagePath } from './config.js';

const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n')
});

async function botOctokit() {
  return app.getInstallationOctokit(Number(process.env.GITHUB_APP_INSTALLATION_ID));
}

const publicOctokit = new Octokit();

function excluded(filePath) {
  const parts = filePath.split('/');
  return parts.some(p => ['.git', 'node_modules', 'dist', 'coverage', '.venv', '__pycache__'].includes(p))
    || /(^|\/)\.env($|\.)/i.test(filePath)
    || filePath.endsWith('.log');
}

export async function createPackageZip(pkg) {
  const { data: sourceBranch } = await publicOctokit.rest.repos.getBranch({
    owner: target.sourceOwner, repo: target.sourceRepo, branch: process.env.SOURCE_REF || 'main'
  });
  const { data: sourceCommit } = await publicOctokit.rest.git.getCommit({
    owner: target.sourceOwner, repo: target.sourceRepo, commit_sha: sourceBranch.commit.sha
  });
  const { data: tree } = await publicOctokit.rest.git.getTree({
    owner: target.sourceOwner, repo: target.sourceRepo, tree_sha: sourceCommit.tree.sha, recursive: '1'
  });
  if (tree.truncated) throw new Error('Source repository tree is too large to package safely.');
  const selected = tree.tree.filter(item =>
    item.type === 'blob' && isPackagePath(pkg, item.path) && !excluded(item.path)
  );
  if (!selected.length) throw new Error(`No source files found for ${pkg.id}.`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  // Populate entries before returning the stream; archive finalization happens after all files are fetched.
  const entries = [];
  for (const item of selected) {
    if ((item.size || 0) > 20 * 1024 * 1024) throw new Error(`File exceeds package limit: ${item.path}`);
    const { data } = await publicOctokit.rest.git.getBlob({
      owner: target.sourceOwner, repo: target.sourceRepo, file_sha: item.sha
    });
    entries.push([Buffer.from(data.content, 'base64'), item.path]);
  }
  queueMicrotask(() => {
    for (const [content, name] of entries) archive.append(content, { name });
    archive.finalize();
  });
  return archive;
}

function safePath(p) {
  if (!p || p.includes('\\') || p.startsWith('/') || p.split('/').some(x => x === '..' || x === '.')) return false;
  return true;
}

async function readZip(buffer, pkg) {
  const directory = await unzipper.Open.buffer(buffer);
  const files = [];
  let total = 0;
  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const name = entry.path.replace(/^\.\/+/, '');
    if (!safePath(name)) throw Object.assign(new Error(`Unsafe ZIP path: ${name}`), { status: 400, expose: true });
    if (excluded(name)) throw Object.assign(new Error(`Submission contains a prohibited file: ${name}`), { status: 400, expose: true });
    if (!isPackagePath(pkg, name)) {
      throw Object.assign(new Error(`File is outside your assigned package: ${name}`), { status: 403, expose: true });
    }
    const content = await entry.buffer();
    total += content.length;
    if (total > 100 * 1024 * 1024) throw Object.assign(new Error('Expanded ZIP exceeds 100 MB.'), { status: 413, expose: true });
    files.push({ path: name, content });
  }
  if (!files.length) throw Object.assign(new Error('ZIP contains no files.'), { status: 400, expose: true });
  return files;
}

async function ensureBranch(octokit, branch) {
  try {
    const { data } = await octokit.rest.git.getRef({ ...target, ref: `heads/${branch}` });
    return data.object.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
    const { data: main } = await octokit.rest.git.getRef({ ...target, ref: 'heads/main' });
    await octokit.rest.git.createRef({ ...target, ref: `refs/heads/${branch}`, sha: main.object.sha });
    return main.object.sha;
  }
}

export async function submitPackage(pkg, zipBuffer, submitter) {
  const files = await readZip(zipBuffer, pkg);
  const octokit = await botOctokit();
  const parentSha = await ensureBranch(octokit, pkg.branch);
  const { data: parent } = await octokit.rest.git.getCommit({ ...target, commit_sha: parentSha });

  const additions = [];
  for (const file of files) {
    const { data: blob } = await octokit.rest.git.createBlob({
      ...target, content: file.content.toString('base64'), encoding: 'base64'
    });
    additions.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const { data: currentTree } = await octokit.rest.git.getTree({
    ...target, tree_sha: parent.tree.sha, recursive: '1'
  });
  const submittedPaths = new Set(files.map(file => file.path));
  const deletions = currentTree.tree
    .filter(item => item.type === 'blob' && isPackagePath(pkg, item.path))
    .filter(item => !submittedPaths.has(item.path))
    .map(item => ({ path: item.path, mode: item.mode, type: 'blob', sha: null }));
  const { data: tree } = await octokit.rest.git.createTree({
    ...target, base_tree: parent.tree.sha, tree: [...additions, ...deletions]
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    ...target,
    message: `chore(${pkg.id}): submit package from @${submitter}`,
    tree: tree.sha,
    parents: [parentSha]
  });
  await octokit.rest.git.updateRef({
    ...target, ref: `heads/${pkg.branch}`, sha: commit.sha, force: false
  });

  const { data: prs } = await octokit.rest.pulls.list({
    ...target, state: 'open', base: 'main', head: `${target.owner}:${pkg.branch}`
  });
  let pr;
  if (prs.length) {
    pr = prs[0];
  } else {
    const { data } = await octokit.rest.pulls.create({
      ...target,
      title: `Automated contribution: ${pkg.title}`,
      head: pkg.branch,
      base: 'main',
      body: [
        `Automated package submission by @${submitter}.`,
        '',
        `Assigned paths: ${pkg.roots.join(', ')}`,
        '',
        'This PR must pass the repository CI workflow before the scheduled integration step can merge it.',
        'The original main README is not modified by this submission.'
      ].join('\n')
    });
    pr = data;
  }
  return { branch: pkg.branch, commit: commit.sha, pullRequest: pr.html_url, changedFiles: files.length };
}
