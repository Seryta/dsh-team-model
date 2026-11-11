type ClientContext = {
    slots: any;
    effect: (fn: () => () => void, label?: string) => void;
};
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
