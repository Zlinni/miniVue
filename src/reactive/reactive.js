import { isObject,hasChanged,isArray } from "../utils";
import { track, trigger } from "./effect";
// 存储proxy对象
const proxyMap = new WeakMap();
export function reactive(target){
    // 类型判断是否需要做响应式代理
    if(!isObject(target)){
        return target
    }
    // 只能代理一次
    if(isReactive(target)){
        return target;
    }
    // 如果已经有这个代理对象 直接返回
    if(proxyMap.get(target)){
        return target;
    } 
    // proxy
    const proxy = new Proxy(target,{
        get(target,key,receiver){
            const res = Reflect.get(target,key,receiver);
            if(key === '__isReactive'){
                return true;
            }
            track(target,key);
            // 不需要对每层对象进行劫持，只对需要的对象进行。
            return isObject(res)?reactive(res):res;
        },
        set(target,key,value,receiver){
            let oldLength = target.length;
            const oldValue = target[key];
            const res = Reflect.set(target,key,value,receiver);
            if(hasChanged(oldValue,value)){
                if(isArray(target)&&hasChanged(oldLength,target.length)){
                    trigger(target,'length');
                }
                trigger(target,key);
            }
            return res;
        }
    })
    proxyMap.set(target,proxy);
    return proxy;
}
export function isReactive(target){
    return !!(target&&target.__isReactive);
}