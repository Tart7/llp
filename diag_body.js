// 验证 body:'' 是否会让请求变成 POST
export default {
    init(ext) {},
    home() { return { class: [{ type_id: "b", type_name: "body测试" }] }; },
    category(tid, pg) {
        const rows = [];
        const add = (n, v) => rows.push({ vod_id: "i" + rows.length, vod_name: n + " → " + String(v).slice(0, 46), vod_pic: "", vod_remarks: "#" + (rows.length + 1) });
        const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        const U = "https://missav.ai/dm817/cn/uncensored-leak?page=1";

        const run = (label, opts) => {
            try {
                const t0 = Date.now();
                const r = net.req(U, opts);
                const c = r && r.content;
                const len = c == null ? 0 : String(c).length;
                const cards = c ? (String(c).match(/thumbnail/g) || []).length : 0;
                add(label, (r && r.code) + " / " + len + "字 / " + (Date.now() - t0) + "ms / 卡片" + cards);
            } catch (e) { add(label, "异常:" + ((e && e.message) || e)); }
        };

        run("A 带body空串", { headers: { "User-Agent": UA, "Referer": "https://missav.ai/" }, method: "GET", body: "", timeout: 20000 });
        run("B 不传body", { headers: { "User-Agent": UA, "Referer": "https://missav.ai/" }, timeout: 20000 });
        run("C 只timeout", { timeout: 20000 });
        return { page: 1, pagecount: 1, limit: 50, total: rows.length, list: rows };
    },
    detail(id) { return { list: [] }; }, search() { return { list: [] }; },
    play() { return { parse: 0, url: "" }; }, destroy() {}
};
