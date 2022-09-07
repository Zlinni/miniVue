export function computed(getter){
    return new ComputedImpl(getter);
}
class ComputedImpl{
    constructor(getter){
        // 缓存值
        this._value = undefined;
        // 标识依赖是否更新
        this._dirty = true;
    }
    get value(){
        // 如果依赖更新了 重新计算
        if(this._dirty){
            // todo reCal
            this._value;
            this._dirty = false;
            this.effect = effect(getter,{
                lazy:true,
            })
        }
        debugger;
        return this._value;
    }
    set value(newValue){
        // todo
    }
}