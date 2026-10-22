// 诊断源 v2：全同步，只用 net.req，把运行时信息当列表返回
export default {
    init(ext) {},

    home() {
        return { class: [{ type_id: "diag", type_name: "诊断" }] };
    },

    // 注意：不写成 async —— FongMi 对 category 的返回值可能不 await Promise
    category(tid, pg) {
        const rows = [];
        const add = (name, value) => rows.push({
            vod_id: "id" + rows.length,
            vod_name: name + " → " + String(value).slice(0, 60),
            vod_pic: "",
            vod_remarks: "#" + (rows.length + 1)
        });

        add("STEP", "category 已进入");

        try { add("typeof net", typeof net); } catch (e) { add("net 异常", e); }
        try { add("net.req", typeof (net && net.req)); } catch (e) {}
        try { add("net.http", typeof (net && net.http)); } catch (e) {}

        add("PC_UA", typeof PC_UA === "undefined" ? "undefined" : PC_UA.slice(0, 24));

        // ① 简单请求（raw.githubusercontent）
        const u1 = "https://raw.githubusercontent.com/Tart7/llp/main/README.md";
        try {
            const t0 = Date.now();
            const r = net.req(u1, { timeout: 15000 });
            add("req 耗时", (Date.now() - t0) + "ms");
            add("req 返回类型", Object.prototype.toString.call(r));
            if (r && typeof r === "object") {
                add("req.code", r.code);
                add("req.error", r.error === undefined ? "(undef)" : r.error);
                add("content 类型", Object.prototype.toString.call(r.content));
                add("content 长度", r.content == null ? "null" : String(r.content).length);
                add("content 头", r.content == null ? "" : String(r.content).slice(0, 40).replace(/\s+/g, " "));
            } else {
                add("req 直接值", String(r).slice(0, 40));
            }
        } catch (e) {
            add("req 抛异常", (e && e.message) || e);
        }

        // ② 真实站点 MissAV
        try {
            const u2 = "https://missav.ai/dm817/cn/uncensored-leak?page=1";
            const r2 = net.req(u2, { headers: { "User-Agent": PC_UA, "Referer": "https://missav.ai/" }, timeout: 15000 });
            add("missav code", r2 && r2.code);
            add("missav 长度", r2 && r2.content ? String(r2.content).length : 0);
            add("missav 首标签", r2 && r2.content ? (String(r2.content).match(/<title>[^<]*/) || ["-"])[0].slice(0, 40) : "-");
        } catch (e) {
            add("missav 异常", (e && e.message) || e);
        }

        // ③ PornHub
        try {
            const r3 = net.req("https://jp.pornhub.com/video?c=99", { headers: { "User-Agent": PC_UA }, timeout: 15000 });
            add("pornhub code", r3 && r3.code);
            add("pornhub 长度", r3 && r3.content ? String(r3.content).length : 0);
            add("pornhub 卡片数", r3 && r3.content ? (String(r3.content).match(/pcVideoListItem/g) || []).length : 0);
        } catch (e) {
            add("pornhub 异常", (e && e.message) || e);
        }

        add("总行数", rows.length);
        return { page: 1, pagecount: 1, limit: 60, total: rows.length, list: rows };
    },

    detail(id) { return { list: [] }; },
    search() { return { list: [] }; },
    play() { return { parse: 0, url: "" }; },
    destroy() {}
};
