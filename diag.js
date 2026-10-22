// 诊断源 v3：纯静态，不发网络请求 —— 验证 category() 是否被调用、返回格式是否被接受
export default {
    init(ext) {},

    home() {
        return { class: [{ type_id: "diag", type_name: "HOMEOK" }] };
    },

    category(tid, pg) {
        const list = [
            { vod_id: "a1", vod_name: "① 静态行 A（无网络）", vod_pic: "", vod_remarks: "1" },
            { vod_id: "a2", vod_name: "② 静态行 B（无网络）", vod_pic: "", vod_remarks: "2" },
            { vod_id: "a3", vod_name: "③ 静态行 C（无网络）", vod_pic: "", vod_remarks: "3" }
        ];
        // 顺带把运行时信息塞进标题，一起显示
        try { list[0].vod_name = "① net=" + typeof net + " req=" + (net ? typeof net.req : "-"); } catch (e) {}
        try { list[1].vod_name = "② PC_UA=" + (typeof PC_UA === "undefined" ? "undef" : "ok"); } catch (e) {}
        return { page: 1, pagecount: 1, limit: 50, total: list.length, list: list };
    },

    detail(id) { return { list: [] }; },
    search() { return { list: [] }; },
    play() { return { parse: 0, url: "" }; },
    destroy() {}
};
