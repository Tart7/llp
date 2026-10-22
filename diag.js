// 诊断源：把运行时信息当「视频列表」返回，直接在 App 界面上看结果
export default {
    init(ext) {},

    home() {
        return { class: [{ type_id: "diag", type_name: "诊断" }] };
    },

    async category(tid, pg) {
        const rows = [];
        const add = (name, value) => rows.push({
            vod_id: String(rows.length),
            vod_name: name + " → " + String(value).slice(0, 70),
            vod_pic: "",
            vod_remarks: "#" + (rows.length + 1)
        });

        try { add("typeof net", typeof net); } catch (e) { add("net 读取异常", e); }
        try { add("typeof net.req", typeof (net && net.req)); } catch (e) {}
        try { add("typeof net.http", typeof (net && net.http)); } catch (e) {}

        const url = "https://raw.githubusercontent.com/Tart7/llp/main/README.md";

        // ① 同步 net.req
        try {
            const t0 = Date.now();
            const r = net.req(url, { timeout: 15000 });
            add("req 耗时ms", Date.now() - t0);
            add("req 返回", Object.prototype.toString.call(r));
            if (r && typeof r === "object") {
                add("req.code", r.code);
                add("req.error", r.error === undefined ? "(undefined)" : r.error);
                add("req.content 类型", Object.prototype.toString.call(r.content));
                add("req.content 长度", r.content == null ? "null" : (r.content.length !== undefined ? r.content.length : "无length"));
                add("req.content 头", r.content == null ? "" : String(r.content).slice(0, 50).replace(/\s+/g, " "));
            } else {
                add("req 直接值", String(r).slice(0, 50));
            }
        } catch (e) {
            add("req 抛异常", (e && e.message) || e);
        }

        // ② 异步 net.http
        try {
            const t1 = Date.now();
            const r2 = await net.http(url, { timeout: 15000 });
            add("http 耗时ms", Date.now() - t1);
            add("http 返回", Object.prototype.toString.call(r2));
            if (r2 && typeof r2 === "object") {
                add("http.code", r2.code);
                add("http.error", r2.error === undefined ? "(undefined)" : r2.error);
                add("http.content 类型", Object.prototype.toString.call(r2.content));
                add("http.content 长度", r2.content == null ? "null" : (r2.content.length !== undefined ? r2.content.length : "无length"));
            }
        } catch (e) {
            add("http 抛异常", (e && e.message) || e);
        }

        // ③ 真实站点（MissAV）响应
        try {
            const r3 = net.req("https://missav.ai/dm817/cn/uncensored-leak?page=1", {
                headers: { "User-Agent": PC_UA, "Referer": "https://missav.ai/" },
                timeout: 15000
            });
            const code = r3 && r3.code;
            const len = r3 && r3.content ? String(r3.content).length : 0;
            add("missav code/长度", code + " / " + len);
            add("missav 含 CF", r3 && r3.content ? (String(r3.content).indexOf("cf-") >= 0 || String(r3.content).indexOf("cloudflare") >= 0) : "-");
        } catch (e) {
            add("missav 异常", (e && e.message) || e);
        }

        add("PC_UA 前 30", PC_UA.slice(0, 30));
        return { page: 1, pagecount: 1, limit: 60, total: rows.length, list: rows };
    },

    detail(id) { return { list: [] }; },
    search() { return { list: [] }; },
    play() { return { parse: 0, url: "" }; },
    destroy() {}
};
