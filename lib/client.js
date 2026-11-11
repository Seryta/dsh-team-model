window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-team-model",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/index.ts
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
		const inject = ["slots"];
		const BASE = "/team-model/api";
		async function request(path, init) {
			return await (await fetch(BASE + path, init)).json();
		}
		const rowStyle = {
			display: "flex",
			gap: "8px",
			alignItems: "center",
			flexWrap: "wrap",
			margin: "8px 0"
		};
		const labelStyle = {
			minWidth: "132px",
			opacity: .72,
			fontSize: "13px"
		};
		const inputStyle = {
			background: "transparent",
			color: "inherit",
			border: "1px solid rgba(127,127,127,0.4)",
			borderRadius: "6px",
			padding: "4px 8px",
			fontSize: "13px",
			minWidth: "200px"
		};
		const buttonStyle = {
			...inputStyle,
			cursor: "pointer",
			minWidth: "auto"
		};
		const hintStyle = {
			fontSize: "12px",
			opacity: .62,
			margin: "4px 0 0"
		};
		/** 设置页组件：提供商 / 模型 / 思考强度三选，全部可选。 */
		function TeamModelSection() {
			const [groups, setGroups] = react.useState([]);
			const [provider, setProvider] = react.useState("");
			const [model, setModel] = react.useState("");
			const [effort, setEffort] = react.useState("");
			const [status, setStatus] = react.useState("读取中…");
			const [busy, setBusy] = react.useState(false);
			const [store, setStore] = react.useState("");
			react.useEffect(() => {
				(async () => {
					try {
						const [catalog, state] = await Promise.all([request("/catalog"), request("/state")]);
						setGroups(catalog.groups ?? []);
						setStore(state.store ?? "");
						const route = state.route ?? null;
						if (route !== null) {
							setProvider(route.provider);
							setModel(route.model);
							setEffort(route.reasoningEffort ?? "");
							setStatus("当前：teammate 走独立配置");
						} else setStatus("当前：teammate 跟随主对话模型");
					} catch (error) {
						setStatus("读取配置失败：" + String(error));
					}
				})();
			}, []);
			const group = groups.find((entry) => entry.id === provider);
			const modelEntry = group?.models.find((entry) => entry.id === model);
			const efforts = modelEntry?.reasoning?.efforts ?? [];
			const incomplete = provider !== "" && model === "";
			async function save() {
				setBusy(true);
				try {
					const result = await request("/config", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							provider,
							model,
							reasoningEffort: effort
						})
					});
					if (result.ok !== true) throw new Error(result.error ?? "保存被拒绝");
					setStatus(provider === "" ? "已切换为跟随主对话模型" : "已保存：之后新建的 teammate 使用该模型");
				} catch (error) {
					setStatus("保存失败：" + String(error?.message ?? error));
				} finally {
					setBusy(false);
				}
			}
			function followMain() {
				setProvider("");
				setModel("");
				setEffort("");
				(async () => {
					setBusy(true);
					try {
						const result = await request("/config", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({
								provider: "",
								model: "",
								reasoningEffort: ""
							})
						});
						if (result.ok !== true) throw new Error(result.error ?? "保存被拒绝");
						setStatus("已切换为跟随主对话模型");
					} catch (error) {
						setStatus("保存失败：" + String(error?.message ?? error));
					} finally {
						setBusy(false);
					}
				})();
			}
			const effortOptions = efforts.map((level) => react.createElement("option", {
				key: level.id,
				value: level.id
			}, `${level.name} (${level.id})`));
			const savedEffortMissing = effort !== "" && efforts.every((level) => level.id !== effort);
			return react.createElement("div", { style: { padding: "4px 2px 12px" } }, react.createElement("div", { style: rowStyle }, react.createElement("span", { style: labelStyle }, "Lead（主对话）"), react.createElement("span", { style: { fontSize: "13px" } }, "跟随当前会话选择的模型 —— 不覆写")), react.createElement("div", { style: rowStyle }, react.createElement("span", { style: labelStyle }, "提供商"), react.createElement("select", {
				style: inputStyle,
				value: provider,
				disabled: busy,
				onChange: (event) => {
					setProvider(event.target.value);
					setModel("");
					setEffort("");
				}
			}, react.createElement("option", {
				key: "",
				value: ""
			}, "跟随主对话（不覆写）"), groups.map((entry) => react.createElement("option", {
				key: entry.id,
				value: entry.id
			}, entry.name === entry.id ? entry.id : `${entry.name} (${entry.id})`)))), react.createElement("div", { style: rowStyle }, react.createElement("span", { style: labelStyle }, "模型"), react.createElement("select", {
				style: inputStyle,
				value: model,
				disabled: busy || provider === "",
				onChange: (event) => {
					setModel(event.target.value);
					setEffort("");
				}
			}, react.createElement("option", {
				key: "",
				value: ""
			}, provider === "" ? "（先选提供商）" : "（选择模型）"), (group?.models ?? []).map((entry) => react.createElement("option", {
				key: entry.id,
				value: entry.id
			}, `${entry.name} (${entry.id})`)))), react.createElement("div", { style: rowStyle }, react.createElement("span", { style: labelStyle }, "思考强度"), react.createElement("select", {
				style: inputStyle,
				value: effort,
				disabled: busy || modelEntry === void 0 || efforts.length === 0 && effort === "",
				onChange: (event) => setEffort(event.target.value)
			}, react.createElement("option", {
				key: "",
				value: ""
			}, modelEntry === void 0 ? "（先选模型）" : "模型默认（不指定）"), effortOptions, savedEffortMissing ? react.createElement("option", {
				key: effort,
				value: effort
			}, `已保存：${effort}（当前模型未声明）`) : null)), react.createElement("div", { style: rowStyle }, react.createElement("button", {
				style: buttonStyle,
				disabled: busy || incomplete,
				onClick: () => void save()
			}, busy ? "保存中…" : "保存"), react.createElement("button", {
				style: buttonStyle,
				disabled: busy,
				onClick: followMain
			}, "跟随主对话"), react.createElement("span", { style: {
				fontSize: "12px",
				opacity: .8
			} }, status)), incomplete ? react.createElement("p", { style: {
				...hintStyle,
				opacity: .85
			} }, "选了提供商还要选模型才能保存；想不覆写就点「跟随主对话」。") : null, react.createElement("p", { style: hintStyle }, "覆盖范围：所有新建的非 Lead teammate（同一套配置）；Lead 永远等于主对话。已存在的 teammate 保持创建时的模型。"), store === "" ? null : react.createElement("p", { style: hintStyle }, "配置文件：" + store));
		}
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-team-model",
				order: 56,
				label: () => "Team 模型"
			}, TeamModelSection)), "dsh-team-model: settings section");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map