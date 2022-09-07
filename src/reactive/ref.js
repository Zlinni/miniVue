import {
    hasChanged,
    isObject
} from "../utils";
import {
    reactive
} from "./reactive";
import {
    track,
    trigger
} from "./effect"

export function ref(value) {
    if (isRef(value)) {
        return value;
    }
    return new RefImpl(value);
}

export function isRef(value) {
    return !!(value && value.__isRef)
}

class RefImpl {
    constructor(value) {
        this.__isRef = true;
        this._value = convert(value);
    }
    get value() {
        track(this, 'value');
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(newValue, this._value)) {
            this._value = convert(newValue);
            // trigger后置 因为值改变了才切换
            trigger(this, 'value');
        }
    }
}

function convert(value) {
    return isObject(value) ? reactive(value) : value;
}