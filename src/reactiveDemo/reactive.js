import {
    hasChanged,
    isArray,
    isObject
} from "../utils";
import {
    track,
    trigger
} from "./effect";

const proxyMap = new WeakMap()
export function reactive(target) {
    if (!isObject(target)) {
        return target;
    }
    if (isReactive(target)) {
        return target;
    }
    if (proxyMap.get(target)) {
        return target;
    }
    const proxy = new Proxy(target, {
        get(target, key, receiver) {
            const res = Reflect.get(target, key, receiver);
            if (key === '__isReative') {
                return true;
            }
            track(target, key);
            return res;
        },
        set(target, key, value, receiver) {
            const res = Reflect.set(target, key, value, receiver);
            let oldLength = target.length;
            let oldValue = target[key];
            if(hasChanged(oldValue,value)){
                if(isArray(target)&&hasChanged(oldLength,target.length)){
                    trigger(target,'length');
                }
                trigger(target, key);
            }
            return isObject(res)?reactive(res):res;
        }
    })
    proxyMap.set(target, proxy);
    return proxy;
}
export function isReactive(target) {
    return !!(target && target.__isReative)
}