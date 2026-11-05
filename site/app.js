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
  function render() {
    const term = byId('query').value.trim().toLowerCase();
    const kind = byId('kind').value;
    const items = data.items.filter(item => (kind === '全部' || kind === item.kind) && (!byId('company').value || item.company === byId('company').value) &&
      [item.title,item.company,item.source].join(' ').toLowerCase().includes(term));
    items.sort((a,b) => (Date.parse(b.published)||0) - (Date.parse(a.published)||0));
    byId('items').replaceChildren();
    byId('count').textContent = items.length ? `共 ${items.length} 条` : '暂无匹配情报';
    for (const item of items) {
      const card = add(byId('items'),'article','');
      add(card,'small',[item.kind,item.source,item.published].filter(Boolean).join(' · '));
      add(card,'h3',item.title);
      add(card,'p',[item.stage,item.company].filter(Boolean).join(' · ') || '行业资讯');
      if (item.summary) add(card,'p',item.summary);
      if (item.url.startsWith('https://')) add(card,'a','查看原始来源').href = item.url;
    }
  }
  byId('query').addEventListener('input',render);
  byId('company').addEventListener('change',render);
  byId('kind').addEventListener('change',render);
  document.querySelector('form').addEventListener('submit',event => event.preventDefault());
  render();
}
init().catch(() => { byId('status').textContent = '读取情报失败，请稍后刷新。'; });
