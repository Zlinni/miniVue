/*
 * @Author: Zlinni 984328216@qq.com
 * @Date: 2022-05-22 20:04:29
 * @LastEditors: Zlinni 984328216@qq.com
 * @LastEditTime: 2022-06-13 10:47:12
 * @FilePath: \mini-vue\zMini-vue\src\reactive\effect.js
 * @Description: 
 * 
 * Copyright (c) 2022 by Zlinni 984328216@qq.com, All Rights Reserved. 
 */
// 记录当前正在执行的副作用函数
let activeEffect;
// 使用一个栈记录当前正在执行的副作用
const effectStack = [];
export function effect(fn,options={}) {
    const effectFn = () => {
        // 因为是用户输入的fn可能有错要包裹
        try {
            activeEffect = effectFn;
            effectStack.push(activeEffect);
            return fn();

        } finally {
            // 执行完函数之后还原当前副作用
            effectStack.pop();
            // 将外层副作用记录下来
            activeEffect = effectStack[effectStack.length-1]
        }
    }
    if(!options.lazy){
        effectFn();
    }
    // 挂载在副作用函数上
    effectFn.scheduler = options.scheduler;
    return effectFn;
}

// 收集依赖
// 存储我们的依赖
const targetMap = new WeakMap();
export function track(target,key) {
    // target是响应式对象 key是对象的属性
    if(!activeEffect){
        return;
    }
    let depsMap = targetMap.get(target);
    if(!depsMap){
        targetMap.set(target,(depsMap = new Map()))
    }
    let deps = depsMap.get(key);
    if(!deps){
        depsMap.set(key,(deps = new Set()));
    }
    deps.add(activeEffect);

}
// 触发更新
export function trigger(target,key) {
    const depsMap = targetMap.get(target);
    if(!depsMap){
        return;
    }
    const deps = depsMap.get(key);
    if(!deps){
        return;
    }
    deps.forEach(effectFn => {
        // 如果它有调度程序 优先执行 否则才去执行副作用函数本身
        if(effectFn.scheduler){
            effectFn.scheduler(effectFn)
        }else{
            effectFn();
        }
    });
}