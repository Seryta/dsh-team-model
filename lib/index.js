import z from '@deepseek-ai/schemastery';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
export const name = 'dsh-team-model';
/**
 * 核心服务必需。`webServer` 只在 Web 宿主存在，用 `ctx.inject(['webServer'], ...)`
 * 子级延迟挂载——headless 宿主照常注入路由逻辑（只是没有设置页 API）。
 */
export const inject = ['subagents'];
export const Config = z.object({
    provider: z.string().default(''),
    model: z.string().default(''),
    reasoningEffort: z.string().default(''),
    maxTokens: z.number().min(0).default(0),
});
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh');
/** 设置页写入的活配置；**插件 Config 只作为初始默认值**。 */
const STORE_FILE = join(DSH_HOME, 'dsh-team-model.json');
const BASE = '/team-model/api';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
/**
 * 校验并归一化一套路由；provider/model 同时留空 = 跟随主对话（返回 null）。
 * @param raw - 配置对象（文件或请求体）。
 * @returns 归一化路由，或 null 表示不覆写。
 */
function normalizeRoute(raw) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const record = raw;
    const provider = text(record.provider);
    const model = text(record.model);
    if (provider === '' && model === '')
        return null;
    if (provider === '' || model === '')
        throw new Error('provider 与 model 必须同时填写，或同时留空（跟随主对话）');
    const reasoningEffort = text(record.reasoningEffort);
    const rawMaxTokens = record.maxTokens === undefined || record.maxTokens === null ? 0 : Number(record.maxTokens);
    if (!Number.isFinite(rawMaxTokens) || rawMaxTokens < 0)
        throw new Error('maxTokens 必须是非负整数');
    const maxTokens = Math.floor(rawMaxTokens);
    return {
        provider,
        model,
        ...(reasoningEffort === '' ? {} : { reasoningEffort }),
        ...(maxTokens > 0 ? { maxTokens } : {}),
    };
}
function readStore() {
    try {
        return normalizeRoute(JSON.parse(readFileSync(STORE_FILE, 'utf8')));
    }
    catch {
        return null;
    }
}
function writeStore(route) {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    const temp = STORE_FILE + '.tmp';
    writeFileSync(temp, JSON.stringify(route === null ? {} : route, null, 2) + '\n', 'utf8');
    renameSync(temp, STORE_FILE);
}
/** 团队 spawn 判定：预留 childId + delivery:'parent' + 父 agent 是 Team Lead。 */
function isTeammateSpawn(ctx, spec) {
    if (spec === null || typeof spec !== 'object')
        return false;
    if (spec.childId === undefined || spec.delivery !== 'parent')
        return false;
    const parent = spec.request?.parent;
    if (parent === undefined)
        return false;
    const teams = ctx.get('agentTeams');
    if (teams === undefined || typeof teams.membership !== 'function')
        return false;
    try {
        return teams.membership(parent)?.role === 'lead';
    }
    catch {
        return false;
    }
}
export function apply(ctx, config) {
    const fallback = (() => {
        try {
            return normalizeRoute(config);
        }
        catch {
            return null;
        }
    })();
    // 每次 spawn 读一次文件（带 mtime 缓存），这样直接改 JSON 也能立刻生效。
    let cache;
    function effectiveRoute() {
        try {
            const stat = statSync(STORE_FILE);
            if (cache !== undefined && cache.mtimeMs === stat.mtimeMs)
                return cache.route;
            const route = readStore();
            cache = { mtimeMs: stat.mtimeMs, route };
            return route;
        }
        catch {
            cache = undefined;
            return fallback;
        }
    }
    // ── 拦截 teammate 创建，注入模型路由 ────────────────────────────────
    const subagents = ctx.subagents;
    const original = subagents?.startActivation;
    if (typeof original === 'function') {
        const patched = function (spec) {
            try {
                const route = effectiveRoute();
                if (route !== null && isTeammateSpawn(ctx, spec)) {
                    return original.call(this, {
                        ...spec,
                        request: {
                            ...spec.request,
                            agentOptions: {
                                ...(spec.request?.agentOptions ?? {}),
                                provider: route.provider,
                                model: route.model,
                                ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
                                ...(route.maxTokens === undefined ? {} : { maxTokens: route.maxTokens }),
                            },
                        },
                    });
                }
            }
            catch (error) {
                ctx.logger?.warn?.(`[dsh-team-model] teammate 路由注入失败，按主对话继承：${String(error)}`);
            }
            return original.call(this, spec);
        };
        subagents.startActivation = patched;
        ctx.effect(() => () => {
            if (subagents.startActivation === patched)
                subagents.startActivation = original;
        });
    }
    else {
        ctx.logger?.warn?.('[dsh-team-model] 未找到 ctx.subagents.startActivation，插件未生效');
    }
    // ── Web 设置页 API（子级延迟注入：headless 宿主没有 webServer 也照常工作）─────
    function send(res, status, body) {
        res.writeHead(status, JSON_HEADERS);
        res.end(JSON.stringify(body));
    }
    async function readBody(req) {
        const chunks = [];
        for await (const chunk of req)
            chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        return raw === '' ? {} : JSON.parse(raw);
    }
    function providers() {
        const llm = ctx.get('llm');
        if (llm === undefined || typeof llm.listProviders !== 'function')
            return [];
        try {
            return llm.listProviders().map((candidate) => ({
                id: String(candidate?.id ?? candidate?.provider ?? ''),
                name: String(candidate?.displayName ?? candidate?.name ?? candidate?.id ?? candidate?.provider ?? ''),
            })).filter((entry) => entry.id !== '');
        }
        catch {
            return [];
        }
    }
    /**
     * 与浏览器模型选择器同源的模型目录：provider → models → reasoning efforts。
     * 语义照 `@deepseek-ai/dsh-api-session-controller` 的 buildModelCatalog（provider 失败隔离、
     * 空 model 列表丢弃），只是不涉及默认选中项。
     */
    async function buildCatalog(llm) {
        if (llm === undefined || typeof llm.listProviders !== 'function')
            return [];
        const groups = [];
        for (const provider of llm.listProviders()) {
            const id = String(provider?.id ?? '');
            if (id === '')
                continue;
            let models;
            try {
                models = await llm.listModels(id);
            }
            catch {
                continue;
            }
            const entries = [];
            for (const model of models) {
                const entry = { id: String(model?.id ?? ''), name: String(model?.name ?? model?.id ?? '') };
                if (entry.id === '')
                    continue;
                try {
                    const info = await llm.resolveModelInfo(id, entry.id);
                    const reasoning = info?.reasoning;
                    if (reasoning !== undefined) {
                        entry.reasoning = {
                            efforts: (reasoning.efforts ?? [])
                                .map((effort) => ({ id: String(effort?.id ?? ''), name: String(effort?.name ?? effort?.id ?? '') }))
                                .filter((effort) => effort.id !== ''),
                            ...(reasoning.defaultEffort === undefined ? {} : { defaultEffort: String(reasoning.defaultEffort) }),
                        };
                    }
                }
                catch {
                    /* 单个模型解析失败不影响整份目录 */
                }
                entries.push(entry);
            }
            if (entries.length === 0)
                continue;
            groups.push({ id, name: String(provider?.displayName ?? provider?.name ?? id), models: entries });
        }
        return groups;
    }
    let catalogCache;
    ctx.inject(['webServer'], (sub) => {
        const webServer = sub.webServer;
        const handlers = [];
        handlers.push(webServer.register({
            kind: 'exact',
            path: `${BASE}/state`,
            handler: (_req, res) => {
                const stored = readStore();
                send(res, 200, {
                    ok: true,
                    lead: 'follow-main',
                    route: stored,
                    source: stored === null ? (fallback === null ? 'inherit' : 'config') : 'store',
                    store: STORE_FILE,
                    providers: providers(),
                });
            },
        }));
        handlers.push(webServer.register({
            kind: 'exact',
            path: `${BASE}/catalog`,
            handler: async (_req, res) => {
                try {
                    const now = Date.now();
                    if (catalogCache === undefined || now - catalogCache.at > 60_000) {
                        catalogCache = { at: now, groups: await buildCatalog(ctx.get('llm')) };
                    }
                    send(res, 200, { ok: true, groups: catalogCache.groups });
                }
                catch (error) {
                    send(res, 200, { ok: false, groups: [], error: String(error?.message ?? error) });
                }
            },
        }));
        handlers.push(webServer.register({
            kind: 'exact',
            path: `${BASE}/models`,
            handler: async (req, res) => {
                const url = new URL(String(req.url ?? ''), 'http://localhost');
                const provider = text(url.searchParams.get('provider'));
                const llm = ctx.get('llm');
                if (provider === '' || llm === undefined || typeof llm.listModels !== 'function') {
                    send(res, 200, { ok: true, models: [] });
                    return;
                }
                try {
                    const models = await llm.listModels(provider);
                    send(res, 200, {
                        ok: true,
                        models: models.map((model) => ({
                            id: String(model?.id ?? ''),
                            name: String(model?.name ?? model?.id ?? ''),
                        })).filter((model) => model.id !== ''),
                    });
                }
                catch (error) {
                    send(res, 200, { ok: false, error: String(error), models: [] });
                }
            },
        }));
        handlers.push(webServer.register({
            kind: 'exact',
            path: `${BASE}/config`,
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    send(res, 405, { ok: false, error: 'POST only' });
                    return;
                }
                try {
                    const body = await readBody(req);
                    const route = normalizeRoute(body);
                    if (route !== null) {
                        const llm = ctx.get('llm');
                        if (llm !== undefined && typeof llm.resolveModelInfo === 'function') {
                            // 路由必须能被当前适配器解析，避免把错别字写进 teammate 创建路径。
                            const info = await llm.resolveModelInfo(route.provider, route.model);
                            if (route.reasoningEffort !== undefined) {
                                const reasoning = info?.reasoning;
                                if (reasoning === undefined) {
                                    throw new Error(`模型 ${route.provider}/${route.model} 没有可选的思考强度，请把「思考强度」留空`);
                                }
                                const allowed = (reasoning.efforts ?? []).map((effort) => String(effort?.id ?? ''));
                                if (!allowed.includes(route.reasoningEffort)) {
                                    throw new Error(`模型 ${route.provider}/${route.model} 不支持思考强度 "${route.reasoningEffort}"（可用：${allowed.length === 0 ? '无' : allowed.join(' / ')}）`);
                                }
                            }
                        }
                    }
                    writeStore(route);
                    cache = undefined;
                    send(res, 200, { ok: true, route, store: STORE_FILE });
                }
                catch (error) {
                    send(res, 400, { ok: false, error: String(error?.message ?? error) });
                }
            },
        }));
        sub.effect(() => () => {
            for (const dispose of handlers) {
                try {
                    dispose();
                }
                catch {
                    /* 路由已随宿主销毁 */
                }
            }
        }, 'dsh-team-model: routes');
    });
    ctx.logger?.info?.(`[dsh-team-model] 已生效：Lead 跟随主对话；teammate 覆写=${effectiveRoute() === null ? '否（继承主对话）' : '是'}；store=${STORE_FILE}`);
}
//# sourceMappingURL=index.js.map