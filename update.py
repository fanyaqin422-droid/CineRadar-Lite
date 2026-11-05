"""Collect public RSS headlines and persist the published snapshot."""
import json
import re
from html import unescape
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def write(path, data):
    target = Path(path)
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    temp.replace(target)

def https(url):
    parts = urlsplit(url)
    return parts.scheme == 'https' and parts.hostname and not parts.username and not parts.password

def feed(source):
    if not https(source['url']):
        raise ValueError('需要 HTTPS RSS 地址')
    request = Request(source['url'], headers={'User-Agent':'CineRadarLite/1.0 (public RSS reader)'})
    with urlopen(request, timeout=20) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000 or b'<!DOCTYPE' in raw.upper():
        raise ValueError('RSS 超过大小限制或包含 DTD')
    root = ElementTree.fromstring(raw)
    result = []
    for item in root.findall('./channel/item'):
        title = (item.findtext('title') or '').strip()
        url = (item.findtext('link') or '').strip()
        if title and https(url):
            result.append(dict(title=title,url=url,published=item.findtext('pubDate') or '',
                               kind=source['kind'],source=source['name'],
                               summary=re.sub(r'<[^>]+>', '', unescape(item.findtext('description') or ''))[:120]))
    if not result:
        raise ValueError('未解析到包含 HTTPS 链接的 RSS 条目')
    return result

def update():
    data = read('site/data.json')
    items = {item['url']:item for item in data['items']}
    sources = read('sources.json')
    runs = []
    stamp = datetime.now(timezone.utc).isoformat(timespec='seconds')
    for source in sources:
        if source.get('mode') == 'manual':
            runs.append(dict(name=source['name'],status='手动导入',detail='来源未配置自动采集',time=stamp))
            continue
        if not source['enabled']:
            runs.append(dict(name=source['name'],status='已暂停',detail='',time=stamp))
            continue
        try:
            batch = feed(source)
            before = len(items)
            for item in batch:
                items[item['url']] = {**items.get(item['url'],{}),**item}
            runs.append(dict(name=source['name'],status='成功',detail=f'读取 {len(batch)} 条，新增 {len(items)-before} 条',time=stamp))
        except (ValueError,OSError,ElementTree.ParseError) as exc:
            runs.append(dict(name=source['name'],status='失败',detail=str(exc),time=stamp))
    if any(run['status']=='成功' for run in runs):
        data['lastSuccess'] = stamp
    data['items'] = list(items.values())
    data['runs'] = (runs + data['runs'])[:100]
    write('site/data.json',data)
    write('site/config.json',dict(sources=sources,companies=read('companies.json')))
    for run in runs:
        print(run)

if __name__ == '__main__':
    update()
