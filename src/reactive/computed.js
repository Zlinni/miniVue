import {
    isFunction
} from "../utils";
import {
    effect,
    track,
    trigger
} from "./effect";

export function computed(getterOrOption) {
    let getter, setter;
    // 判断是否是函数
    if (isFunction(getterOrOption)) {
        getter = getterOrOption;
        setter = () => {
            console.warn('computed is readonly');
        }
    } else {
        getter = getterOrOption.get;
        setter = getterOrOption.set;
    }
    return new ComputedImpl(getter, setter);
}
class ComputedImpl {
    constructor(getter, setter) {
        // 保存setter
        this._setter = setter;
        // 缓存它的值
        this._value = undefined;
        // 标识依赖是否更新
        this._dirty = true;
        // 区别在于computed不会立刻执行 effect会
        // 所以要拓展一下effect
        this.effect = effect(getter, {
            lazy: true,
            // 还要将dirty变为true 所以要用一个调度机制
            // 让他去触发更新的时候不是立即去执行getter,而是去执行调度程序
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    trigger(this, 'value')
                }
            }
        });
    }
    get value() {
        // 如果依赖更新了就要重新计算
        if (this._dirty) {
            this._value = this.effect();
            this._dirty = false;
            track(this, 'value')
        }
        return this._value;
    }
    set value(newValue) {
        // todo 
        this._setter(newValue);
    }
}