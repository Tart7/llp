// MissAV 源（tvbox JS 契约子集）
//
// 设计目标：**一份源、多端运行**
//   - macOS 源测试器（JavaScriptCore）
//   - FongMi / TVBoxOSC（Android，QuickJS）
//   - Yingxia（Apple，QuickJS-ng）
// 因此只使用公共子集 API：init / home / category / detail / play / search + req()，
// 不依赖任何一家的私有能力。
//
// 与 macOS 原生 MissAVParser 的对应关系：
//   列表解析 ← parseVideoList（thumbnail 块 / lozad 封面 / 时长 / 标题）
//   详情     ← fetchDetail（标题 / og:image / actresses / tags / 混淆变量提取 m3u8）
//   播放     ← PlaybackResolver（无码优先，uncensored-leak 页二次提取）

// ---- 跨客户端兼容垫片（tvbox / FongMi / Yingxia 可能缺少这些宿主能力）----
if (typeof log !== 'function') { var log = function () {}; }
if (typeof sleep !== 'function') { var sleep = function () {}; }
if (typeof PC_UA === 'undefined') {
    var PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
             + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
}

var rule = {
    title: 'MissAV',
    host: 'https://missav.ai',
    url: 'https://missav.ai',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    timeout: 15
};

// 分类（与 macOS 版 MissAVCategory 一致）
var CATS = [
    ['dm817/cn/uncensored-leak', '最新无码'],
    ['dm515/cn/new', '最近更新'],
    ['dm590/cn/release', '新作上市'],
    ['dm291/cn/today-hot', '今日热门'],
    ['dm169/cn/weekly-hot', '本周热门'],
    ['dm263/cn/monthly-hot', '本月热门'],
    ['dm150/cn/fc2', '无码影片'],
    ['dm35/cn/madou', '亚洲专区']
];

function init() {
    log('MissAV 源初始化 host=' + rule.host);
}

// ---------------------------------------------------------------- 首页

function home() {
    return {
        class: CATS.map(function (c) {
            return { type_id: c[0], type_name: c[1] };
        })
    };
}

// ---------------------------------------------------------------- 分类 / 搜索

function category(tid, pg, filter, extend) {
    var url = rule.host + '/' + tid + '?page=' + (pg || 1);
    var html = req(url, { headers: hdrs(rule.host + '/') });
    var list = parseList(html);
    return { page: pg || 1, pagecount: 1, limit: 60, total: list.length, list: list };
}

function search(wd, quick, pg) {
    var url = rule.host + '/cn/search/' + encodeURIComponent(wd) + '?page=' + (pg || 1);
    var html = req(url, { headers: hdrs(rule.host + '/') });
    var list = parseList(html);
    return { page: pg || 1, pagecount: 1, limit: 60, total: list.length, list: list };
}

// ---------------------------------------------------------------- 详情

function detail(id) {
    // id 兼容两种形态：完整详情地址，或 /cn/xxx 路径
    var page = String(id).indexOf('http') === 0 ? String(id) : rule.host + (String(id).charAt(0) === '/' ? id : '/' + id);
    var html = req(page, { headers: hdrs(page) });

    var title = pickTitle(html);
    var cover = pickMeta(html, 'og:image');
    var actors = pickLinks(html, '/actresses/', ['ranking', 'ranking-']);
    var tags = pickLinks(html, '/tags/');
    var m3u8 = pickM3U8(html);
    var unc = pickHref(html, 'uncensored-leak');

    var from = [];
    var play = [];

    // 无码优先（对应 PlaybackResolver）：详情页带无码版链接时，先解析无码页的流
    if (unc) {
        var uncHtml = req(unc, { headers: hdrs(unc) });
        var uncM3u8 = pickM3U8(uncHtml);
        if (uncM3u8) {
            from.push('MissAV·无码');
            play.push('正片$' + uncM3u8 + '|' + unc);
        } else {
            log('无码页未提取到流，回退有码: ' + unc);
        }
    }
    if (m3u8) {
        from.push('MissAV');
        play.push('正片$' + m3u8 + '|' + page);
    }

    return {
        vod_id: page,
        vod_name: title || page.split('/').pop(),
        vod_pic: cover,
        vod_actor: actors.join('/'),
        vod_director: '',
        vod_content: '',
        vod_remarks: '',
        vod_year: '',
        type_name: '',
        // tvbox 约定：播放源用 $$$ 分隔，剧集用 ### 分隔，每集 "名称$地址"
        vod_play_from: from.join('$$$'),
        vod_play_url: play.join('###'),
        // 附加调试字段（不属于 tvbox 契约，仅供测试器显示）
        _m3u8: m3u8 || '',
        _uncensored: unc || '',
        _page: page
    };
}

// ---------------------------------------------------------------- 播放

function play(flag, id, flags) {
    // id 兼容两种形态：
    //   "<m3u8地址>|<Referer>"                    （播放器只传地址部分）
    //   "正片$<m3u8地址>|<Referer>"                （整串剧集，容错处理）
    var raw = String(id);
    var eq = raw.indexOf('$');
    if (eq >= 0) raw = raw.substring(eq + 1);
    var parts = raw.split('|');
    var url = parts[0];
    var referer = parts[1] || rule.host + '/';
    return {
        url: url,
        header: hdrs(referer),
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

function abs(path) {
    if (!path) return '';
    if (path.indexOf('http') === 0) return path;
    return rule.host + (path.charAt(0) === '/' ? path : '/' + path);
}

function pick(block, re) {
    var m = re.exec(block);
    return m ? (m[1] || m[0]) : '';
}

function dec(s) {
    if (!s) return '';
    return String(s)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '');
}

/// 列表页解析（对应 MissAVParser.parseVideoList）
function parseList(html) {
    var out = [];
    var seen = {};
    var re = /<div[^>]+class="[^"]*thumbnail[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*thumbnail[^"]*"|$)/g;
    var m;
    var count = 0;
    while ((m = re.exec(html)) !== null && count < 60) {
        count++;
        var block = m[1];
        var href = pick(block, /<a[^>]+href="([^"]+)"/);
        if (!href) continue;
        var detailURL = abs(href);
        var id = detailURL.split('/').pop();
        if (!id || seen[id]) continue;
        seen[id] = 1;

        var cover = pick(block, /<img[^>]+class="[^"]*lozad[^"]*"[^>]+data-src="([^"]+)"/);
        var preview = pick(block, /<video[^>]+class="[^"]*preview[^"]*"[^>]+data-src="([^"]+)"/);
        var dur = pick(block, /<span[^>]*class="[^"]*absolute[^"]*bottom-1[^"]*right-1[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        var title = pick(block, /<div[^>]+class="[^"]*my-2[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/);

        out.push({
            vod_id: detailURL,
            vod_name: dec(title).replace(/^\s+|\s+$/g, '') || id.toUpperCase(),
            vod_pic: cover ? abs(cover) : '',
            vod_remarks: (dur || '').replace(/^\s+|\s+$/g, ''),
            vod_tag: (block.indexOf('无码影片') >= 0 || detailURL.indexOf('uncensored-leak') >= 0) ? '无码' : ''
        });
    }
    return out;
}

function pickTitle(html) {
    var m = /<title>([\s\S]*?)<\/title>/.exec(html);
    return m ? dec(m[1]).replace(/^\s+|\s+$/g, '') : '';
}

function pickMeta(html, property) {
    var re = new RegExp('<meta[^>]+(?:property|name)="' + property + '"[^>]+content="([^"]+)"');
    var m = re.exec(html);
    if (!m) {
        re = new RegExp('<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="' + property + '"');
        m = re.exec(html);
    }
    return m ? m[1] : '';
}

/// 提取页面中含指定路径的链接文本（演员 / 标签）
function pickLinks(html, pathContains, exclude) {
    var escaped = pathContains.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('<a[^>]+href="([^"]*' + escaped + '[^"]*)"[^>]*>([\\s\\S]*?)<\\/a>', 'g');
    var out = [];
    var seen = {};
    var m;
    while ((m = re.exec(html)) !== null) {
        var href = m[1];
        if (exclude) {
            var skip = false;
            for (var i = 0; i < exclude.length; i++) {
                if (href.indexOf(exclude[i]) >= 0) { skip = true; break; }
            }
            if (skip) continue;
        }
        var text = dec(m[2]).replace(/^\s+|\s+$/g, '');
        if (!text || seen[text]) continue;
        seen[text] = 1;
        out.push(text);
        if (out.length >= 20) break;
    }
    return out;
}

function pickHref(html, pathContains) {
    var escaped = pathContains.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('<a[^>]+href="([^"]*' + escaped + '[^"]*)"');
    var m = re.exec(html);
    return m ? abs(m[1]) : '';
}

function isUUID(s) {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
}

/// 从详情页提取播放地址（对应 MissAVParser.extractM3U8，含混淆变量模式）
function pickM3U8(html) {
    var m;

    // 1. 混淆变量：m3u8|分段|com|surrit|https|video（分段反转后拼 UUID）
    m = /m3u8\|([a-f0-9\|]+)\|com\|surrit\|https\|video/.exec(html);
    if (m) {
        var uuid = m[1].split('|').reverse().join('-');
        if (isUUID(uuid)) return 'https://surrit.com/' + uuid + '/playlist.m3u8';
    }

    // 2. 直接的 surrit playlist 链接
    m = /https:\/\/surrit\.com\/([a-f0-9-]+)\/playlist\.m3u8/.exec(html);
    if (m && isUUID(m[1])) return 'https://surrit.com/' + m[1] + '/playlist.m3u8';

    // 3. video 标签 src
    m = /<video[^>]+src="(https:\/\/surrit\.com\/[^"]+)"/.exec(html);
    if (m) return m[1];

    // 4. 页内任意 UUID
    m = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/.exec(html);
    if (m && isUUID(m[0])) return 'https://surrit.com/' + m[0] + '/playlist.m3u8';

    // 5. 任意 m3u8 链接
    m = /https?:\/\/[^"'<>\s]+\.m3u8/.exec(html);
    if (m) return m[0];

    return '';
}


// ---- tvbox 兼容导出 ----
// 部分客户端（tvbox 系）按 api 名查找对象，而不是裸全局函数
var csp_MissAV = {
    init: init, home: home, category: category, detail: detail,
    play: play, search: search,
    homeVod: function () { return { list: [] }; }
};
