const byId = id => document.getElementById(id);

async function refresh() {
  const state = await window.inventrackLauncher.state();
  byId('backup').hidden = !state.configured;
  byId('databasePath').textContent = `Local data location: ${state.databaseFile}`;
  byId('status').textContent = state.workspaceMode === 'online' ? 'Online workspace is open. Use the same account as the website.' : state.running ? `Local workspace running at ${state.url}` : 'Ready to start.';
}

async function open(mode) {
  byId('online').disabled = byId('desktop').disabled = byId('browser').disabled = true;
  byId('status').textContent = mode === 'online' ? 'Connecting online… The free host may take about a minute to wake.' : 'Starting local workspace…';
  try {
    const state = await window.inventrackLauncher.open({ mode });
    byId('backup').hidden = !state.configured;
    byId('status').textContent = mode === 'online' ? 'Online workspace is open. Sign in with your website account to share inventory across devices.' : 'Local workspace is open. Sign in or create an account on this computer.';
  } catch (error) {
    byId('status').textContent = error.message || 'Could not start the workspace.';
  } finally {
    byId('online').disabled = byId('desktop').disabled = byId('browser').disabled = false;
  }
}

byId('online').addEventListener('click', () => open('online'));
byId('desktop').addEventListener('click', () => open('desktop'));
byId('browser').addEventListener('click', () => open('browser'));
byId('backup').addEventListener('click',async()=>{
  byId('backup').disabled=true;
  try{const file=await window.inventrackLauncher.backup();if(file)byId('status').textContent=`Backup saved: ${file}. Keep the matching .models folder with it.`;}
  catch(error){byId('status').textContent=`Backup failed: ${error.message}`;}
  finally{byId('backup').disabled=false;}
});
refresh().catch(error => { byId('status').textContent = error.message || 'Could not inspect the workspace.'; });
window.addEventListener('focus', () => refresh().catch(() => {}));
