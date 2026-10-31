const $ = id => document.getElementById(id);
async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function packageCard(pkg) {
  const card = document.createElement('article');
  card.className = 'package';
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'ASSIGNED PACKAGE';
  const title = document.createElement('h3'); title.textContent = pkg.title;
  const desc = document.createElement('p'); desc.textContent = pkg.description;
  const branch = document.createElement('code'); branch.textContent = 'Branch: ' + pkg.branch;
  const download = document.createElement('a'); download.className = 'button'; download.href = `/api/package/${encodeURIComponent(pkg.id)}/download`; download.textContent = 'Download ZIP';
  const form = document.createElement('form'); form.className = 'submission';
  const label = document.createElement('label'); label.textContent = 'Upload completed ZIP';
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.zip,application/zip'; input.required = true;
  const button = document.createElement('button'); button.className = 'button'; button.type = 'submit'; button.textContent = 'Submit this package';
  const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role','status');
  form.append(label,input,button);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = new FormData(); body.append('package', input.files[0]);
    status.textContent = 'Validating ZIP and pushing commit…';
    try {
      const result = await request(`/api/package/${encodeURIComponent(pkg.id)}/submit`, {method:'POST',body});
      status.textContent = `Pushed ${result.changedFiles} files to ${result.branch}. `;
      const link = document.createElement('a'); link.href = result.pullRequest; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='Open pull request';
      status.append(link);
    } catch (err) { status.textContent = err.message; }
  });
  card.append(eyebrow,title,desc,branch,download,form,status);
  return card;
}
async function init() {
  try {
    const me = await request('/api/me');
    if (!me.authenticated) { $('signed-out').classList.remove('hidden'); return; }
    $('workspace').classList.remove('hidden');
    $('avatar').src = me.avatar || ''; $('username').textContent = '@' + me.login;
    me.packages.forEach(pkg => $('packages').append(packageCard(pkg)));
  } catch (e) { $('signed-out').classList.remove('hidden'); }
}
$('logout')?.addEventListener('click', async () => { await fetch('/auth/logout',{method:'POST'}); location.reload(); });
init();
