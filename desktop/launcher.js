const byId = id => document.getElementById(id);

async function refresh() {
  const state = await window.inventrackLauncher.state();
  byId('backup').hidden = !state.configured;
  byId('databasePath').textContent = `Data location: ${state.databaseFile}`;
  byId('status').textContent = state.running ? `Workspace running at ${state.url}` : 'Ready to start.';
}

async function open(mode) {
  byId('desktop').disabled = byId('browser').disabled = true;
  byId('status').textContent = 'Starting secure workspace…';
  try {
    const state = await window.inventrackLauncher.open({ mode });
    byId('backup').hidden = !state.configured;
    byId('status').textContent = 'Your workspace is open. Sign in or create your account on the welcome page.';
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
window.addEventListener('focus', () => refresh().catch(() => {}));
