---
title: 从零开始的mini-vue②--vnode篇
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/vnode.jpg
abbrlink: 2797606246
date: 2022-06-06 10:26:33
---

# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是虚拟 DOM 篇，是关于 Vue3 中响应式的篇章，包含了`vnode`,`render`的实现
{% endnote %}
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/虚拟DOM.png)

# vnode

本节中我们将会实现这样的例子(注意 html 中使用 `defer` 挂载 js，以及使用样式)

```javascript
import { render, h, Text } from "./runtime";

// 利用h生成vnode
const vnode = h(
  "div",
  {
    class: "a b",
    style: {
      border: "1px solid",
      fontSize: "14px",
    },
    onClick: () => console.log("click"),
    checked: "",
    custom: false,
  },
  [
    h("ul", null, [
      h("li", { style: { color: "red" } }, 1),
      h("li", null, 2),
      h("li", { style: { color: "blue" } }, 3),
      h("li", null, [h(Text, null, "hello world")]),
    ]),
  ]
);
// 将生成的vnode挂载到body上
render(vnode, document.body);

{
  /* <style>
  .a {
    background-color: aqua;
  }

  .b {
    padding: 20px;
  }
</style> */
}
```

那么我们在完成这个例子之前，还是有必要了解一下虚拟 DOM 的种类

# 虚拟 DOM 的种类

1. Element
   element 对应普通元素，原理是使用 `document.createElement()`创建的。`type` 指的是标签名，`props` 指的是元素属性，`children` 指子元素，可以为字符串或者数组，为字符串的时候代表只有一个文本节点。

```typescript
// 类型定义
{
  type:string,
  props:Object,
  children:string | VNode[]

}
// 举例
{
  type:'div',
  props:{class:'a'},
  children:'hello'
}
```

2. Text
   text 对应文本节点，原理是使用 `document.createTextNode()`创建的。`type` 定义为一个 `Symbol`，`props` 为空，`children` 为字符串，指具体的文本内容

```typescript
// 类型定义
{
  type:Symbol,
  props:null,
  children:string
}
```

3. Fragment
   Fragment 为一个不会真实渲染的节点。相当于 `template` 或 `react` 的 Fragment。`type` 为一个 `Symbol`，`props` 为空，`children` 为一个数组，表示子节点。最后渲染的时候会挂载到 Fragment 的父节点上面。

```typescript
// 类型定义
{
  type:Symbol,
  props:null,
  children:[]
}
```

4. Component
   Component 是组件，组件有自己的一套特殊的渲染方法，但组件最终的产物也是上面三种 VNode 的集合。组件的 `type`，就是定义组件的对象，`props` 即是外部传入组件的 `props` 数据，`children` 即是组件的 `slot`(不准备实现 `slot` 跳过)

```typescript
// 类型定义
{
  type:Object,
  props:Object,
  children:null
}

// 举例
{
  type:{
    template:`{{msg}}{{name}}`,
    props:['name'],
    setup(){
      return {
        msg: 'hello'
      }
    }
  },
  props:{
    name:'world'
  }
}
```

# ShapeFlags 快速标识 VNode 的类型

`ShapeFlags` 是一组标记，用于快速辨识 VNode 的类型

## 复习位运算

```javascript
// 按位与运算 相同的不变 不同的为0
0 0 1 0 0 0 1 1
0 0 1 0 1 1 1 1
&
0 0 1 0 0 0 1 1
// 按位或运算 相同的不变 不同的为1
0 0 1 0 0 0 1 1
0 0 1 0 1 1 1 1
|
0 0 1 0 1 1 1 1
```

## ShapeFlags 的生成

```javascript
const ShapeFlags = {
  ELEMENT: 1, // 00000001
  TEXT: 1 << 1, // 00000010
  FRAGMENT: 1 << 2, // 00000100
  COMPONENT: 1 << 3, // 00001000
  TEXT_CHILDREN: 1 << 4, // 00010000
  ARRAY_CHILDREN: 1 << 5, // 00100000
  CHILDREN: (1 << 4) | (1 << 5), //00110000
};
```

可以发现他利用了二进制位运算`<<`和`|`生成，使用的时候用`&`判断，如：

```javascript
if (flag & ShapeFlags.ELEMENT)
```

再例如，一个值为 33 的 flag，它的二进制值为 00100001，那么它：

```javascript
let flag = 33;
flag & ShapeFlags.ELEMENT; // true
flag & ShapeFlags.ARRAY_CHILDREN; // true
flag & ShapeFlags.CHILDREN; // true
```

它的生成还可以用：

```javascript
let flag = ShapeFlags.ELEMENT | ShapeFlags.ARRAY_CHILDREN;
```

# VNode 初步形态

```javascript
{
  type,
  props,
  children,
  shapeFlag,
}
```

# h 函数--生成 VNode

`h` 函数的用途就是生成 VNode。
它接收三个参数：`type`, `props`, `children`, 返回一个 VNode

```javascript
import { isArray, isNumber, isString } from "../utils";

export const ShapeFlags = {
  ELEMENT: 1, // 00000001
  TEXT: 1 << 1, // 00000010
  FRAGMENT: 1 << 2, // 00000100
  COMPONENT: 1 << 3, // 00001000
  TEXT_CHILDREN: 1 << 4, // 00010000
  ARRAY_CHILDREN: 1 << 5, // 00100000
  CHILDREN: (1 << 4) | (1 << 5), //00110000
};

export const Text = Symbol("Text");
export const Fragment = Symbol("Fragment");

/**
 *
 * @param {String | Object | Text | Fragment} type
 * @param {Object | null} props
 * @param {String | Number | Array | null} children
 * @returns VNode
 */
export function h(type, props, children) {
  // 判断shapeFlag得到它的类型
  let shapeFlag = 0;
  if (isString(type)) {
    shapeFlag = ShapeFlags.ELEMENT;
  } else if (type === Text) {
    shapeFlag = ShapeFlags.TEXT;
  } else if (type === Fragment) {
    shapeFlag = ShapeFlags.FRAGMENT;
  } else {
    shapeFlag = ShapeFlags.COMPONENT;
  }
  // 再判断children
  if (isString(children) || isNumber(children)) {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    // 数字转字符串
    children = children.toString();
  } else if (isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }
  return {
    type,
    props,
    children,
    shapeFlag,
  };
}
```

# render 挂载虚拟 DOM

这一步我们要将 `vnode` 中的 shapeFlag 解析并判断节点类型，根据不同的节点类型进行不同的挂载操作

`render` 需要接收两个参数，一个是节点 `vnode`，一个是挂载的容器 `container`

```javascript
import { isBoolean } from "../utils";
import { ShapeFlags } from "./vnode";

export function render(vnode, container) {
  mount(vnode, container);
}
// 挂载虚拟dom
function mount(vnode, container) {
  // 解析shapeFlag
  const { shapeFlag } = vnode;
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
```

综上所述，我们还要操作四种类型的挂载，分别是

1. 元素挂载 `mountElement`
2. 文本节点挂载 `mountTextNode`
3. 虚拟节点挂载 `mountFragment`
4. 组件挂载 `mountComponent`

## mountElement

对于我们的 element 类型，我们也知道了他的底层是靠 `document.createElement` 方法来生成元素的，生成之后我们需要将 `props` 挂载到该元素上，再将子节点挂载到元素上，然后挂载到容器内。

综上所述分为以下几个步骤：

1. 生成元素 el
2. 挂载 `props` 到 el `mountProps`
3. 挂载子节点到 el `mountChildren`
4. 挂载 el 到 `container`

代码

```javascript
function mountElement(vnode, container) {
  // 取出元素 挂载元素 挂载props children
  const { type, props } = vnode;
  const el = document.createElement(type);
  // 将props挂载到el上
  mountProps(props, el);
  // 把节点挂载到el上
  mountChildren(vnode, el);
  container.appendChild(el);
}
```

对于 `mountProps` 和 `mountChildren`，我们先来做后者

### mountChildren

前面介绍 element 的时候我们讲到：

{% note primary flat %}
children 指子元素，可以为字符串或者数组，为字符串的时候代表只有一个文本节点。
{% endnote %}

所以我们就要对子元素的两种情况进行判断并挂载

`mountChildren` 也是接收两个参数，一个是节点 `vnode`，一个是容器 `container`

对于数组的操作我们递归调用挂载即可。对于字符串我们还需要编写挂载文本节点的情况，这个下面会讲到文本节点所以先掠过

```javascript
function mountChildren(vnode, container) {
  const { shapeFlag, children } = vnode;
  // 文本节点
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, container);
    // 数组的时候
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 递归调用挂载
    children.forEach((child) => {
      mount(child, container);
    });
  }
}
```

### mountProps

`mountProps` 接收两个参数，一个是 `props` 渲染器，一个是生成的元素 `el`

对于我们的 `props` 有以下几个种类

```javascript
{
  class: 'a b',
  style: {
    color: 'red',
    fontSize: '14px',
  },
  onClick: () => console.log('click'),
  checked: '',
  custom: false
}
```

首先要分析一下我们有几种情况

1. `class` 字符串
2. `style` 对象
3. `event` 事件
4. 其他属性

那么来按点分析：

#### class 字符串

如果是 `class`，直接赋 `className` 即可。

```javascript
case 'class':
    el.className = value;
    break;
```

#### style 对象

如果是 `style`，因为他是一个对象，所以我们要遍历这个 `style`，把对应的值赋给`el.style[styleName]`

```javascript
// 如果是style 遍历赋值value值
case "style":
  for (const styleName in value) {
    el.style[styleName] = value[styleName];
  }
  break;
```

#### event 事件

如果是事件，这里偷懒一下，只触发以 `on` 开头的事件，利用正则我们很快可以匹配上，再把 `Click` 变小写，然后利用`el.addEventListener(eventName, value);`这个 api 即可。

```javascript
if (/^on[^a-z]/.test(key)) {
  const eventName = key.slice(2).toLowerCase();
  el.addEventListener(eventName, value);
}
```

#### 其他属性

如果是其他属性，这时候我们就要注意了，虽然一般情况下我们用`setAttribute`这个 `api`，就可以帮助我们设置属性以及属性对应的值，但是如果我们的属性是`value|checked|selected|muted|disabled`这几种，那么我们设置`true|false`的时候，他会被转换成字符串导致赋值失效。所以，我们要正则匹配这种情况，单独给他赋值这个属性`el[key] = value;`

另外不仅如此,也可能存在没有赋值的情况，比如我只想让多选框选中，那么就给他`checked`，我们需要将他处理成 true

```javascript
if (domPropsRE.test(key)) {
  if (value === "") {
    value = true;
  }
  el[key] = value;
}
```

除此之外，我们设置成 `false` 或者 `null` 的时候，代表我们希望移除掉这个属性，所以要利用到 `removeAttribute`，最后的情况就是 `setAttribute` 了

```javascript
if (value == null || value === false) {
  el.removeAttribute(key);
} else {
  el.setAttribute(key, value);
}
```

#### 完整代码

完整代码

```javascript
const domPropsRE = /[A-Z]|^(value|checked|selected|muted|disabled)$/;

function mountProps(props, el) {
  for (const key in props) {
    let value = props[key];
    switch (key) {
      // 如果是class 直接赋className
      case "class":
        el.className = value;
        break;
      // 如果是style 遍历赋值value值
      case "style":
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
          if (value === "" && isBoolean(el[key])) {
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
```

{% note primary flat %}
至此处理完了 `mountElement`，我们知道了 `element` 中对于子元素的处理为数组遍历和文本挂载，对于 `props` 的处理按四种大情况讨论，其中对于其他属性我们还要按照一般的属性和特殊的几种属性讨论，以及赋值的情况下给移除还是挂载。下面进入 `mountTextNode` 环节
{% endnote %}

## mountTextNode

{% note primary flat %}
上面我们遗留了一个问题，就是关于子元素的文本节点处理的问题。
{% endnote %}

其实 `mountTextNode` 原理就是 `document.createTextNode()`，具体传入的内容是 `vnode`.`children`,因为我们前面讲到,`TEXT` 节点他的孩子就是具体的文本内容。

```typescript
{
  type:Symbol,
  props:null,
  children:string
}
```

完整代码

```javascript
function mountTextNode(vnode, container) {
  const textNode = document.createTextNode(vnode.children);
  container.appendChild(textNode);
  vnode.el = el;
}
```

## mountFragment

他本身不渲染，直接把父节点挂载上去

```javascript
function mountFragment(vnode, container) {
  // 本身不渲染 直接把父节点挂载上去
  mountChildren(vnode, container);
}
```

## mountComponent

暂时不写

{% note primary flat %}
至此我们的挂载虚拟 DOM 暂时完成，下面看我们的 `patch` 部分
{% endnote %}


# 总结

这个部分的篇幅有点长，我们学到了何为vnode，然后初步的编写一个虚拟 DOM 并生成vnode然后挂载并渲染，下节进行`patch`的学习。
