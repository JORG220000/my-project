(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const car = () => window.AurelCar;
  const parts = [
    { id:'body', title:'Скульптура скорости', description:'Каждая линия кузова направляет поток воздуха. Алюминиевые панели и карбон соединяются в одну непрерывную форму.', value:'0,29', unit:'коэффициент Cx', label:'Кузов' },
    { id:'chassis', title:'Основа характера', description:'Карбоновый монокок — жёсткое и лёгкое ядро V01. Водитель находится в центре конструкции, а не просто внутри автомобиля.', value:'128', unit:'кг · масса монокока', label:'Монокок' },
    { id:'engine', title:'Восемь цилиндров. Один пульс.', description:'V8 с двумя турбинами расположен за спиной водителя. Низкий центр тяжести и мгновенная реакция на каждое движение педали.', value:'720', unit:'л.с. · V8 4.0', label:'Двигатель' },
    { id:'wheels', title:'Связь с дорогой', description:'Кованые диски снижают неподрессоренную массу. Карбон-керамические тормоза превращают скорость в точность перед каждым поворотом.', value:'20″', unit:'кованый алюминий', label:'Колёса' },
    { id:'aero', title:'Невидимая сила', description:'Сплиттер, задний диффузор и активное антикрыло управляют потоком. Больше сцепления там, где это действительно нужно.', value:'420', unit:'кг · в режиме Pista', label:'Аэродинамика' }
  ];
  const colors = {
    silver:{name:'Argento Luna',description:'Холодное серебро. Точная геометрия света.',paint:'#adb6b9',light:'#f3f5f1',dark:'#616b70'},
    orange:{name:'Arancio Fuoco',description:'Живой оранжевый. Энергия, которую видно.',paint:'#ed642f',light:'#ffba76',dark:'#9f2e17'},
    black:{name:'Nero Assoluto',description:'Глубокий чёрный. Присутствие без лишних слов.',paint:'#293439',light:'#798488',dark:'#0d1519'}
  };
  let selected=0, exploded=false, manualAt=null, manualValue=false, partManualAt=null, progress=0, color='silver', drive='strada', paused=reducedMotion.matches, toastTimer;
  const stage=document.querySelector('.stage');

  function selectPart(id, automatic=false) {
    const index=parts.findIndex(p=>p.id===id);if(index<0)return;selected=index;
    if(!automatic)partManualAt=progress;
    const part=parts[index];
    $('part-number').textContent=`0${index+1} / 05`;
    $('part-title').textContent=part.title;$('part-description').textContent=part.description;
    $('part-value').textContent=part.value;$('part-unit').textContent=part.unit;$('part-label').textContent=part.label;
    all('[data-part]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.part===id)));
    car()?.select(id);
  }
  function setExploded(value) {
    if(exploded===value)return;exploded=value;
    stage.classList.toggle('is-exploded',value);
    $('part-panel').hidden=!value;$('part-controls').hidden=!value;
    $('assembly-toggle').setAttribute('aria-expanded',String(value));
    $('assembly-label').textContent=value?'Собрать V01':'Разобрать V01';
    $('scene-hint').textContent=value?'ВЫБЕРИТЕ ДЕТАЛЬ · УЗНАЙТЕ БОЛЬШЕ':'3D · СОЗДАН ДЛЯ ДВИЖЕНИЯ';
    car()?.setExploded(value);
  }
  function manualAssembly(value) { manualAt=progress;manualValue=value;setExploded(value); }
  $('assembly-toggle').addEventListener('click',()=>manualAssembly(!exploded));
  all('[data-part]').forEach(button=>button.addEventListener('click',()=>selectPart(button.dataset.part)));
  $('prev-part').addEventListener('click',()=>selectPart(parts[(selected+parts.length-1)%parts.length].id));
  $('next-part').addEventListener('click',()=>selectPart(parts[(selected+1)%parts.length].id));
  window.addEventListener('aurel:part',event=>selectPart(event.detail));
  all('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    all('[data-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));car()?.setView(button.dataset.view);
  }));

  let scrollQueued=false;
  function updateScroll() {
    const experience=$('home');const distance=experience.offsetHeight-stage.offsetHeight;
    progress=Math.max(0,Math.min(1,(window.scrollY-experience.offsetTop)/Math.max(1,distance)));
    $('stage-progress').style.width=`${progress*100}%`;car()?.setProgress(progress);
    if(manualAt!==null&&Math.abs(progress-manualAt)>.13)manualAt=null;
    setExploded(manualAt!==null?manualValue:(!paused&&progress>.26&&progress<.84));
    if(partManualAt!==null&&Math.abs(progress-partManualAt)>.05)partManualAt=null;
    if(exploded&&manualAt===null&&partManualAt===null&&!paused) {
      const index=Math.max(0,Math.min(4,Math.floor((progress-.27)/.56*5)));
      if(index!==selected)selectPart(parts[index].id,true);
    }
    scrollQueued=false;
  }
  window.addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll);}},{passive:true});
  window.addEventListener('resize',updateScroll);
  function updateMotion() {
    document.body.classList.toggle('motion-paused',paused);car()?.setPaused(paused);
    $('motion-button').setAttribute('aria-pressed',String(paused));
    $('motion-button').setAttribute('aria-label',paused?'Включить движение модели при прокрутке':'Остановить автоматическое движение модели');
    $('motion-button').textContent=paused?'▶':'Ⅱ';
  }
  $('motion-button').addEventListener('click',()=>{paused=!paused;updateMotion();});
  reducedMotion.addEventListener('change',event=>{paused=event.matches;updateMotion();});
  selectPart('body');updateMotion();updateScroll();

  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}
  }),{threshold:.08});
  document.documentElement.classList.add('js-reveal');all('.reveal').forEach(element=>revealObserver.observe(element));

  all('[data-drive]').forEach(button=>button.addEventListener('click',()=>{
    drive=button.dataset.drive;const pista=drive==='pista';
    car()?.setDrive(drive);
    all('[data-drive]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    $('wind-tunnel').classList.toggle('is-pista',pista);$('downforce').textContent=pista?'420':'180';
    $('drive-description').textContent=pista?'PISTA — максимум сцепления в быстрых поворотах. Активное антикрыло увеличивает прижимную силу.':'STRADA — баланс устойчивости и свободы. Минимальное сопротивление на длинных прямых.';
  }));
  all('[data-color]').forEach(button=>button.addEventListener('click',()=>{
    color=button.dataset.color;const choice=colors[color];
    all('[data-color]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    $('color-name').textContent=choice.name;$('color-description').textContent=choice.description;
    document.documentElement.style.setProperty('--paint',choice.paint);
    document.documentElement.style.setProperty('--paint-light',choice.light);
    document.documentElement.style.setProperty('--paint-dark',choice.dark);
    document.querySelector('.config-car').setAttribute('aria-label',`AUREL V01 в цвете ${choice.name}`);
    car()?.setColor(color);
  }));
  function returnToCar(assembly,part) {
    // Jump into the scene, then pin the requested state until the next deliberate scroll.
    window.scrollTo({top:$('home').offsetTop,behavior:'instant'});updateScroll();manualAssembly(assembly);
    if(part)selectPart(part);
    $('assembly-toggle').focus({preventScroll:true});
  }
  $('preview-color').addEventListener('click',()=>returnToCar(false));
  $('explore-chassis').addEventListener('click',()=>returnToCar(true,'chassis'));
  const dialog=$('config-dialog');
  $('save-config').addEventListener('click',()=>{ $('summary-color').textContent=colors[color].name;dialog.showModal(); });
  $('close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>document.body.style.overflow='');
  $('save-config').addEventListener('click',()=>document.body.style.overflow='hidden');
  $('download-config').addEventListener('click',()=>{
    const content=['AUREL AUTOMOBILI','V01 / FIRST EDITION','',`Цвет: ${colors[color].name}`,'Двигатель: V8 4.0 Twin Turbo','Мощность: 720 л.с.','0–100 км/ч: 2,9 сек.','Максимальная скорость: 338 км/ч','Сухая масса: 1 280 кг','Диски: 20″ Forged / Graphite','Отделка: карбон / Alcantara',`Аэродинамический режим: ${drive.toUpperCase()}`,'','Демонстрационный дизайн-концепт. Бренд, модель и показатели вымышлены.','Эта карточка не является заказом или коммерческим предложением.'].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`AUREL-V01-${color}.txt`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    dialog.close();$('toast').textContent='Карточка V01 подготовлена к скачиванию';$('toast').hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);
  });
})();
