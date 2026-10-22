# LLAVP VOD 源（自用）

tvbox / FongMi / Yingxia 通用的 JavaScript 源，一份源可跑多端。
同源同代码也内置在 macOS 客户端 LLAVP 的「源测试器」里。

## 源清单

| key | 站点 | 文件 | 说明 |
|---|---|---|---|
| `missav` | missav.ai | `sources/MissAVSource.js` | 无码优先（详情页带 `-uncensored-leak` 时自动切无码流），支持分类/搜索/多线路 |
| `pornhub` | jp.pornhub.com | `sources/PornHubSource.js` | 俄罗斯/韩国/18-25岁/日本人 + 排序/时间段/出品筛选 + 频道/演员索引 + 4 档画质（1080/720/480/240） |
| `porn91` | 91porn.com | `sources/Porn91Source.js` | 首页排行 + 热门搜索词 + `min_duration` 时长筛选；播放地址走 `strencode2` 解密 |

订阅地址（客户端里填这个）：

```
https://raw.githubusercontent.com/OWNER/REPO/main/tvbox.json
```

## 源契约（最小公共子集）

```js
init()                                        // 初始化（可选）
home()                                        // → { class: [{ type_id, type_name }] }
category(tid, pg, filter, extend)             // → { page, pagecount, limit, total, list: [...] }
search(wd, quick, pg)                         // → { list: [...] }
detail(id)                                    // → { vod_id, vod_name, vod_pic, vod_actor,
                                              //      vod_play_from, vod_play_url }
play(flag, id, flags)                         // → { url, header, parse }
```

列表项字段：`vod_id` / `vod_name` / `vod_pic` / `vod_remarks`。

宿主能力（源里直接用）：`req(url, {headers, method, body, noCache})`、`log(...)`、
`sleep(ms)`、`PC_UA` / `MOBILE_UA`。文件头部有兼容垫片，缺哪个都能跑。

## 两种格式

| 目录 / 文件 | 适用客户端 | 说明 |
|---|---|---|
| `sources/*.js` + `tvbox.json` | macOS 客户端（自有引擎）、支持裸函数的运行时 | 全局函数 `home/category/detail/play/search` + `req` |
| **`fongmi/*.js` + `tvbox-fongmi.json`** | **FongMi / 影视TV（QuickJS）** | ES module：`export default {...}`，网络用 `net.req` |
| `make_fongmi.py` | — | 由 `sources/` 自动生成 `fongmi/` 版本，别手改生成物 |

FongMi 的配置里 `api` 直接指向 **js 的 raw 地址**（`type: 3` + `ext: {}`），
不是 `csp_XXX` 类名——这点和其它 tvbox 分支不同。

## 使用前必读的限制

**PornHub：媒体 token 绑定 IP**
`phncdn.com` 的播放地址签名里带请求 IP。如果 `pornhub.com` 和 `phncdn.com`
走了不同代理线路（按键名分流很常见），会返回 `474 Unauthorized`。
必须让两者同组，例如 Clash：

```yaml
- DOMAIN-SUFFIX,pornhub.com,🔞 成人网站
- DOMAIN-SUFFIX,phncdn.com,🔞 成人网站
```

另外 token 约 **2 小时**后过期；换节点/换网络后需要重新进一次详情页刷新地址。

**MissAV：Cloudflare**
站点有 CF 防护，客户端需要能拿到 `cf_clearance` cookie（FongMi/Yingxia 走内置
WebView 过盾即可）。cookie 缺失时列表会是空。

**91porn：登录态**
部分视频需要登录 cookie；UA 必须是浏览器风格（源里已带）。

## 更新方式

源出问题时改对应 `.js` 推上来即可，客户端重新加载配置就生效，不需要发新版 App。
如果站点大改，改完先在 macOS 客户端的「源测试器」里跑「一键自检」再推。

## 免责声明

仅个人学习与自用。源只做页面解析，不托管、不存储任何内容；内容版权归原站所有。
