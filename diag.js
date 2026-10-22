// 诊断源 v4：验证 net.req 的真实网络行为
export default {
    init(ext) {},

    home() {
        return { class: [{ type_id: "diag", type_name: "网络测试" }] };
    },

    category(tid, pg) {
        const rows = [];
        const add = (name, value) => rows.push({
            vod_id: "id" + rows.length,
            vod_name: name + " → " + String(value).slice(0, 50),
            vod_pic: "",
            vod_remarks: "#" + (rows.length + 1)
        });

        const probe = (label, url, headers) => {
            try {
                const t0 = Date.now();
                const r = net.req(url, { headers: headers || {}, timeout: 20000 });
                const ms = Date.now() - t0;
                if (r && typeof r === "object") {
                    const c = r.content;
                    const len = c == null ? 0 : (typeof c === "string" ? c.length : (c.byteLength !== undefined ? c.byteLength : -1));
                    add(label + " code/ms", r.code + " / " + ms + "ms");
                    add(label + " len/type", len + " / " + Object.prototype.toString.call(c).replace("[object ", "").replace("]", ""));
                    if (r.error) add(label + " error", r.error);
                    if (typeof c === "string" && c.length > 20) add(label + " 头20", c.slice(0, 20).replace(/\s+/g, " "));
                } else {
                    add(label + " 非对象", Object.prototype.toString.call(r));
                }
            } catch (e) {
                add(label + " 抛异常", (e && e.message) || e);
            }
        };

        const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

        probe("github", "https://raw.githubusercontent.com/Tart7/llp/main/README.md", {});
        probe("missav", "https://missav.ai/dm817/cn/uncensored-leak?page=1", { "User-Agent": UA, "Referer": "https://missav.ai/" });
        probe("pornhub", "https://jp.pornhub.com/video?c=99", { "User-Agent": UA });
        probe("91porn", "https://91porn.com/index.php", { "User-Agent": UA });

        return { page: 1, pagecount: 1, limit: 60, total: rows.length, list: rows };
    },

    detail(id) { return { list: [] }; },
    search() { return { list: [] }; },
    play() { return { parse: 0, url: "" }; },
    destroy() {}
};
