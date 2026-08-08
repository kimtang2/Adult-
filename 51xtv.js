// ============================================================
//  KissJAV 爬虫 - 兼容 MiraPlay（稳当版）
// ============================================================

var site_kissjav = {
    name: 'KissJAV',
    host: 'https://kissjav.li',
    pic_host: 'https://assets6.cdnhop.com',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36',
        'Referer': 'https://kissjav.li/',
        'Origin': 'https://kissjav.li'
    },

    // ---------- 安全网络请求 ----------
    _fetch: function(url, referer) {
        try {
            // 尝试使用 http.fetch（TVBox 通用）
            if (typeof http !== 'undefined' && http.fetch) {
                var resp = http.fetch(url, {
                    headers: this.headers,
                    referer: referer || this.headers.Referer,
                    timeout: 15000
                });
                return resp.text || resp;
            }
            // 备用：使用 XMLHttpRequest（同步）
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.setRequestHeader('User-Agent', this.headers['User-Agent']);
            xhr.setRequestHeader('Referer', referer || this.headers.Referer);
            xhr.send();
            return xhr.responseText;
        } catch(e) {
            return '';
        }
    },

    // ---------- Base64 解码（安全） ----------
    _decodeBase64: function(str) {
        if (!str) return '';
        try {
            // 尝试 atob
            if (typeof atob !== 'undefined') return atob(str);
            // 备用：使用 Buffer（Node 环境）
            if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf-8');
        } catch(e) {}
        return str;
    },

    // ---------- 正则匹配辅助 ----------
    _match: function(text, rule) {
        if (!text) return '';
        var m = new RegExp(rule, 's').exec(text);
        return m ? m[1] : '';
    },

    // ---------- 清理 HTML ----------
    _clean: function(s) {
        if (!s) return '';
        return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
    },

    // ---------- 补全 URL ----------
    _fix: function(url) {
        if (!url) return '';
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return this.host + url;
        return url;
    },

    // ---------- 真实图片地址 ----------
    _realPic: function(vid) {
        if (!vid) return '';
        var base = Math.floor(parseInt(vid) / 1000) * 1000;
        return this.pic_host + '/contents/videos_screenshots/' + base + '/' + vid + '/320x180/1.jpg';
    },

    // ---------- 图片处理（不代理） ----------
    _img: function(url) {
        return this._fix(url);
    },

    // ---------- 解析列表（不用 matchAll） ----------
    _parseList: function(html) {
        var res = [];
        var seen = {};
        var regex = /<a\s+href=["'](https?:\/\/kissjav\.li\/video\/([^\/]+)\/[^"']*\/)["']\s+title=["']([^"']+)["']/g;
        var match;
        while ((match = regex.exec(html)) !== null) {
            var url = match[1];
            var vid = match[2];
            if (seen[url]) continue;
            seen[url] = 1;
            var start = match.index;
            var end = html.indexOf('<a href="https://kissjav.li/video/', start + match[0].length);
            if (end === -1) end = Math.min(html.length, start + 1600);
            var item = html.substring(start, end);
            var name = this._clean(match[3]);
            var pic = this._match(item, '(?:data-original|data-webp|data-src)=["\']([^"\']+)["\']') ||
                      this._match(item, 'src=["\']([^"\']+)["\']') ||
                      this._realPic(vid);
            if (pic.indexOf('data:image') > -1 || pic.indexOf('load.gif') > -1 || pic.indexOf('logo') > -1) {
                pic = this._realPic(vid);
            }
            var remarks = this._match(item, '<div[^>]+class=["\'][^"\']*time[^"\']*["\'][^>]*>(.*?)</div>') || vid;
            remarks = this._clean(remarks);
            if (name) {
                res.push({
                    vod_id: url,
                    vod_name: name,
                    vod_pic: this._img(pic),
                    vod_remarks: remarks
                });
            }
        }
        // 备用解析
        if (res.length === 0) {
            var altRegex = /href=["'](https?:\/\/kissjav\.li\/video\/([^\/]+)\/[^"']*\/)["'][^>]*title=["']([^"']+)["']/g;
            while ((match = altRegex.exec(html)) !== null) {
                var url2 = match[1];
                var vid2 = match[2];
                if (seen[url2]) continue;
                seen[url2] = 1;
                res.push({
                    vod_id: url2,
                    vod_name: this._clean(match[3]),
                    vod_pic: this._img(this._realPic(vid2)),
                    vod_remarks: vid2
                });
            }
        }
        return res;
    },

    // ---------- 首页 ----------
    homeContent: function(filter) {
        var html = this._fetch(this.host + '/');
        return {
            class: [
                { type_id: 'latest-updates', type_name: 'Latest' },
                { type_id: 'most-popular/?sort_by=video_viewed', type_name: 'Most Viewed' },
                { type_id: 'categories/korean-porn', type_name: 'Korean Porn' },
                { type_id: 'categories/korean-bj', type_name: 'Korean BJ' },
                { type_id: 'categories/vip', type_name: 'KVIP' },
                { type_id: 'categories/jvip', type_name: 'JVIP' },
                { type_id: 'categories/fc2ppv', type_name: 'FC2PPV' },
                { type_id: 'categories/uncensored', type_name: 'Uncensored' },
                { type_id: 'categories/hentai', type_name: 'Hentai' }
            ],
            list: this._parseList(html)
        };
    },

    // ---------- 分类 ----------
    categoryContent: function(tid, pg, filter, extend) {
        pg = pg || 1;
        var path = (tid || 'latest-updates').replace(/^\/+/, '');
        var url;
        if (path.indexOf('?') > -1) {
            url = this.host + '/' + path + (pg > 1 ? '&page=' + pg : '');
        } else {
            url = this.host + '/' + path + (pg > 1 ? '/' + pg + '/' : '/');
        }
        var html = this._fetch(url);
        return {
            page: pg,
            pagecount: 999,
            limit: 30,
            total: 999999,
            list: this._parseList(html)
        };
    },

    // ---------- 详情 ----------
    detailContent: function(ids) {
        var vid = ids[0];
        var html = this._fetch(vid);
        var sid = this._match(vid, '/video/(\\d+)/');
        var name = this._clean(this._match(html, '<meta property="og:title" content="(.*?)"') ||
                               this._match(html, 'video_title:\\s*[\'"]([^\'"]+)'));
        var pic = this._fix(this._match(html, '<meta property="og:image" content="(.*?)"') ||
                            this._match(html, 'preview_url:\\s*[\'"]([^\'"]+)') ||
                            this._realPic(sid));
        var desc = this._clean(this._match(html, '<meta property="og:description" content="(.*?)"'));
        var cate = this._clean(this._match(html, 'video_categories:\\s*[\'"]([^\'"]*)'));
        var remarks = this._clean(this._match(html, '<meta property="video:duration" content="(.*?)"'));
        var play_from = [];
        var play_url = [];
        var eps = [];
        var re = /(video_url(?:_hd)?):\s*[\'"]([^\'"]+)/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var key = m[1].indexOf('_hd') > -1 ? 'HD' : 'SD';
            var u = m[2];
            if (u && u !== 'MQ==') {
                var decoded = this._decodeBase64(u);
                if (decoded && decoded.startsWith('http')) u = decoded;
                if (u) eps.push(key + '$' + u);
            }
        }
        if (eps.length === 0) {
            var embed = this._match(html, 'embedUrl"\\s*:\\s*"(.*?)"') ||
                        this._match(html, 'src="(https://kissjav\\.li/embed/[^"]+)"');
            if (embed) eps.push('播放$' + embed);
        }
        if (eps.length > 0) {
            play_from.push('KissJAV');
            play_url.push(eps.join('#'));
        }
        return {
            list: [{
                vod_id: vid,
                vod_name: name,
                vod_pic: this._img(pic),
                vod_remarks: remarks,
                type_name: cate,
                vod_year: '',
                vod_area: '',
                vod_lang: '',
                vod_actor: '',
                vod_director: '',
                vod_content: desc,
                vod_play_from: play_from.join('$$$'),
                vod_play_url: play_url.join('$$$')
            }]
        };
    },

    // ---------- 搜索 ----------
    searchContent: function(key, quick, pg) {
        pg = pg || 1;
        var url = this.host + '/search/' + encodeURIComponent(key) + (pg > 1 ? '/' + pg + '/' : '/');
        var html = this._fetch(url);
        return { list: this._parseList(html), page: pg };
    },

    // ---------- 播放 ----------
    playerContent: function(flag, id, vipFlags) {
        var url = id;
        if (url.indexOf('/embed/') > -1) {
            var html = this._fetch(url);
            var u = this._match(html, '(?:video_url(?:_hd)?|file)\\s*[:=]\\s*[\'"]([^\'"]+)');
            if (u) {
                if (!u.startsWith('http')) u = this._decodeBase64(u);
                url = u;
            }
        }
        var isVideo = /\.(m3u8|mp4|flv|avi|mkv|mov|ts)(\?|$)|get_file\//.test(url);
        return {
            parse: isVideo ? 0 : 1,
            playUrl: '',
            url: url,
            header: JSON.stringify(this.headers)
        };
    }
};

// ---------- 构建 rule ----------
var rule = {
    sites: [
        {
            name: 'KissJAV',
            url: 'https://kissjav.li',
            type: 3,
            home: 'site_kissjav_home',
            category: 'site_kissjav_category',
            detail: 'site_kissjav_detail',
            search: 'site_kissjav_search',
            player: 'site_kissjav_player'
        }
    ]
};

// 挂载全局函数
globalThis.site_kissjav_home = site_kissjav.homeContent.bind(site_kissjav);
globalThis.site_kissjav_category = site_kissjav.categoryContent.bind(site_kissjav);
globalThis.site_kissjav_detail = site_kissjav.detailContent.bind(site_kissjav);
globalThis.site_kissjav_search = site_kissjav.searchContent.bind(site_kissjav);
globalThis.site_kissjav_player = site_kissjav.playerContent.bind(site_kissjav);

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = rule;
} else {
    window.rule = rule;
}
