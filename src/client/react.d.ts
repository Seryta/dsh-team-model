/**
 * 最小 React 类型声明：客户端 bundle 把 `react` 当外部共享模块（ModuleLoader 提供），
 * 构建期不需要安装 react 包。
 */
declare module 'react' {
  export interface MutableRefObject<T> {
    current: T
  }
  export function createElement(type: any, props?: any, ...children: any[]): any
  export function useRef<T>(initial: T): MutableRefObject<T>
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
}
