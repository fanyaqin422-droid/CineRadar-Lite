const byId = id => document.getElementById(id);
function add(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}
async function load(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error(path);
  return response.json();
}
async function init() {
  const [data, config] = await Promise.all([load('data.json'), load('config.json')]);
  const when = value => new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'});
  byId('status').textContent = data.lastSuccess ? '最近成功更新 · ' + when(data.lastSuccess) : '自动采集暂无成功记录';
  for (const source of config.sources) {
    const latest = data.runs.find(run => run.name === source.name);
    const success = data.runs.find(run => run.name === source.name && run.status === '成功');
    add(byId('feeds'), 'li', [source.name, source.mode === 'manual' ? '手动导入' : source.enabled ? latest?.status || '待检测' : '已暂停', source.url, latest ? '最近检查 '+when(latest.time) : '尚未检查', success ? '最近成功 '+when(success.time) : '暂无成功记录', latest?.detail || ''].join(' · '));
  }
  for (const run of data.runs) add(byId('runs'), 'li', [when(run.time),run.name,run.status,run.detail].join(' · '));
  for (const company of config.companies) add(byId('watch'), 'li', company);
  if (!config.companies.length) add(byId('watch'), 'li', '暂无重点公司');
  const names = new Set([...config.companies,...data.items.map(item => item.company).filter(Boolean)]);
  for (const name of names) add(byId('company'),'option',name).value = name;
  const regionOf = item => item.region || (item.source.includes('国家电影局') ? '华语' : '海外');
  const topics = {
    '今日华语影视动态': item => regionOf(item) === '华语' && new Date(item.published).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}) === new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}),
    '最新电影备案与开发': item => regionOf(item) === '华语' && /备案|立项|开发|筹备/.test(item.title+' '+(item.stage||'')),
    '最新开机及杀青项目': item => regionOf(item) === '华语' && /开机|杀青/.test(item.title),
    '重点影视公司动态': item => regionOf(item) === '华语' && /壹同|坏猴子|亭东|光线|博纳|儒意|华策/.test(item.title),
    '剧集项目': item => regionOf(item) === '华语' && item.kind === '剧集',
    'AI影视资讯': item => regionOf(item) === '华语' && item.kind === 'AI影视',
    '潜力IP及真实故事': item => regionOf(item) === '华语' && /改编|文学|小说|真实故事/.test(item.title),
    '海外精选（中文）': item => regionOf(item) === '海外' && !!item.titleZh
  };
  function render() {
    const term = byId('query').value.trim().toLowerCase();
    const kind = byId('kind').value;
    const region = byId('region').value;
    const topic = byId('topic').value;
    let items = data.items.filter(item => (region === '精选' || region === '全部' || regionOf(item) === region) && (!topics[topic] || topics[topic](item)) && (kind === '全部' || kind === item.kind) && (!byId('company').value || item.company === byId('company').value) &&
      [item.title,item.company,item.source].join(' ').toLowerCase().includes(term));
    items.sort((a,b) => (Date.parse(b.published)||0) - (Date.parse(a.published)||0));
    if (region === '精选') {
      const domestic = items.filter(item => regionOf(item) === '华语');
      const overseas = items.filter(item => regionOf(item) === '海外');
      items = domestic.length ? [...domestic,...overseas.slice(0,Math.floor(domestic.length/4))] : overseas.slice(0,5);
    }
    byId('items').replaceChildren();
    byId('count').textContent = items.length ? `共 ${items.length} 条` : '暂无匹配情报';
    for (const item of items) {
      const card = add(byId('items'),'article','');
      add(card,'small',[item.kind,item.source,item.published].filter(Boolean).join(' · '));
      add(card,'h3',item.titleZh || item.title);
      if (regionOf(item) === '海外' && !item.titleZh) add(card,'small','待翻译 · 英文原文');
      if (item.titleZh) {
        const original = add(card,'details','');
        add(original,'summary','查看英文原文');
        add(original,'p',item.originalTitle || item.title);
      }
      add(card,'p',[item.stage,item.company].filter(Boolean).join(' · ') || '行业资讯');
      if (item.summaryZh || item.summary) add(card,'p',item.summaryZh || item.summary);
      if (item.url.startsWith('https://')) add(card,'a','查看原始来源').href = item.url;
    }
  }
  byId('region').addEventListener('change',render);
  byId('topic').addEventListener('change',render);
  byId('query').addEventListener('input',render);
  byId('company').addEventListener('change',render);
  byId('kind').addEventListener('change',render);
  document.querySelector('form').addEventListener('submit',event => event.preventDefault());
  render();
}
init().catch(() => { byId('status').textContent = '读取情报失败，请稍后刷新。'; });
