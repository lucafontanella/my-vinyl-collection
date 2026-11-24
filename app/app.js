const STORE_KEY='my-vinyl-collection-v1';
// Google Sheets API
const GOOGLE_CLIENT_ID='970655102710-i53abq7fnfk505hamht9gj4nudea8v74.apps.googleusercontent.com';
const SPREADSHEET_ID='1nlIEvMr0OHjghTlz4jeglklOWsXX2CYpoc6rJHGg1VA';
const SHEET_NAME='Vinili';
const GOOGLE_SCOPE='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
// Sessione Google
let tokenClient=null;
let accessToken='';
let tokenExpiresAt=0;
let googleDriveFolderId='';
let driveCoverCache={};
let records=loadRecords(), coverData='';
const $=id=>document.getElementById(id);
function loadRecords(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'[]')}catch{return []}}
function initGoogleAuth(){
  if(!window.google?.accounts?.oauth2){
    toast('Servizio di autenticazione Google non disponibile.');
    return;
  }
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:GOOGLE_CLIENT_ID,
    scope:GOOGLE_SCOPE,
    callback:(response)=>{
      if(response.error){
        toast('Accesso Google non riuscito.');
        return;
      }
      accessToken=response.access_token;
      tokenExpiresAt=Date.now()+(Number(response.expires_in)||3600)*1000;
      updateConnection();
      render();
      toast('Accesso Google effettuato.');
    }
  });
}
function signInWithGoogle(){
  if(!tokenClient){
    initGoogleAuth();
  }
  if(!tokenClient){
    return;
  }
  tokenClient.requestAccessToken();   
}
async function readGoogleSheet(){
  if(!accessToken || Date.now()>=tokenExpiresAt){
    throw new Error('Accesso Google scaduto. Effettua nuovamente l’accesso.');
  }
  const range=encodeURIComponent(`${SHEET_NAME}!A1:K`);
  const response=await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
    {
      method:'GET',
      headers:{
        Authorization:`Bearer ${accessToken}`
      }
    }
  );
  if(!response.ok){
    const error=await response.json();
    throw new Error(error.error?.message||'Errore durante la lettura di Google Sheets.');
  }
  const data=await response.json();
  return data.values||[];
}
async function getGoogleRecords(){
  const rows=await readGoogleSheet();
  return googleRowsToRecords(rows);
}
async function checkSyncStatus(){
  const googleRecords=await getGoogleRecords();
  return {
    localCount:records.length,
    googleCount:googleRecords.length,
    googleRecords
  };
}
async function syncWithGoogle(){
  try{
    const status=await checkSyncStatus();
    if(status.localCount===0 && status.googleCount===0){
      toast('Entrambi gli archivi sono vuoti.');
      return;
    }
    if(status.localCount===0 && status.googleCount>0){
      if(!confirm(
        `Google Sheets contiene ${status.googleCount} dischi. Vuoi importarli nell'app?`
      )) return;
      records=status.googleRecords;
      saveRecords();
      toast('Catalogo importato da Google Sheets.');
      return;
    }
    if(status.localCount>0 && status.googleCount===0){
      if(!confirm(
        `L'app contiene ${status.localCount} dischi, mentre Google Sheets è vuoto. Vuoi caricare il catalogo su Google Sheets?`
      )) return;
      const preparedRecords=await prepareRecordsForGoogle(records);
      await writeGoogleSheet(preparedRecords);
      records=preparedRecords;
      saveRecords();      
      toast('Catalogo caricato su Google Sheets.');
      return;
    }
    toast('Entrambi gli archivi contengono dati. Verifichiamo le differenze prima di sincronizzare.');
  }catch(error){
    console.error('Errore sincronizzazione:',error);
    toast(error.message||'Errore durante la sincronizzazione.');
  }
}
function googleRowsToRecords(rows){
  if(!rows.length) return [];
  return rows.slice(1)
    .filter(row=>row[0]||row[1]||row[3])
    .map(row=>({
      id:row[0]||'',
      artist:row[1]||'',
      year:row[2]||'',
      album:row[3]||'',
      genre:row[4]||'',
      label:row[5]||'',
      info:row[6]||'',
      cover:row[7]||'',
      createdAt:row[8]||'',
      updatedAt:row[9]||'',
      deletedAt:row[10]||''
    }));
}
function recordsToGoogleRows(list){
  if(list.some(r=>r.cover?.startsWith('data:'))){
    throw new Error('Una o più copertine non sono ancora state trasferite su Google Drive.'
    );
  }
  return list.map(r=>[
    r.id||'',
    r.artist||'',
    r.year||'',
    r.album||'',
    r.genre||'',
    r.label||'',
    r.info||'',
    r.cover||'',
    r.createdAt||'',
    r.updatedAt||'',
    r.deletedAt||''
  ]);
}
async function writeGoogleSheet(list){
  if(!Array.isArray(list) || list.length===0){
    throw new Error('Il catalogo è vuoto. Nessun dato è stato scritto.');
  }
  if(!accessToken || Date.now()>=tokenExpiresAt){
    throw new Error('Accesso Google scaduto. Effettua nuovamente l’accesso.');
  }
  const data=recordsToGoogleRows(list);
  const rows=data.map(row=>({
    values:row.map(value=>({
      userEnteredValue:{
        stringValue:String(value??'')
      }
    }))
  }));
  const response=await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method:'POST',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        requests:[
          {
            updateCells:{
              range:{
                sheetId:0,
                startRowIndex:1,
                startColumnIndex:0,
                endColumnIndex:11
              },
              rows,
              fields:'userEnteredValue'
            }
          },
          {
            repeatCell:{
              range:{
                sheetId:0,
                startRowIndex:data.length+1,
                startColumnIndex:0,
                endColumnIndex:11
              },
              cell:{},
              fields:'userEnteredValue'
            }
          }
        ]
      })
    }
  );
  const result=await response.json();
  if(!response.ok){
    throw new Error(
      result.error?.message||'Errore durante la scrittura su Google Sheets.'
    );
  }
  return result;
}
async function googleDriveRequest(url,options={}){
  if(!accessToken || Date.now()>=tokenExpiresAt){
    throw new Error('Accesso Google scaduto. Effettua nuovamente l’accesso.');
  }
  const response=await fetch(url,{
    ...options,
    headers:{
      ...options.headers,
      Authorization:`Bearer ${accessToken}`
    }
  });
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    throw new Error(
      error.error?.message||'Errore durante la comunicazione con Google Drive.'
    );
  }
  if(response.status===204) return null;
  return response.json();
}
async function getGoogleDriveFolder(){
  if(googleDriveFolderId) return googleDriveFolderId;
  const query=encodeURIComponent(
    "name='My Vinyl Collection Covers' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const result=await googleDriveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=100`
  );
  if(result.files?.length){
    googleDriveFolderId=result.files[0].id;
    return googleDriveFolderId;
  }
  const folder=await googleDriveRequest(
    'https://www.googleapis.com/drive/v3/files',
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        name:'My Vinyl Collection Covers',
        mimeType:'application/vnd.google-apps.folder'
      })
    }
  );
  googleDriveFolderId=folder.id;
  return googleDriveFolderId;
}
async function uploadCoverToDrive(dataUrl,albumName){
  const folderId=await getGoogleDriveFolder();
  const imageBlob=await fetch(dataUrl).then(response=>response.blob());
  const extension=imageBlob.type==='image/png'?'png':'jpg';
  const metadata={
    name:`${albumName.replace(/[\\/:*?"<>|]/g,'-')}.${extension}`,
    mimeType:imageBlob.type,
    parents:[folderId]
  };
  const formData=new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)],{
      type:'application/json'
    })
  );
  formData.append('file',imageBlob);
  const result=await googleDriveRequest(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method:'POST',
      body:formData
    }
  );
  return `drive:${result.id}`;
}
async function prepareRecordsForGoogle(list){
  const prepared=[];
  for(const record of list){
    const copy={...record};
    if(copy.cover?.startsWith('data:')){
      copy.cover=await uploadCoverToDrive(
        copy.cover,
        copy.album||'Copertina'
      );
    }
    prepared.push(copy);
  }
  return prepared;
}
async function downloadCoverFromDrive(fileId){
  if(!accessToken || Date.now()>=tokenExpiresAt){
    throw new Error('Accesso Google scaduto. Effettua nuovamente l’accesso.');
  }
  const response=await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers:{
        Authorization:`Bearer ${accessToken}`
      }
    }
  );
  if(!response.ok){
    throw new Error('Impossibile recuperare la copertina da Google Drive.');
  }
  const imageBlob=await response.blob();
  return URL.createObjectURL(imageBlob);
}
function saveRecords(){localStorage.setItem(STORE_KEY,JSON.stringify(records));render()}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300)}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function coverHTML(r){
  const src=r.cover||'';
  if(src.startsWith('drive:')){
    const fileId=src.slice(6);
    return `<span class="placeholder drive-cover" data-drive-id="${esc(fileId)}" data-album="${esc(r.album)}">♫</span>`;
  }
  return src
    ?`<img loading="lazy" src="${esc(src)}" alt="Copertina ${esc(r.album)}" onerror="this.remove()">`
    :'<span class="placeholder">♫</span>';
}
function render(){
 const q=$('searchInput').value.trim().toLowerCase();
 const activeRecords=records.filter(r=>!r.deletedAt);
 let list=activeRecords.filter(r=>[r.artist,r.album,r.genre,r.label,r.year,r.info].join(' ').toLowerCase().includes(q));  
 const sort=$('sortSelect').value;
 list.sort((a,b)=>sort==='album'?a.album.localeCompare(b.album):sort==='year-desc'?(Number(b.year)||0)-(Number(a.year)||0):sort==='year-asc'?(Number(a.year)||9999)-(Number(b.year)||9999):sort==='added'?(b.createdAt||'').localeCompare(a.createdAt||''):a.artist.localeCompare(b.artist));
 $('totalCount').textContent=activeRecords.length;
 $('artistCount').textContent=new Set(activeRecords.map(r=>r.artist.trim().toLowerCase()).filter(Boolean)).size;
 $('genreCount').textContent=new Set(activeRecords.map(r=>r.genre.trim().toLowerCase()).filter(Boolean)).size;
 $('resultCount').textContent=`${list.length} ${list.length===1?'risultato':'risultati'}`;
 $('albumGrid').innerHTML=list.map(r=>`<article class="album-card" data-id="${esc(r.id)}"><div class="album-cover">${coverHTML(r)}</div><h3>${esc(r.album)}</h3><p>${esc(r.artist)}${r.year?' · '+esc(r.year):''}</p></article>`).join('');
 $('emptyState').classList.toggle('show',activeRecords.length===0);
 $('albumGrid').style.display=list.length?'grid':'none';
 loadDriveCovers();
 if(activeRecords.length&&list.length===0)){$('emptyState').classList.add('show');$('emptyState').querySelector('h3').textContent='Nessun disco trovato';$('emptyState').querySelector('p').textContent='Prova con un altro artista o titolo.';$('emptyState').querySelector('button').classList.add('hidden')}else{$('emptyState').querySelector('h3').textContent='La tua collezione comincia qui';$('emptyState').querySelector('p').textContent='Aggiungi il primo vinile oppure importa un file CSV esportato da Excel.';$('emptyState').querySelector('button').classList.remove('hidden')}
}
async function loadDriveCovers(){
  if(!accessToken || Date.now()>=tokenExpiresAt) return;
  const placeholders=document.querySelectorAll('.drive-cover[data-drive-id]');
  for(const placeholder of placeholders){
    const fileId=placeholder.dataset.driveId;
    const album=placeholder.dataset.album||'';
    if(!fileId) continue;
    try{
      let imageUrl=driveCoverCache[fileId];

      if(!imageUrl){
        imageUrl=await downloadCoverFromDrive(fileId);
        driveCoverCache[fileId]=imageUrl;
      }
      if(placeholder.isConnected){
        const img=document.createElement('img');
        img.loading='lazy';
        img.src=imageUrl;
        img.alt=`Copertina ${album}`;
        img.onerror=()=>img.remove();
        placeholder.replaceWith(img);
      }
    }catch(error){
      console.error('Errore caricamento copertina:',error);
    }
  }
}
function openForm(r=null){
 $('albumForm').reset();coverData='';$('albumId').value=r?.id||'';$('formTitle').textContent=r?'Modifica disco':'Aggiungi un disco';$('deleteBtn').classList.toggle('hidden',!r);
 ['artist','album','year','genre','label','info'].forEach(k=>$(k).value=r?.[k]||'');
 $('coverUrl').value=r?.cover?.startsWith('data:')?'':(r?.cover||'');setCoverPreview(r?.cover||'');
 $('albumDialog').showModal();
}
function setCoverPreview(src){
  const preview=$('coverPreview');
  if(!src){
    preview.innerHTML='<span>♫</span>';
    return;
  }
  if(src.startsWith('drive:')){
    preview.innerHTML='<span>Copertina su Google Drive</span>';
    if(accessToken && Date.now()<tokenExpiresAt){
      const fileId=src.slice(6);
      downloadCoverFromDrive(fileId)
        .then(imageUrl=>{
          if($('albumId').value && preview.isConnected){
            preview.innerHTML=`<img src="${esc(imageUrl)}" alt="Anteprima copertina">`;
          }
        })
        .catch(error=>{
          console.error('Errore anteprima copertina:',error);
        });
    }
    return;
  }
  preview.innerHTML=`<img src="${esc(src)}" alt="Anteprima copertina">`;
}
$('albumGrid').addEventListener('click',e=>{const card=e.target.closest('.album-card');if(card)openForm(records.find(r=>r.id===card.dataset.id))});
['addBtn','emptyAddBtn'].forEach(id=>$(id).addEventListener('click',()=>openForm()));
$('searchInput').addEventListener('input',render);$('sortSelect').addEventListener('change',render);
$('clearSearch').addEventListener('click',()=>{$('searchInput').value='';render()});
$('coverFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(f.size>1800000){toast('Immagine troppo grande: scegli un file sotto 1,8 MB.');e.target.value='';return}const reader=new FileReader();reader.onload=()=>{coverData=reader.result;setCoverPreview(coverData);$('coverUrl').value=''};reader.readAsDataURL(f)});
$('coverUrl').addEventListener('input',()=>{coverData='';setCoverPreview($('coverUrl').value)});
$('albumForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('albumId').value||('VIN-'+Date.now().toString(36).toUpperCase());
  const old=records.find(r=>r.id===id);
  let cover=coverData||$('coverUrl').value.trim()||old?.cover||'';
  const rec={
    id,
    artist:$('artist').value.trim(),
    album:$('album').value.trim(),
    year:$('year').value,
    genre:$('genre').value.trim(),
    label:$('label').value.trim(),
    info:$('info').value.trim(),
    cover,
    createdAt:old?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  try{
    if(cover.startsWith('data:') && accessToken && Date.now()<tokenExpiresAt){
      toast('Caricamento copertina su Google Drive...');
      cover=await uploadCoverToDrive(cover,rec.album);
      rec.cover=cover;
    }
    if(old){
      records=records.map(x=>x.id===id?rec:x);
    }else{
      records.push(rec);
    }
    saveRecords();
    $('albumDialog').close();
    toast(old?'Disco aggiornato':'Disco aggiunto');
  }catch(error){
    console.error('Errore salvataggio disco:',error);
    toast(error.message||'Impossibile salvare il disco.');
  }
});
$('deleteBtn').addEventListener('click',()=>{
  const id=$('albumId').value;
  if(!id||!confirm('Eliminare questo disco dal catalogo?')) return;
  records=records.map(r=>
    r.id===id
      ? {...r,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      : r
  );
  saveRecords();
  $('albumDialog').close();
  toast('Disco eliminato');
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('settingsBtn').addEventListener('click',()=>{
  updateConnection();
  $('settingsDialog').showModal();
});
function updateConnection(){
  const connected=!!accessToken && Date.now()<tokenExpiresAt;
  $('connectionText').textContent=connected
    ?'Google collegato · pronto per la sincronizzazione'
    :'Archivio locale · Google Sheets non collegato';
  $('connectionDot').classList.toggle('online',connected);
  const status=$('googleAccountStatus');
  if(status){
    status.textContent=connected
      ?'Accesso Google effettuato. Puoi procedere con la sincronizzazione.'
      :'Non sei ancora collegato a Google.';
  }
  const syncButton=$('syncNowBtn');
  if(syncButton){
    syncButton.disabled=!connected;
  }
}function exportCSV(){const cols=['ID','Artista','Anno','Album','Genere','Etichetta','Info','Copertina','Data aggiunta'];const keys=['id','artist','year','album','genre','label','info','cover','createdAt'];const csv=[cols,...records.map(r=>keys.map(k=>r[k]||''))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-vinyl-collection.csv';a.click();URL.revokeObjectURL(a.href);toast('Catalogo esportato in CSV, apribile con Excel')}
$('exportBtn').addEventListener('click',exportCSV);
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('googleSignInBtn').addEventListener('click',signInWithGoogle);
$('syncNowBtn').addEventListener('click',syncWithGoogle);
$('importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const text=await f.text();const rows=parseCSV(text);if(rows.length<2){toast('File vuoto o non riconosciuto');return}const headers=rows[0].map(x=>x.trim().toLowerCase());const map={artist:['artista','artist'],year:['anno','year'],album:['album'],genre:['genere','genre'],label:['etichetta','label'],info:['info','note'],cover:['copertina','cover'],id:['id']};let added=0;for(const row of rows.slice(1)){const obj={};for(const [k,aliases] of Object.entries(map)){const idx=headers.findIndex(h=>aliases.includes(h));obj[k]=idx>=0?(row[idx]||''):''}if(!obj.artist&&!obj.album)continue;obj.id=obj.id||('VIN-'+Date.now().toString(36).toUpperCase()+'-'+added);obj.createdAt=new Date().toISOString();obj.updatedAt=obj.createdAt;records.push(obj);added++}saveRecords();e.target.value='';toast(`${added} dischi importati`)});
function parseCSV(s){const out=[];let row=[],cell='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'&&q&&s[i+1]==='"'){cell+='"';i++}else if(c==='"')q=!q;else if((c===';'||c===',')&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);out.push(row);row=[];cell=''}else cell+=c}if(cell.length||row.length){row.push(cell);out.push(row)}return out}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
updateConnection();render();
