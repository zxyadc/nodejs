import * as cheerio from 'cheerio';
// import jsonpath from 'jsonpath';
import {urljoin} from "../utils/utils.js";
import '../libs_drpy/jsonpathplus.min.js'

export const jsonpath = {
    query(jsonObject, path) {
        return JSONPath.JSONPath({path: path, json: jsonObject})
    }
};
const PARSE_CACHE = true; // 解析缓存
const NOADD_INDEX = ':eq|:lt|:gt|:first|:last|:not|:even|:odd|:has|:contains|:matches|:empty|^body$|^#'; // 不自动加eq下标索引
const URLJOIN_ATTR = '(url|src|href|-original|-src|-play|-url|style)$|^(data-|url-|src-)'; // 需要自动urljoin的属性
const SPECIAL_URL = '^(ftp|magnet|thunder|ws):'; // 过滤特殊链接,不走urlJoin

class Jsoup {
    constructor(MY_URL = '') {
        this.MY_URL = MY_URL;
        this.pdfh_html = '';
        this.pdfa_html = '';
        this.pdfh_doc = null;
        this.pdfa_doc = null;
    }

    test(text, string) {
        const searchObj = new RegExp(text, 'mi').exec(string);
        return searchObj ? true : false;
    }

    contains(text, match) {
        return text.indexOf(match) !== -1;
    }

    parseHikerToJq(parse, first = false) {
        if (this.contains(parse, '&&')) {
            const parses = parse.split('&&');
            const new_parses = [];
            for (let i = 0; i < parses.length; i++) {
                const ps_list = parses[i].split(' ');
                const ps = ps_list[ps_list.length - 1];
                if (!this.test(NOADD_INDEX, ps)) {
                    if (!first && i >= parses.length - 1) {
                        new_parses.push(parses[i]);
                    } else {
                        new_parses.push(`${parses[i]}:eq(0)`);
                    }
                } else {
                    new_parses.push(parses[i]);
                }
            }
            parse = new_parses.join(' ');
        } else {
            const ps_list = parse.split(' ');
            const ps = ps_list[ps_list.length - 1];
            if (!this.test(NOADD_INDEX, ps) && first) {
                parse = `${parse}:eq(0)`;
            }
        }
        return parse;
    }

    getParseInfo(nparse) {
        let excludes = [];
        let nparse_index = 0;
        let nparse_rule = nparse;

        if (this.contains(nparse, ':eq')) {
            nparse_rule = nparse.split(':eq')[0];
            let nparse_pos = nparse.split(':eq')[1];
            if (this.contains(nparse_rule, '--')) {
                excludes = nparse_rule.split('--').slice(1);
                nparse_rule = nparse_rule.split('--')[0];
            } else if (this.contains(nparse_pos, '--')) {
                excludes = nparse_pos.split('--').slice(1);
                nparse_pos = nparse_pos.split('--')[0];
            }
            try {
                nparse_index = parseInt(nparse_pos.split('(')[1].split(')')[0]);
            } catch {
            }
        } else if (this.contains(nparse, '--')) {
            nparse_rule = nparse.split('--')[0];
            excludes = nparse.split('--').slice(1);
        }

        return {nparse_rule, nparse_index, excludes};
    }

    reorderAdjacentLtAndGt(selector) {
        const adjacentPattern = /:gt\((\d+)\):lt\((\d+)\)/;
        let match;
        while ((match = adjacentPattern.exec(selector)) !== null) {
            const replacement = `:lt(${match[2]}):gt(${match[1]})`;
            selector = selector.substring(0, match.index) + replacement + selector.substring(match.index + match[0].length);
            adjacentPattern.lastIndex = match.index;
        }
        return selector;
    }

    parseOneRule(doc, nparse, ret) {
        let {nparse_rule, nparse_index, excludes} = this.getParseInfo(nparse);
        nparse_rule = this.reorderAdjacentLtAndGt(nparse_rule);
        if (!ret) ret = doc(nparse_rule);
        else ret = ret.find(nparse_rule);

        if (this.contains(nparse, ':eq')) ret = ret.eq(nparse_index);

        if (excludes.length > 0 && ret) {
            ret = ret.clone();
            for (let exclude of excludes) {
                ret.find(exclude).remove();
            }
        }

        return ret;
    }

    parseText(text) {
        text = text.replace(/[\s]+/gm, '\n');
        text = text.replace(/\n+/g, '\n').replace(/^\s+/, '');
        text = text.replace(/\n/g, ' ');
        return text;
    }

    pdfa(html, parse) {
        if (!html || !parse) return [];
        parse = this.parseHikerToJq(parse);

        const doc = cheerio.load(html);
        if (PARSE_CACHE) {
            if (this.pdfa_html !== html) {
                this.pdfa_html = html;
                this.pdfa_doc = doc;
            }
        }

        const parses = parse.split(' ');
        let ret = null;
        for (const nparse of parses) {
            ret = this.parseOneRule(doc, nparse, ret);
            if (!ret) return [];
        }

        const res = (ret?.toArray() ?? []).map((item) => {
            const res_html = `${doc(item)}`;
            return res_html ? res_html : '';
        });
        return res;
    }

    pdfl(html, parse, list_text, list_url, url_key) {
        if (!html || !parse) return [];
        parse = this.parseHikerToJq(parse, false);
        const new_vod_list = [];

        const doc = cheerio.load(html);
        const parses = parse.split(' ');
        let ret = null;
        for (const pars of parses) {
            ret = this.parseOneRule(doc, pars, ret);
            if (!ret) return [];
        }

        ret.each((_, element) => {
            new_vod_list.push(`${doc(element)}`);
        });

        return new_vod_list;
    }

    pdfh(html, parse, baseUrl = '') {
        if (!html || !parse) return '';

        const doc = cheerio.load(html);
        if (PARSE_CACHE) {
            if (this.pdfh_html !== html) {
                this.pdfh_html = html;
                this.pdfh_doc = doc;
            }
        }

        if (parse === 'body&&Text' || parse === 'Text') {
            return this.parseText(doc.text());
        } else if (parse === 'body&&Html' || parse === 'Html') {
            return doc.html();
        }

        let option;
        if (this.contains(parse, '&&')) {
            const parts = parse.split('&&');
            option = parts[parts.length - 1];
            parse = parts.slice(0, -1).join('&&');
        }
        parse = this.parseHikerToJq(parse, true);
        const parses = parse.split(' ');

        let ret = null;
        for (const nparse of parses) {
            ret = this.parseOneRule(doc, nparse, ret);
            if (!ret) return '';
        }
        if (option) {
            switch (option) {
                case 'Text':
                    ret = ret?.text() || '';
                    ret = ret ? this.parseText(ret) : '';
                    break;
                case 'Html':
                    ret = ret?.html() || '';
                    break;
            }
        }
        return ret;
    }

    pd(html, parse, baseUrl = '') {
        if (!baseUrl) baseUrl = this.MY_URL;
        return this.pdfh(html, parse, baseUrl);
    }

    pq(html) {
        return cheerio.load(html);
    }

    pjfh(html, parse, addUrl = false) {
        if (!html || !parse) return '';

        try {
            html = typeof html === 'string' ? JSON.parse(html) : html;
        } catch {
            console.log('字符串转 JSON 失败');
            return '';
        }

        if (!parse.startsWith('$.')) parse = '$.' + parse;

        let ret = '';
        const paths = parse.split('||');
        for (const path of paths) {
            const queryResult = jsonpath.query(html, path);
            ret = Array.isArray(queryResult) ? queryResult[0] || '' : queryResult || '';
            if (addUrl && ret) ret = urljoin(this.MY_URL, ret);
            if (ret) break;
        }

        return ret;
    }

    pj(html, parse) {
        return this.pjfh(html, parse, true);
    }

    pjfa(html, parse) {
        if (!html || !parse) return [];

        try {
            html = typeof html === 'string' ? JSON.parse(html) : html;
        } catch {
            return [];
        }

        if (!parse.startsWith('$.')) parse = '$.' + parse;

        const result = jsonpath.query(html, parse);
        if (Array.isArray(result) && Array.isArray(result[0]) && result.length === 1) {
            return result[0];
        }

        return result || [];
    }
}

export const jsoup = Jsoup;
// export default Jsoup;
