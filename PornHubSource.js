// PornHub 源（jp.pornhub.com）—— tvbox JS 契约子集
//
// 与 MissAV 源同一套契约，一份源可跑 macOS 源测试器 / FongMi / Yingxia。
//
// 实测要点（2026-10-22）：
// 1. 列表页：<li class="pcVideoListItem …"> 卡片，data-video-vkey / a[title] / <var class="duration">
// 2. 详情页：og:title / og:image / pornstarsAndModelsWrapper（alt=演员名）/ tagsWrapper（span=标签）
// 3. 播放地址：**embed 页**的 mediaDefinitions 里 ee-h.phncdn.com HLS 是可直接访问的
//    （主页面 hv-h 的地址返回 410）。且 token 不绑定画质 → 把路径里的 480P_2000K
//    换成 1080P_4000K / 720P_4000K / 240P_1000K 都能拿到对应画质。
// 4. 依赖条件：**出口 IP 必须一致**。PornHub 的媒体 token 绑定请求 IP，
//    所以 pornhub.com 与 phncdn.com 必须走同一条代理线路（Clash 已把 phncdn.com
//    加入同一规则组）。若换节点/换网络，需重新进详情页刷新 token。
//
// 筛选参数（直接写在分类 ID 里，测试器里可随手组合）：
//   c=<id>        分类（99=俄罗斯 103=韩国 111=日本人 teen=18-25岁）
//   o=mr|mv|tr|ht|lg|cm   最新/最多观看/最高分/最热门/最长/精选
//   t=a|d|w|m|y   时间：全部/每日/每周/每月/每年
//   p=homemade|professional   自制/专业（空=全部）
//   dur=<min>-<max>   时长分钟区间，如 dur=10-20

// ---- 跨客户端兼容垫片（tvbox / FongMi / Yingxia 可能缺少这些宿主能力）----
if (typeof log !== 'function') { var log = function () {}; }
if (typeof sleep !== 'function') { var sleep = function () {}; }
if (typeof PC_UA === 'undefined') {
    var PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
             + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
}

var rule = {
    title: 'PornHub',
    host: 'https://jp.pornhub.com',
    url: 'https://jp.pornhub.com',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    timeout: 20
};

// 画质替换表：embed 页只给 480P，同 token 可按需换
var QUALS = [
    ['1080P', '1080P_4000K'],
    ['720P', '720P_4000K'],
    ['480P', '480P_2000K'],
    ['240P', '240P_1000K']
];

function init() {
    log('PornHub 源初始化 host=' + rule.host);
}

// ---------------------------------------------------------------- 首页

function home() {
    return {
        class: [
            { type_id: 'video?c=99', type_name: '俄罗斯' },
            { type_id: 'video?c=103', type_name: '韩国' },
            { type_id: 'categories/teen', type_name: '18-25岁' },
            { type_id: 'video?c=111', type_name: '日本人' },
            { type_id: 'video', type_name: '最新' },
            { type_id: 'video?o=mv', type_name: '最多观看' },
            { type_id: 'video?o=tr', type_name: '最高分' },
            { type_id: 'video?o=ht', type_name: '最热门' },
            { type_id: 'video?p=homemade', type_name: '自制' },
            { type_id: 'video?p=professional', type_name: '专业' },
            // 筛选组合示例（分类 ID 里直接带参数）
            { type_id: 'video?c=111&p=homemade', type_name: '日本人·自制' },
            { type_id: 'video?c=111&o=mv&t=w', type_name: '日本人·本周最多观看' },
            { type_id: 'video?c=103&o=mv&t=w', type_name: '韩国·本周最多观看' },
            { type_id: 'video?c=99&o=mv&t=w', type_name: '俄罗斯·本周最多观看' },
            // 时长（服务端 dur= 已被废弃，改为按列表时长客户端过滤）
            { type_id: 'video?c=111&dur=10-20', type_name: '日本人·10-20分钟' },
            { type_id: 'video?c=111&dur=20-40', type_name: '日本人·20-40分钟' },
            { type_id: 'video?c=99&dur=10-20', type_name: '俄罗斯·10-20分钟' },
            // 频道 / 演员（点进去是该频道/演员的视频列表）
            { type_id: 'channels', type_name: '热门频道' },
            { type_id: 'pornstars', type_name: '热门演员' }
        ]
    };
}

// ---------------------------------------------------------------- 分类 / 搜索

function category(tid, pg, filter, extend) {
    var q = String(tid);
    var dur = durRange(q);
    // dur 服务端已废弃（会 301 剥掉参数）→ 从请求 URL 去掉，改客户端过滤
    var clean = q.replace(/(?:^|&)dur=[^&]*/g, '').replace(/[?&]$/, '');

    // 频道索引：列出频道（点进去是视频列表）
    if (clean === 'channels' || clean.indexOf('channels?') === 0) {
        var ch = req(rule.host + '/channels', { headers: hdrs(rule.host + '/') });
        return { page: 1, pagecount: 1, limit: 60, total: 0, list: parseChannelList(ch) };
    }
    // 演员索引
    if (clean === 'pornstars' || clean.indexOf('pornstars?') === 0) {
        var ps = req(rule.host + '/pornstars?o=t', { headers: hdrs(rule.host + '/') });
        return { page: 1, pagecount: 1, limit: 60, total: 0, list: parsePornstarList(ps) };
    }

    var sep = clean.indexOf('?') >= 0 ? '&' : '?';
    var url = rule.host + '/' + clean + sep + 'page=' + (pg || 1);
    var html = req(url, { headers: hdrs(rule.host + '/') });
    var list = parseList(html);

    if (dur) {
        list = list.filter(function (v) {
            var s = secondsOf(v.vod_remarks || '');
            return s >= dur.min * 60 && s <= dur.max * 60;
        });
    }
    return { page: pg || 1, pagecount: 1, limit: 60, total: list.length, list: list };
}

function search(wd, quick, pg) {
    // 注意：用 search= 而不是 q=（q= 会返回 404 状态码，虽然页面有内容）
    var url = rule.host + '/video/search?search=' + encodeURIComponent(wd) + '&page=' + (pg || 1);
    var html = req(url, { headers: hdrs(rule.host + '/') });
    var list = parseList(html);
    return { page: pg || 1, pagecount: 1, limit: 60, total: list.length, list: list };
}

// ---------------------------------------------------------------- 详情

function detail(id) {
    var vkey = String(id).replace(/^.*viewkey=/, '');
    var page = rule.host + '/view_video.php?viewkey=' + vkey;
    var html = req(page, { headers: hdrs(rule.host + '/') });

    var title = pickMeta(html, 'og:title');
    // 偶发拿到挑战页/空响应（PornHub 对非浏览器指纹有间歇性拦截）→ 绕缓存重试一次
    if (!title) {
        sleep(600);
        html = req(page, { headers: hdrs(rule.host + '/'), noCache: true });
    }

    title = pickMeta(html, 'og:title') || vkey;
    var pic = pickMeta(html, 'og:image');
    var stars = pickPornstars(html);
    var tags = pickTags(html);

    // 播放地址走 embed 页（token 有效且可按画质替换）
    var embedURL = rule.host + '/embed/' + vkey;
    var ehtml = req(embedURL, { headers: hdrs(page) });
    var base = pickHLS(ehtml);
    if (!base) {
        sleep(600);
        ehtml = req(embedURL, { headers: hdrs(page), noCache: true });
        base = pickHLS(ehtml);
    }

    var lines = [];
    if (base) {
        var m = /(\d{3,4}P_\d+K)/.exec(base);
        if (m) {
            for (var i = 0; i < QUALS.length; i++) {
                lines.push(QUALS[i][0] + '$' + base.replace(m[1], QUALS[i][1]) + '|' + embedURL);
            }
        } else {
            lines.push('默认$' + base + '|' + embedURL);
        }
    }

    return {
        vod_id: vkey,
        vod_name: title,
        vod_pic: pic,
        vod_actor: stars.join('/'),
        vod_director: '',
        vod_content: tags.join(' '),
        vod_remarks: '',
        vod_year: '',
        type_name: '',
        vod_play_from: lines.length ? 'PornHub' : '',
        vod_play_url: lines.join('###'),
        _hls: base || '',
        _page: page
    };
}

// ---------------------------------------------------------------- 播放

function play(flag, id, flags) {
    // id: "<url>|<Referer>"，容错 "名称$<url>|<Referer>"
    var raw = String(id);
    var eq = raw.indexOf('$');
    if (eq >= 0) raw = raw.substring(eq + 1);
    var parts = raw.split('|');
    return {
        url: parts[0],
        header: hdrs(parts[1] || rule.host + '/'),
        parse: 0,
        subtitle: []
    };
}

// ---------------------------------------------------------------- 解析辅助

function hdrs(referer) {
    return {
        'Referer': referer || (rule.host + '/'),
        'User-Agent': PC_UA,
        'Origin': rule.host
    };
}

function pick(block, re) {
    var m = re.exec(block);
    return m ? (m[1] || m[0]) : '';
}

function dec(s) {
    if (!s) return '';
    return String(s)
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, "'").replace(/&#(\d+);/g, function (_, n) {
            return String.fromCharCode(parseInt(n, 10));
        })
        .replace(/<[^>]+>/g, '');
}

/// 列表页解析（pcVideoListItem 卡片）
function parseList(html) {
    var out = [];
    var seen = {};
    var re = /<li class="pcVideoListItem([\s\S]*?)(?=<li class="pcVideoListItem|$)/g;
    var m;
    while ((m = re.exec(html)) !== null && out.length < 60) {
        var block = m[1];
        var vkey = pick(block, /data-video-vkey="([^"]+)"/)
                || pick(block, /view_video\.php\?viewkey=([^"&]+)/);
        if (!vkey || seen[vkey]) continue;
        seen[vkey] = 1;

        var title = pick(block, /<a[^>]+title="([^"]+)"/);
        var img = pick(block, /<img[^>]+src="([^"]+)"/);
        var dur = pick(block, /<var class="duration">([\s\S]*?)<\/var>/);
        var added = pick(block, /class="added">([\s\S]*?)<\/span>/);

        out.push({
            vod_id: vkey,
            vod_name: dec(title).replace(/^\s+|\s+$/g, '') || vkey,
            vod_pic: img || '',
            vod_remarks: (dur || '').replace(/^\s+|\s+$/g, ''),
            vod_tag: (added || '').replace(/^\s+|\s+$/g, '')
        });
    }
    return out;
}

function pickMeta(html, property) {
    var re = new RegExp('<meta[^>]+(?:property|name)="' + property + '"[^>]+content="([^"]+)"');
    var m = re.exec(html);
    if (!m) {
        re = new RegExp('<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="' + property + '"');
        m = re.exec(html);
    }
    return m ? dec(m[1]) : '';
}

/// 演员（alt 属性即显示名）
function pickPornstars(html) {
    var i = html.indexOf('pornstarsAndModelsWrapper');
    var seg = i >= 0 ? html.substring(i, i + 20000) : html;
    var re = /<a href="\/pornstar\/[a-z0-9-]+"[^>]*alt="([^"]+)"/g;
    var out = [];
    var seen = {};
    var m;
    while ((m = re.exec(seg)) !== null) {
        var name = dec(m[1]).replace(/^\s+|\s+$/g, '');
        if (!name || seen[name]) continue;
        seen[name] = 1;
        out.push(name);
        if (out.length >= 15) break;
    }
    return out;
}

/// 标签（tagsWrapper 内的 span）
function pickTags(html) {
    var i = html.indexOf('tagsWrapper');
    if (i < 0) return [];
    var seg = html.substring(i, i + 20000);
    var end = seg.indexOf('</div>');
    if (end > 0) seg = seg.substring(0, end);
    var re = /<span>([^<]{1,40})<\/span>/g;
    var out = [];
    var seen = {};
    var m;
    while ((m = re.exec(seg)) !== null) {
        var tag = dec(m[1]).replace(/^\s+|\s+$/g, '');
        if (!tag || seen[tag]) continue;
        seen[tag] = 1;
        out.push(tag);
        if (out.length >= 20) break;
    }
    return out;
}

/// 从 embed 页提取 HLS 主地址（处理 JSON 里的转义斜杠）
function pickHLS(html) {
    var clean = html.replace(/\\\//g, '/');
    var m = /https:\/\/[a-z0-9-]+\.phncdn\.com\/hls\/[^"'\s]+master\.m3u8\?[^"'\s]+/.exec(clean);
    return m ? m[0] : '';
}

/// 时长区间：dur=min-max（任一端可省略）
function durRange(q) {
    var m = /(?:^|&)dur=(\d*)-(\d*)/.exec(q);
    if (!m) return null;
    return {
        min: m[1] === '' ? 0 : parseInt(m[1], 10),
        max: m[2] === '' ? 100000 : parseInt(m[2], 10)
    };
}

/// "13:46" / "1:02:03" → 秒
function secondsOf(dur) {
    var p = String(dur).split(':');
    if (p.length === 3) return (parseInt(p[0], 10) || 0) * 3600 + (parseInt(p[1], 10) || 0) * 60 + (parseInt(p[2], 10) || 0);
    if (p.length === 2) return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    return 0;
}

/// 频道索引 → 频道列表（vod_id = channels/<slug>，点进去走视频列表）
function parseChannelList(html) {
    var out = [];
    var seen = {};
    var re = /<a href="\/channels\/([a-z0-9-]+)"[^>]*>([^<]{1,60})<\/a>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var slug = m[1];
        var name = dec(m[2]).replace(/^\s+|\s+$/g, '');
        if (!name || seen[slug]) continue;
        seen[slug] = 1;
        out.push({ vod_id: 'channels/' + slug, vod_name: name, vod_pic: '', vod_remarks: '', vod_tag: '频道' });
        if (out.length >= 60) break;
    }
    return out;
}

/// 演员索引 → 演员列表（vod_id = pornstar/<slug>）
function parsePornstarList(html) {
    var out = [];
    var seen = {};
    var re = /<a href="\/pornstar\/([a-z0-9-]+)"([^>]*)>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var slug = m[1];
        if (seen[slug]) continue;
        seen[slug] = 1;
        var altM = /alt="([^"]+)"/.exec(m[2]);
        var name = altM ? dec(altM[1]).replace(/^\s+|\s+$/g, '')
                        : slug.split('-').map(function (w) {
                              return w.charAt(0).toUpperCase() + w.slice(1);
                          }).join(' ');
        if (!name) continue;
        out.push({ vod_id: 'pornstar/' + slug, vod_name: name, vod_pic: '', vod_remarks: '', vod_tag: '演员' });
        if (out.length >= 60) break;
    }
    return out;
}


// ---- tvbox 兼容导出 ----
// 部分客户端（tvbox 系）按 api 名查找对象，而不是裸全局函数
var csp_PornHub = {
    init: init, home: home, category: category, detail: detail,
    play: play, search: search,
    homeVod: function () { return { list: [] }; }
};
