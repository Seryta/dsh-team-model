/**
 * dsh-team-model —— Agent Teams 的模型路由插件。
 *
 * 两条规则：
 *  1. **Lead 跟随主对话**：Team Lead 就是主对话 agent 本身，路由由当前会话的模型选择
 *     决定（会话请求头 → 子智能体继承）。本插件**从不**改写 Lead 的模型，因此 Lead
 *     永远等于主对话配置。
 *  2. **非 Lead 的 teammate 共用一套配置**：默认继承 Lead（= 主对话）的路由；一旦在
 *     设置页配好 provider/model（可选 reasoningEffort / maxTokens），所有新建 teammate
 *     都改用这套配置，Lead 不受影响。
 *
 * 注入点：包一层 `ctx.subagents.startActivation`。团队 spawn 的可判别特征是
 * 「预留 childId + delivery:'parent'」（`subagent` 工具与 workflow 子代理都不预留
 * childId），再用 `ctx.agentTeams.membership(parent).role === 'lead'` 二次确认。
 * 注入的 agentOptions 会被写进子会话的 subagent descriptor，冷恢复时同样生效。
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-team-model";
/**
 * 核心服务必需。`webServer` 只在 Web 宿主存在，用 `ctx.inject(['webServer'], ...)`
 * 子级延迟挂载——headless 宿主照常注入路由逻辑（只是没有设置页 API）。
 */
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    provider: z<string, string, "defined">;
    model: z<string, string, "defined">;
    reasoningEffort: z<string, string, "defined">;
    maxTokens: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: z<string, string, "defined">;
    model: z<string, string, "defined">;
    reasoningEffort: z<string, string, "defined">;
    maxTokens: z<number, number, "defined">;
}>>, "plain">;
export interface Config {
    provider: string;
    model: string;
    reasoningEffort: string;
    maxTokens: number;
}
export declare function apply(ctx: Context, config: Config): void;
