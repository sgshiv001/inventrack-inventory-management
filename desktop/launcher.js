const byId = id => document.getElementById(id);
let configured = false;

async function refresh() {
  const state = await window.inventrackLauncher.state();
  configured = state.configured;
  byId('setupForm').hidden = configured;
  byId('backup').hidden = !configured;
  byId('databasePath').textContent = `Data location: ${state.databaseFile}`;
  byId('status').textContent = state.running ? `Workspace running at ${state.url}` : 'Ready to start.';
}

async function open(mode) {
  const setup = configured ? undefined : {
    organization: byId('organization').value.trim(),
    email: byId('email').value.trim(),
    password: byId('password').value,
  };
  if (!configured && !byId('setupForm').reportValidity()) return;
  byId('desktop').disabled = byId('browser').disabled = true;
  byId('status').textContent = 'Starting secure workspace…';
  try {
    const state = await window.inventrackLauncher.open({ mode, setup });
    byId('password').value = '';
    configured = state.configured;
    byId('setupForm').hidden = true;
    byId('backup').hidden = false;
    byId('status').textContent = `Workspace running at ${state.url}. Sign in with your administrator account.`;
  } catch (error) {
    byId('status').textContent = error.message || 'Could not start the workspace.';
  } finally {
    byId('desktop').disabled = byId('browser').disabled = false;
  }
}

byId('desktop').addEventListener('click', () => open('desktop'));
byId('browser').addEventListener('click', () => open('browser'));
byId('backup').addEventListener('click',async()=>{
  byId('backup').disabled=true;
  try{const file=await window.inventrackLauncher.backup();if(file)byId('status').textContent=`Backup saved: ${file}. Keep the matching .models folder with it.`;}
  catch(error){byId('status').textContent=`Backup failed: ${error.message}`;}
  finally{byId('backup').disabled=false;}
});
refresh().catch(error => { byId('status').textContent = error.message || 'Could not inspect the workspace.'; });
