// 91porn 源（91porn.com）—— tvbox JS 契约子集
//
// 实测要点（2026-10-22）：
// 1. 站点无公开分类导航，浏览方式 = 首页（今日排行/最新）+ 关键词搜索
//    （首页右侧本身就是热门搜索词，源里直接做成分类入口）
// 2. 列表卡片：`div.well.well-sm.videos-text-align`，内含
//    a[href*="view_video.php?viewkey="] / img.img-responsive / span.duration / span.video-title
// 3. 视频页播放地址是**混淆的**：`document.write(strencode2("%3c%73%6f..."))`，
//    密文是 URL 编码的 HTML，**直接 decodeURIComponent 即可**（无需反转），
//    解出 `<source src='https://<cdn>/mp43/<id>.mp4?st=...&e=...' type='video/mp4'>`
// 4. 直链 MP4 带时效 token（e=过期时间戳），约 2 小时有效
// 5. 站点有 CF 防护，UA 必须是浏览器风格；部分视频可能需要登录 cookie
//    （若 detail 解不出地址，先在浏览器登录后把 cookie 交给源，见 setCookie）

// ---- 跨客户端兼容垫片（tvbox / FongMi / Yingxia 可能缺少这些宿主能力）----
if (typeof log !== 'function') { var log = function () {}; }
if (typeof sleep !== 'function') { var sleep = function () {}; }
if (typeof PC_UA === 'undefined') {
    var PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
             + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
}

var rule = {
    title: '91porn',
    host: 'https://91porn.com',
    url: 'https://91porn.com',
    searchable: 1,
    quickSearch: 1,
    filterable: 0,
    timeout: 20
};

// 首页热门搜索词（站点自己推荐的）
var HOT = ['人妻', '偷情', '内射', '出轨', '丝袜', '健身', '调教', '东北', '3p', 'spa'];

function init() {
    log('91porn 源初始化 host=' + rule.host);
}

// ---------------------------------------------------------------- 首页

function home() {
    var classes = [
        { type_id: 'index.php', type_name: '首页·今日排行' },
        { type_id: 'index.php?min_duration=10', type_name: '10分钟以上' },
        { type_id: 'index.php?min_duration=20', type_name: '20分钟以上' },
        { type_id: 'search:原创', type_name: '原创' },
        { type_id: 'search:中文', type_name: '中文' }
    ];
    for (var i = 0; i < HOT.length; i++) {
        classes.push({ type_id: 'search:' + HOT[i], type_name: HOT[i] });
    }
    return { class: classes };
}

// ---------------------------------------------------------------- 分类 / 搜索

function category(tid, pg, filter, extend) {
    var q = String(tid);
    var url;
    if (q.indexOf('search:') === 0) {
        var kw = q.substring(7);
        url = rule.host + '/search_result.php?search_id=' + encodeURIComponent(kw) + '&page=' + (pg || 1);
    } else {
        url = rule.host + '/' + q + (q.indexOf('?') >= 0 ? '&' : '?') + 'page=' + (pg || 1);
    }
    var html = req(url, { headers: hdrs(url) });
    var list = parseList(html);
return { page: pg || 1, pagecount: 1, limit: 24, total: list.length, list: list };
}

function search(wd, quick, pg) {
    var url = rule.host + '/search_result.php?search_id=' + encodeURIComponent(wd) + '&page=' + (pg || 1);
    var info = [];
    // 探测2：已知可达 URL（GitHub raw）
    try {
        var g = net.req('https://raw.githubusercontent.com/Tart7/llp/main/tvbox-fongmi.json', { timeout: 20000 });
        info.push('github code=' + (g && g.code) + ' clen=' + (g && g.content != null ? String(g.content).length : 'null'));
    } catch (e2) { info.push('github EX:' + (e2 && e2.message)); }
    // 探测1：91porn 原请求
    try {
        var r = net.req(url, { timeout: 20000, headers: hdrs(url) });
        if (r == null) info.push('91: r==null');
        else if (typeof r === 'string') info.push('91: r=string len=' + r.length);
        else {
            info.push('91: code=' + r.code + ' ctype=' + (typeof r.content) + ' clen=' + (r.content == null ? 'null' : String(r.content).length));
            if (r.error) info.push('91: err=' + r.error);
        }
    } catch (e1) { info.push('91: EX:' + (e1 && e1.message ? e1.message : e1)); }
    var list = info.map(function (t) { return { vod_id: 'DIAG', vod_name: t, vod_pic: '', vod_remarks: '' }; });
    return { page: pg || 1, pagecount: 1, limit: 24, total: list.length, list: list };
}

// ---------------------------------------------------------------- 详情

function detail(id) {
    var vkey = String(id).replace(/^.*viewkey=/, '');
    var page = rule.host + '/view_video.php?viewkey=' + vkey + '&page=1&viewtype=basic';
    var html = req(page, { headers: hdrs(rule.host + '/') });

    var title = pickTitle(html) || vkey;
    var pic = pickPoster(html);
    var mp4 = pickVideoURL(html);

    var lines = [];
    if (mp4) lines.push('正片$' + mp4 + '|' + page);

    return {
        vod_id: vkey,
        vod_name: title,
        vod_pic: pic,
        vod_actor: '',
        vod_director: '',
        vod_content: '',
        vod_remarks: '',
        vod_year: '',
        type_name: '',
        vod_play_from: lines.length ? '91porn' : '',
        vod_play_url: lines.join('###'),
        _mp4: mp4 || '',
        _page: page
    };
}

// ---------------------------------------------------------------- 播放

function play(flag, id, flags) {
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
        'Accept-Language': 'zh-CN,zh;q=0.9'
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
        .replace(/<[^>]+>/g, '');
}

/// 列表页解析（well 卡片；首页带 videos-text-align，搜索结果页只有 well well-sm）
function parseList(html) {
    var out = [];
    var seen = {};
    var re = /<div class="well well-sm[^"]*">([\s\S]*?)(?=<div class="well well-sm[^"]*">|$)/g;
    var m;
    while ((m = re.exec(html)) !== null && out.length < 40) {
        var block = m[1];
        var href = pick(block, /view_video\.php\?viewkey=([a-z0-9]+)/);
        if (!href || seen[href]) continue;
        seen[href] = 1;
        var img = pick(block, /<img[^>]+src="([^"]+)"/);
        var dur = pick(block, /<span class="duration">([\s\S]*?)<\/span>/);
        var title = pick(block, /<span class="video-title[^"]*">([\s\S]*?)<\/span>/);
        out.push({
            vod_id: href,
            vod_name: dec(title).replace(/^\s+|\s+$/g, '') || href,
            vod_pic: img || '',
            vod_remarks: (dur || '').replace(/^\s+|\s+$/g, ''),
            vod_tag: ''
        });
    }
    return out;
}

function pickTitle(html) {
    var m = /class="[^"]*video-title[^"]*"[^>]*>([\s\S]{1,200}?)</.exec(html);
    return m ? dec(m[1]).replace(/^\s+|\s+$/g, '') : '';
}

function pickPoster(html) {
    var m = /poster="([^"]+)"/.exec(html);
    if (m) return m[1];
    m = /<img[^>]+src="(https?:[^"]*thumb[^"]*)"/.exec(html);
    return m ? m[1] : '';
}

/// 解密 strencode2 并提取 MP4 直链
function pickVideoURL(html) {
    var m = /strencode2\("([^"]+)"\)/.exec(html);
    if (!m) return '';
    var decoded;
    try {
        decoded = decodeURIComponent(m[1]);
    } catch (e) {
        decoded = m[1];
    }
    var src = /<source[^>]+src='([^']+)'/.exec(decoded) || /<source[^>]+src="([^"]+)"/.exec(decoded);
    if (src) return src[1];
    // 兜底：解出的 HTML 里任何 mp4 链接
    var any = /(https?:\/\/[^'"\s]+\.mp4[^'"\s]*)/.exec(decoded);
    return any ? any[1] : '';
}


// ---- tvbox 兼容导出 ----
// 部分客户端（tvbox 系）按 api 名查找对象，而不是裸全局函数
var csp_Porn91 = {
    init: init, home: home, category: category, detail: detail,
    play: play, search: search,
    homeVod: function () { return { list: [] }; }
};
