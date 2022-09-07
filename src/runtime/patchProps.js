import { isBoolean } from "../utils";
export function patchProps(oldProps, newProps, el) {
    if (oldProps === newProps) {
        return;
    }

    oldProps = oldProps || {};
    newProps = newProps || {};

    // 移除旧属性有的，新属性没有的
    for (const key in oldProps) {
        // 当前属性是 'key' 则跳过
        if (key === 'key') {
            continue;
        }

        if (newProps[key] == null) {
            patchDomProp(oldProps[key], null, key, el);
        }
    }

    // 添加旧属性没有的，新属性有的
    for (const key in newProps) {
        if (key === 'key') {
            continue;
        }

        if (oldProps[key] !== newProps[key]) {
            patchDomProp(oldProps[key], newProps[key], key, el)
        }
    }
}
const domPropsRE = /[A-Z]|^(value|checked|selected|muted|disabled)$/;

function patchDomProp(prev, next, key, el) {
    switch (key) {
        // 如果是class 直接赋className
        case 'class':
            el.className = next;
            break;
            // 如果是style 遍历赋值value值
        case 'style':
            if(next==null){
                el.removeAttribute('style');
            }else{
                for (const styleName in next) {
                    el.style[styleName] = next[styleName];
                }
                if (prev) {
                    for (const styleName in prev) {
                        if (next[styleName] == null) {
                            el.style[styleName] = "";
                        }
                    }
                }
            }
            break;
            // 如果是事件，正则匹配on开头，并将后面的转为小写单词 然后添加事件
            // 如果是别的属性，分类判断，不能统一设置attribute
        default:
            if (/^on[^a-z]/.test(key)) {
                const eventName = key.slice(2).toLowerCase();
                if (prev) {
                    el.removeEventListener(eventName, prev)
                }
                if (next) {
                    el.addEventListener(eventName, next);
                }
            } else if (domPropsRE.test(key)) {
                if (next === "" || isBoolean(el[key])) {
                    next = true;
                }
                el[key] = next;
            } else {
                if (next == null || next === false) {
                    el.removeAttribute(key);
                } else {
                    el.setAttribute(key, next);
                }
            }
            break;
    }
}