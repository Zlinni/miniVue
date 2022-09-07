let activeEffect;
const effectStack = [];
export function effect(fn,option={}){
    const effectFn = ()=>{
        try{
            activeEffect = effectFn;
            effectStack.push(activeEffect);
            return fn();
        }
        finally{
            effectStack.pop();
            activeEffect = effectStack[effectStack.length-1];
        }
    }
    if(!option.lazy){
        effectFn();
    }
    return effectFn;
}

const targetMap = new WeakMap();
// track的作用是收集依赖
export function track(target,key){
    // 如果不是正在执行的依赖 直接返回
    if(!activeEffect){
        return;
    }
    // 构建depsMap
    let depsMap = targetMap.get(target);
    if(!depsMap){
        targetMap.set(target,(depsMap=new Map()))
    }
    // 构建deps
    let deps = depsMap.get(key);
    if(!deps){
        depsMap.set(key,(deps=new Set()));
    }
    // 添加依赖
    deps.add(activeEffect);
}
// trigger用于触发更新
export function trigger(target,key){
    // 如果它有副作用,才执行
    const depsMap = targetMap.get(target);
    if(!depsMap){
        return;
    }
    const deps = depsMap.get(key);
    if(!deps){
        return;
    }
    deps.forEach(effectFn => {
        
        effectFn()
    });
}