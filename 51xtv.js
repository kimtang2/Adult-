// ============================================================
//  5lxtv.com 爬虫 - 适配 TVBox / MiraPlay
//  基于 Python 脚本转换，完全重写为 JS
// ============================================================

var site_5lxtv = {
    name: '5lxtv',
    host: 'https://5lxtv.com',

    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },

    // 工具方法
    _fix: function(url) {
        if (!url) return '';
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return this.host + url;
        return url;
    },

    _clean: function(s) {
        if (!s) return '';
        return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    },

    _fetch: function(url, referer) {
        var resp = http.fetch(url, {
            headers: this.headers,
            referer: referer || this.host,
            timeout: 15000
        });
        return resp.text || resp;
    },

    // ---------- 解析视频列表 ----------
    _parseList: function(html) {
        var vod = [];
        var ids = {};
        var blocks = html.match(/<a[^>]+href="(\/videos\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g) || [];
        blocks.forEach(function(block) {
            var hrefMatch = block.match(/href="(\/videos\/[^"]+)"/);
            if (!hrefMatch) return;
            var href = site_5lxtv._fix(hrefMatch[1]);
            if (ids[href]) return;
            ids[href] = 1;

            var imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/);
            var pic = imgMatch ? site_5lxtv._fix(imgMatch[1]) : '';
            var altMatch = block.match(/<img[^>]+alt="([^"]*)"/);
            var title = altMatch ? site_5lxtv._clean(altMatch[1]) : '';
            if (!title) {
                var texts = block.match(/>([^<>]{2,120})</g) || [];
                texts = texts.map(function(t) { return site_5lxtv._clean(t); })
                             .filter(function(t) { return t && !/^\d+:\d+|^▶|^\d{4}-\d{2}-\d{2}$/.test(t); });
                title = texts.length ? texts[texts.length-1] : '';
            }
            var remark = '';
            var rm = block.match(/>([^<>]*(?:\d+:\d+|\d+:\d+:\d+|▶[^<>]*)[^<>]*)</g) || [];
            if (rm.length) {
                var r = rm.map(function(t) { return site_5lxtv._clean(t); }).filter(Boolean).join(' ');
                if (r) remark = r.substring(0, 30);
            }
            if (href && title) {
                vod.push({ vod_id: href, vod_name: title, vod_pic: pic, vod_remarks: remark });
            }
        });
        return vod;
    },

    // ---------- 解析分类 ----------
    _parseCats: function(html) {
        var arr = [];
        var seen = {};
        var bad = ['/', '/latest', '/rankings', '/channels', '/actors', '/tags', '/favorites'];
        var matches = html.match(/<a[^>]+href="(\/[^"\/?#]+)"[^>]*class="[^"]*(?:group|relative|block)[^"]*"[\s\S]*?<\/a>/g) || [];
        matches.forEach(function(block) {
            var hrefMatch = block.match(/href="(\/[^"\/?#]+)"/);
            if (!hrefMatch) return;
            var href = hrefMatch[1];
            if (bad.indexOf(href) > -1 || href.startsWith('/videos')) return;
            var imgAlt = block.match(/<img[^>]+alt="([^"]+)"/);
            var texts = block.match(/>([^<>]{2,30})</g) || [];
            texts = texts.map(function(t) { return site_5lxtv._clean(t); })
                         .filter(function(t) { return t && t.toLowerCase() !== 'channel' && t.toLowerCase() !== 'channels' && t.toLowerCase() !== 'creator' && t.toLowerCase() !== 'scandal'; });
            var name = imgAlt ? site_5lxtv._clean(imgAlt[1]) : (texts.length ? texts[texts.length-1] : href.replace('/', ''));
            if (!seen[href] && /^\/[a-z0-9_-]+$/.test(href)) {
                seen[href] = 1;
                arr.push({ type_name: name, type_id: href.replace('/', '') });
            }
        });
        if (arr.length === 0) {
            arr = [
                { type_name: '中文字幕', type_id: 'chinese' },
                { type_name: '偷拍盜攝', type_id: 'selfie' },
                { type_name: '黑料吃瓜', type_id: 'scandal' },
                { type_name: '獨家AV', type_id: 'exclusive' },
                { type_name: '綠帽NTR', type_id: 'cuckold' },
                { type_name: 'FC2外流', type_id: 'fc2' },
                { type_name: '網紅UP主', type_id: 'upzhu' }
            ];
        }
        return arr;
    },

    // ---------- 首页 ----------
    homeContent: function(filter) {
        var chtml = this._fetch(this.host + '/channels');
        var vhtml = this._fetch(this.host + '/latest');
        var classes = [{ type_name: '最新', type_id: 'latest' }]
                        .concat(this._parseCats(chtml))
                        .concat([{ type_name: '排行', type_id: 'rankings' }]);
        var ids = {}, clean = [];
        classes.forEach(function(c) {
            if (!ids[c.type_id]) { ids[c.type_id] = 1; clean.push(c); }
        });
        var list = this._parseList(vhtml);
        return { class: clean, list: list };
    },

    // ---------- 分类内容 ----------
    categoryContent: function(tid, pg, filter, extend) {
        pg = pg || 1;
        var path = tid === 'latest' ? '/latest' : (tid === 'rankings' ? '/rankings' : '/' + tid);
        var url = this.host + path + (path.indexOf('?') > -1 ? '&page=' + pg : '?page=' + pg);
        var html = this._fetch(url, this.host + '/channels');
        var list = this._parseList(html);
        var hasMore = html.indexOf('page=' + (pg+1)) > -1 ||
                      html.indexOf('下一頁') > -1 ||
                      html.indexOf('下一页') > -1 ||
                      html.indexOf('Next') > -1 ||
                      /rel="next"/.test(html);
        return {
            page: pg,
            pagecount: hasMore ? pg + 1 : pg,
            limit: list.length || 30,
            total: hasMore ? 999999 : list.length,
            list: list
        };
    },

    // ---------- 详情 ----------
    detailContent: function(ids) {
        var url = ids[0];
        var html = this._fetch(url, this.host + '/latest');
        var nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        var name = nameMatch ? this._clean(nameMatch[1]) : '5lxtv';
        var picMatch = html.match(/poster="([^"]+)"|<meta property="og:image" content="([^"]+)"/);
        var pic = picMatch ? this._fix(picMatch[1] || picMatch[2]) : '';
        var desc = [];
        ['時長', '观看', '觀看', '發布', '女优', '女優', '標籤', '标签'].forEach(function(k) {
            var reg = new RegExp(k + '[\\s\\S]{0,120}?<[^>]+>([^<>]+)<');
            var m = html.match(reg);
            if (m) desc.push(k + ':' + site_5lxtv._clean(m[1]));
        });
        var vod = {
            vod_id: url,
            vod_name: name,
            vod_pic: pic,
            type_name: '',
            vod_year: '',
            vod_area: '',
            vod_remarks: '',
            vod_actor: '',
            vod_director: '',
            vod_content: desc.join(' '),
            vod_play_from: '5lxtv',
            vod_play_url: '播放$' + url
        };
        return { list: [vod] };
    },

    // ---------- 搜索 ----------
    searchContent: function(key, quick, pg) {
        pg = pg || 1;
        var url = this.host + '/search?q=' + encodeURIComponent(key) + (pg > 1 ? '&page=' + pg : '');
        var html = this._fetch(url, this.host);
        var list = this._parseList(html);
        return { list: list, page: parseInt(pg) };
    },

    // ---------- 播放地址解析 ----------
    _realPlay: function(html) {
        var patterns = [
            /var\s+src\s*=\s*["']([^"']+playlist\.m3u8[^"']*)["']/,
            /var\s+src\s*=\s*["']([^"']+)["']/,
            /loadSource\(["']([^"']+playlist\.m3u8[^"']*)["']\)/,
            /["'](https?:\/\/[^"']+playlist\.m3u8[^"']*)["']/,
            /(https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)/
        ];
        for (var i=0; i<patterns.length; i++) {
            var m = html.match(patterns[i]);
            if (m) {
                return m[1].replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
            }
        }
        return '';
    },

    playerContent: function(flag, id, vipFlags) {
        var html = this._fetch(id, this.host);
        var play = this._realPlay(html);
        if (!play) {
            return { parse: 1, playUrl: '', url: id };
        }
        return { parse: 0, playUrl: '', url: play };
    }
};

// ---------- 构建 TVBox 标准 rule ----------
var rule = {
    sites: [
        {
            name: '5lxtv',
            url: 'https://5lxtv.com',
            type: 3,
            home: 'site_5lxtv_home',
            category: 'site_5lxtv_category',
            detail: 'site_5lxtv_detail',
            search: 'site_5lxtv_search',
            player: 'site_5lxtv_player'
        }
    ]
};

// 挂载全局函数
globalThis.site_5lxtv_home = site_5lxtv.homeContent.bind(site_5lxtv);
globalThis.site_5lxtv_category = site_5lxtv.categoryContent.bind(site_5lxtv);
globalThis.site_5lxtv_detail = site_5lxtv.detailContent.bind(site_5lxtv);
globalThis.site_5lxtv_search = site_5lxtv.searchContent.bind(site_5lxtv);
globalThis.site_5lxtv_player = site_5lxtv.playerContent.bind(site_5lxtv);

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = rule;
} else {
    window.rule = rule;
}
