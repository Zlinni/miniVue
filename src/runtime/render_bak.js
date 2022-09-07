import {
    isBoolean
} from "../utils";
import {
    ShapeFlags
} from "./vnode";

export function render(vnode, container) {
    mount(vnode, container);
}
// 挂载虚拟dom
function mount(vnode, container) {
    // 解析shapeFlag
    const {
        shapeFlag
    } = vnode;
    if (shapeFlag & ShapeFlags.ELEMENT) {
        mountElement(vnode, container);
    } else if (shapeFlag & ShapeFlags.TEXT) {
        mountTextNode(vnode, container);
    } else if (shapeFlag & ShapeFlags.FRAGMENT) {
        mountFragment(vnode, container);
    } else {
        mountComponent(vnode, container);
    }
}

function mountElement(vnode, container) {
    // 取出元素 挂载元素 挂载props children
    const {
        type,
        props,
    } = vnode;
    const el = document.createElement(type);
    // 将props挂载到el上
    mountProps(props, el);
    // 把节点挂载到el上
    mountChildren(vnode, el);
    container.appendChild(el);
    // 保存el
    vnode.el = el;
}

function mountTextNode(vnode, container) {
    const textNode = document.createTextNode(vnode.children);
    container.appendChild(textNode)
    vnode.el = el;
}

function mountFragment(vnode, container) {
    // 本身不渲染 直接把父节点挂载上去
    mountChildren(vnode, container);
}

function mountComponent(vnode, container) {

}

function mountChildren(vnode, container) {
    const {
        shapeFlag,
        children
    } = vnode;
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        mountTextNode(vnode, container);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 递归调用挂载
        children.forEach(child => {
            mount(child, container);
        });
    }
}
// {
//   class: 'a b',
//   style: {
//     color: 'red',
//     fontSize: '14px',
//   },
//   onClick: () => console.log('click'),
//   checked: '',
//   custom: false
// }
const domPropsRE = /[A-Z]|^(value|checked|selected|muted|disabled)$/;

function mountProps(props, el) {
    for (const key in props) {
        let value = props[key];
        switch (key) {
            // 如果是class 直接赋className
            case 'class':
                el.className = value;
                break;
                // 如果是style 遍历赋值value值
            case 'style':
                for (const styleName in value) {
                    el.style[styleName] = value[styleName];
                }
                break;
                // 如果是事件，正则匹配on开头，并将后面的转为小写单词 然后添加事件
                // 如果是别的属性，分类判断，不能统一设置attribute
            default:
                if (/^on[^a-z]/.test(key)) {
                    const eventName = key.slice(2).toLowerCase();
                    el.addEventListener(eventName, value);
                } else if (domPropsRE.test(key)) {
                    if (value === "" || isBoolean(key)) {
                        value = true;
                    }
                    el[key] = value;
                } else {
                    if (value == null || value === false) {
                        el.removeAttribute(key);
                    } else {
                        el.setAttribute(key, value);
                    }
                }
                break;
        }
    }
}