export function isObject(target) {
    return typeof target === 'object' && target !== null;
}
export function isArray(target) {
    return Array.isArray(target);
}
export function isFunction(target) {
    return typeof target === 'function';
}
export function isString(target) {
    return typeof target === 'string';
}
export function isNumber(target) {
    return typeof target === 'number';
}
export function isBoolean(target) {
    return typeof target === 'boolean';
}
export function hasChanged(oldValue, value) {
    return oldValue !== value && !(Number.isNaN(oldValue) && Number.isNaN(value));
}
export function camelize(str) {
    // my-first-class-
    // myFirstClass
    // 第一个参数是匹配到的字符，第二个参数是分组匹配的字符
    return str.replace(/-(\w)/g, (_, c) => {
        c ? c.toUpperCase() : ''
    })
}
export function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
}