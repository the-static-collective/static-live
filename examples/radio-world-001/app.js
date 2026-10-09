/* RADIO WORLD 001 — first-party navigation only. Never fetch external media. */
let directory=null;
let selected=null;
let view='listen';
const $=id=>document.getElementById(id);
function make(tag,cls,text){
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;
  return n;
}
function validDirectory(d){
  if(!d || d.schema!=='static-live.radio-world-snapshot/v0.1'
    || !Array.isArray(d.worlds) || d.worlds.length!==2)throw Error('Unrecognized world directory');
  const expected={
    'kinship-radio':'https://kinshipradio.org/main/',
    'rock-impact':'https://rockimpactmakersglobal.org/'
  };
  const ids=new Set();
  for(const w of d.worlds){
    if(!Object.hasOwn(expected,w.id)||w.officialUrl!==expected[w.id]||ids.has(w.id)||
        w.mediaPlayback!=='NONE'||w.verifiedDirectStream!==false)
      throw Error('Unadmitted world or stream source');
    ids.add(w.id);
  }
  return d;
}
function world(){
  return directory.worlds.find(w=>w.id===selected);
}
function selectWorld(id){
  if(!directory.worlds.some(w=>w.id===id))return;
  // There is no internal audio player, even when changing selections.
  const previous=selected;selected=id;view='listen';
  $('notice').textContent='Switched '+(previous||'no world')+' → '+id+
    '. No audio playback, login, or authority transferred.';
  render();
  $('world-content').focus({preventScroll:true});
}
function linkToOwner(w,label){
  const a=make('a','primary',label);
  a.href=w.officialUrl;a.target='_blank';a.rel='noopener noreferrer';
  a.referrerPolicy='no-referrer';
  a.addEventListener('click',()=>{
    $('notice').textContent='Requested official site for '+w.owner+
      '. Whether anything played there is unknown to Radio World.';
  });
  return a;
}
function renderWorlds(){
  const wrap=$('world-list');wrap.replaceChildren();
  for(const w of directory.worlds){
    const button=make('button','world'+(w.id===selected?' selected':''));button.type='button';
    button.setAttribute('aria-pressed',String(w.id===selected));
    button.append(make('small',null,w.place.country+' / '+w.place.label),
      make('strong',null,w.owner),make('span','sub',w.description),
      make('span','enter',w.id===selected?'Selected world ↗':'Enter this world →'));
    button.addEventListener('click',()=>selectWorld(w.id));wrap.append(button);
  }
}
function renderPanel(){
  const w=world();const panel=$('tab-content');panel.replaceChildren();
  const grid=make('div','panel-grid');
  const left=make('div'),right=make('div','inset');
  if(view==='listen'){
    left.append(make('h3',null,'Listen with '+w.owner),
      make('p',null,'Open the source owner’s official website or app. Radio World does not host, proxy, record, or start their audio.'));
    const buttons=make('div','actions');buttons.append(linkToOwner(w,'Open official listening site ↗'));
    left.append(buttons);
    right.append(make('strong',null,'Stream connection · not yet admitted'),
      make('p',null,'We have not verified a licensed direct stream URL or a playable podcast feed for this source. Its current live status is unknown.'));
  }else if(view==='produce'){
    left.append(make('h3',null,'Make media without losing the original'),
      make('p',null,'Static Live STREAM-001 already separates local recording from a successful broadcast. A local operator can preserve a recording, then prepare a podcast or segment for review.'));
    right.append(make('strong',null,'Owned by the producing organization'),
      make('p',null,'OBS, video keys, uploaded media, sermon permissions, editing and release decisions remain owner-local. This screen does not remotely control production.'));
  }else{
    left.append(make('h3',null,'Exchange by invitation, never by assumption'),
      make('p',null,'A candidate radio postcard, podcast clip or teaching requires exact source provenance, speaker consent, content rights and a separate human decision by the receiving organization.'));
    right.append(make('strong',null,'Crossing state: not initiated'),
      make('p',null,'No reLATTE crossing, Kinship station editorial admission, Rock Impact publication, retransmission or donation has occurred.'));
  }
  grid.append(left,right);panel.append(grid);
}
function render(){
  const w=world();
  renderWorlds();
  $('world-tag').textContent=w.place.country+' / '+w.place.label;
  $('world-heading').textContent=w.owner;
  $('world-description').textContent=w.description;
  $('world-ownership').textContent='INDEPENDENT SOURCE OWNER';
  $('world-status').textContent='Official source link · playback not connected';
  for(const button of document.querySelectorAll('[data-view]')){
    const yes=button.dataset.view===view;
    button.classList.toggle('current',yes);
    button.setAttribute('aria-selected',String(yes));
  }
  renderPanel();
}
async function start(){
  try{
    const response=await fetch('/api/worlds',{cache:'no-store'});
    if(!response.ok)throw Error('Directory unavailable');
    directory=validDirectory(await response.json());
    selected=directory.worlds[0].id;
    render();
    $('network-label').textContent='2 independent worlds · direct audio OFF';
  }catch(error){
    $('world-list').replaceChildren(make('p','world-placeholder','World directory unavailable: '+error.message));
    $('notice').textContent='HOLD: source directory could not be validated. No link opened.';
  }
}
for(const b of document.querySelectorAll('[data-view]')){
  b.addEventListener('click',()=>{
    if(!directory)return;
    view=b.dataset.view;render();
  });
}
if('serviceWorker' in navigator && location.hostname==='127.0.0.1'){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
start();
