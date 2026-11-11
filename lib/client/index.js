/**
 * dsh-team-model —— 设置页 UI（`settings.section` 槽位）。
 *
 * 给「所有非 Lead 的 teammate」选一套模型路由：提供商 / 模型 / 思考强度，
 * 三项各自都可留空（和主对话里的模型选择器同源目录、同一套语义）：
 *   · 提供商留空 = 跟随主对话（teammate 继承 Lead 的路由）
 *   · 模型留空 = 未选完，不能保存
 *   · 思考强度留空 = 交给模型默认
 * Lead 一栏只读：Lead 就是主对话 agent，路由永远跟随主对话。
 * 通信：同源 fetch → host `webServer` 路由 `/team-model/api/*`。
 */
import * as React from 'react';
export const inject = ['slots'];
const BASE = '/team-model/api';
async function request(path, init) {
    const response = await fetch(BASE + path, init);
    return (await response.json());
}
const rowStyle = { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' };
const labelStyle = { minWidth: '132px', opacity: 0.72, fontSize: '13px' };
const inputStyle = {
    background: 'transparent',
    color: 'inherit',
    border: '1px solid rgba(127,127,127,0.4)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '13px',
    minWidth: '200px',
};
const buttonStyle = { ...inputStyle, cursor: 'pointer', minWidth: 'auto' };
const hintStyle = { fontSize: '12px', opacity: 0.62, margin: '4px 0 0' };
/** 设置页组件：提供商 / 模型 / 思考强度三选，全部可选。 */
function TeamModelSection() {
    const [groups, setGroups] = React.useState([]);
    const [provider, setProvider] = React.useState('');
    const [model, setModel] = React.useState('');
    const [effort, setEffort] = React.useState('');
    const [status, setStatus] = React.useState('读取中…');
    const [busy, setBusy] = React.useState(false);
    const [store, setStore] = React.useState('');
    React.useEffect(() => {
        void (async () => {
            try {
                const [catalog, state] = await Promise.all([
                    request('/catalog'),
                    request('/state'),
                ]);
                const nextGroups = catalog.groups ?? [];
                setGroups(nextGroups);
                setStore(state.store ?? '');
                const route = state.route ?? null;
                if (route !== null) {
                    setProvider(route.provider);
                    setModel(route.model);
                    setEffort(route.reasoningEffort ?? '');
                    setStatus('当前：teammate 走独立配置');
                }
                else {
                    setStatus('当前：teammate 跟随主对话模型');
                }
            }
            catch (error) {
                setStatus('读取配置失败：' + String(error));
            }
        })();
    }, []);
    const group = groups.find((entry) => entry.id === provider);
    const modelEntry = group?.models.find((entry) => entry.id === model);
    const efforts = modelEntry?.reasoning?.efforts ?? [];
    const incomplete = provider !== '' && model === '';
    async function save() {
        setBusy(true);
        try {
            const result = await request('/config', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ provider, model, reasoningEffort: effort }),
            });
            if (result.ok !== true)
                throw new Error(result.error ?? '保存被拒绝');
            setStatus(provider === '' ? '已切换为跟随主对话模型' : '已保存：之后新建的 teammate 使用该模型');
        }
        catch (error) {
            setStatus('保存失败：' + String(error?.message ?? error));
        }
        finally {
            setBusy(false);
        }
    }
    function followMain() {
        setProvider('');
        setModel('');
        setEffort('');
        void (async () => {
            setBusy(true);
            try {
                const result = await request('/config', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ provider: '', model: '', reasoningEffort: '' }),
                });
                if (result.ok !== true)
                    throw new Error(result.error ?? '保存被拒绝');
                setStatus('已切换为跟随主对话模型');
            }
            catch (error) {
                setStatus('保存失败：' + String(error?.message ?? error));
            }
            finally {
                setBusy(false);
            }
        })();
    }
    const effortOptions = efforts.map((level) => React.createElement('option', { key: level.id, value: level.id }, `${level.name} (${level.id})`));
    const savedEffortMissing = effort !== '' && efforts.every((level) => level.id !== effort);
    return React.createElement('div', { style: { padding: '4px 2px 12px' } }, React.createElement('div', { style: rowStyle }, React.createElement('span', { style: labelStyle }, 'Lead（主对话）'), React.createElement('span', { style: { fontSize: '13px' } }, '跟随当前会话选择的模型 —— 不覆写')), React.createElement('div', { style: rowStyle }, React.createElement('span', { style: labelStyle }, '提供商'), React.createElement('select', {
        style: inputStyle,
        value: provider,
        disabled: busy,
        onChange: (event) => {
            setProvider(event.target.value);
            setModel('');
            setEffort('');
        },
    }, React.createElement('option', { key: '', value: '' }, '跟随主对话（不覆写）'), groups.map((entry) => React.createElement('option', { key: entry.id, value: entry.id }, entry.name === entry.id ? entry.id : `${entry.name} (${entry.id})`)))), React.createElement('div', { style: rowStyle }, React.createElement('span', { style: labelStyle }, '模型'), React.createElement('select', {
        style: inputStyle,
        value: model,
        disabled: busy || provider === '',
        onChange: (event) => {
            setModel(event.target.value);
            setEffort('');
        },
    }, React.createElement('option', { key: '', value: '' }, provider === '' ? '（先选提供商）' : '（选择模型）'), (group?.models ?? []).map((entry) => React.createElement('option', { key: entry.id, value: entry.id }, `${entry.name} (${entry.id})`)))), React.createElement('div', { style: rowStyle }, React.createElement('span', { style: labelStyle }, '思考强度'), React.createElement('select', {
        style: inputStyle,
        value: effort,
        disabled: busy || modelEntry === undefined || (efforts.length === 0 && effort === ''),
        onChange: (event) => setEffort(event.target.value),
    }, React.createElement('option', { key: '', value: '' }, modelEntry === undefined ? '（先选模型）' : '模型默认（不指定）'), effortOptions, savedEffortMissing ? React.createElement('option', { key: effort, value: effort }, `已保存：${effort}（当前模型未声明）`) : null)), React.createElement('div', { style: rowStyle }, React.createElement('button', {
        style: buttonStyle,
        disabled: busy || incomplete,
        onClick: () => void save(),
    }, busy ? '保存中…' : '保存'), React.createElement('button', { style: buttonStyle, disabled: busy, onClick: followMain }, '跟随主对话'), React.createElement('span', { style: { fontSize: '12px', opacity: 0.8 } }, status)), incomplete ? React.createElement('p', { style: { ...hintStyle, opacity: 0.85 } }, '选了提供商还要选模型才能保存；想不覆写就点「跟随主对话」。') : null, React.createElement('p', { style: hintStyle }, '覆盖范围：所有新建的非 Lead teammate（同一套配置）；Lead 永远等于主对话。已存在的 teammate 保持创建时的模型。'), store === '' ? null : React.createElement('p', { style: hintStyle }, '配置文件：' + store));
}
export function apply(ctx) {
    ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-team-model',
        order: 56,
        label: () => 'Team 模型',
    }, TeamModelSection)), 'dsh-team-model: settings section');
}
//# sourceMappingURL=index.js.map