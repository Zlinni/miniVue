---
title: 从零开始的mini-vue③--patch篇
abbrlink: 2046694271
date: 2022-06-10 16:15:01
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/patch.jpg
---
# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是patch 篇，是关于 Vue3 中 patch 的基本理解和实践。
{% endnote %}
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/patch222.png)

# patch的介绍

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/patch.png)

`patch` 是对比新旧节点的算法，当新节点不存在的时候，执行卸载操作，当新节点存在的时候，进行对比

卸载操作需要判断对应节点的类型，如果是组件执行组件的卸载，如果是 `Fragment` 执行 `Fragment` 的卸载，最后到 `Text` 和 `Element` 执行 `removeChild`

`patch` 操作需要判断新旧节点的类型是否相同，不同的话就要卸载旧的节点将原有的节点树完全卸载掉。

然后再判断新节点
新节点是否是组件，如果是则进行 `processComponent`；

新节点如果是 `Text` 类型，执行 `processText`。之后再来判断旧节点是否存在，如果存在说明之前已经创建过旧的文本内容了，直接复用这个文本节点，更新他的 `textContent`，如果不存在旧节点，直接使用 `mountTextNode` 挂载文本节点

新节点如果是 `Fragment` 类型，就执行 `processFragment`，如果此时旧节点不存在，直接使用 `mountChildren`，如果旧节点存在就要进行 `diff`

新节点最后就判断为 `Element` 类型，执行 `processElement`。之后来判断旧节点是否存在，如果不存在，直接使用 `mountElement` 对新节点进行挂载。如果存在，则要对他进行 `diff` 操作了。

因为此时新旧节点的 `type` 一样，就直接复用 `type`，只要对 `props` 和 `children` 进行 `diff`

分析完了之后就开始准备写新的 `render` 函数了

# render

我们之前的 `render` 是挂载了一个节点，怎么才能产生新旧节点呢？

实际上我们只要将 `vnode` 挂载在 `container` 上面，下次进入的时候获取 `container` 上面的 `vnode`，此时这个 `vnode` 就是旧节点

```javascript
export function render(vnode, container) {
  const prevNode = container._vnode;
  container._vnode = vnode;
}
```

接下来进行判断了，我们首先判断新节点存不存在。

```javascript
export function render(vnode, container) {
  const prevNode = container._vnode;
  if (!vnode) {
    if (prevNode) {
      unmount(prevNode);
    }
  } else {
    patch(prevNode, vnode, container);
  }
  container._vnode = vnode;
}
```

接下来就要编写 `unmount` 和 `patch`

## unmount

前面的情况就是利用 shapeflag 判断组件的卸载或 `fragment` 的卸载。

```javascript
function unmount(vnode){
    const {shapeFlag,el} = vnode;
    if(shapeFlag&ShapeFlags.COMPONENT){
        unmountComponent(vnode)
    }else if(shapeFlag&ShapeFlags.FRAGMENT){
        unmountFragment(vnode)
    }else{
      ...?
    }
}
```

但我们发现最后一种情况：对 `Text` 或 `Element` 进行 `removeChild` 的时候，没有获取到具体的 el，所以我们要从 `vnode` 里面拿 el，也就是要在 `vnode` 的返回值里面添加一个 el

```javascript
return {
  type,
  props,
  children,
  shapeFlag,
  el: null,
};
```

且在挂载 `element` 和 `textnode` 之后需要将 el 挂载到 `vnode`

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
  // 保存el
  vnode.el = el;
}

function mountTextNode(vnode, container) {
  const textNode = document.createTextNode(vnode.children);
  container.appendChild(textNode);
  vnode.el = el;
}
```

所以现在最后一种情况应该这样写了

```javascript
function unmount(vnode) {
  const { shapeFlag, el } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    unmountFragment(vnode);
  } else {
    // 其次是Text或者Element 但要拿到child节点
    // 所以要在vnode里面初始化一个el
    el.parentNode.removeChild(el);
  }
}
```

## patch

接下来是实现 `patch` 的部分，要通过他判断新旧节点的类型是否相同，设置一个函数。然后分情况。

```javascript
function patch(prevVNode, vnode, container) {
  if (prevVNode && !isSameVNode(prevVNode, vnode)) {
    unmount(prevVNode);
    // 注意卸载之后要将节点设置为null
    prevVNode = null;
  }
  const { shapeFlag } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(prevVNode, vnode, container);
  } else if (shapeFlag & ShapeFlags.TEXT) {
    processText(prevVNode, vnode, container);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    processFragment(prevVNode, vnode, container);
  } else {
    processElement(prevVNode, vnode, container);
  }
}
function isSameVNode(prevVNode, vnode) {
  return prevVNode.type === vnode.type;
}
```

之后要处理剩下的四个函数 `processComponent，processText，processFragment，processElement`

### processText

存在旧节点的时候，复用旧节点的 `textContent`。否则执行 `mountTextNode`，这个前面也写过了。直接 cv 即可。

```javascript
function processText(prevVNode, vnode, container) {
  if (prevVNode) {
    vnode.el = prevVNode.el;
    prevVNode.el.textContent = vnode.children;
  } else {
    mountTextNode(vnode, container);
  }
}
function mountTextNode(vnode, container) {
  const textNode = document.createTextNode(vnode.children);
  container.appendChild(textNode);
  vnode.el = el;
}
```

### processElement

对于存在旧节点的情况下调用 `patchElement` 进行 `diff` 比较，不存在的情况则调用原先写过的 `mountElement` 进行挂载

```javascript
function processElement(prevVNode, vnode, container) {
  if (prevVNode) {
    patchElement(prevVNode, vnode, container);
  } else {
    mountElement(vnode, container);
  }
}
```

这里需要注意的一点是 `mountChildren` 中我们之前是没有实现 `mount` 的，其实在这里用 `patch` 实现即可。

```javascript
function mountChildren(vnode, container) {
  const { shapeFlag, children } = vnode;
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, container);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 递归调用挂载
    children.forEach((child) => {
      patch(null, child, container);
    });
  }
}
```

除此之外就是 `patchElement`，因为此时新旧节点的 `type` 都是一样的，所以将旧节点的 el 赋值给新节点的 el，然后对比它们之间的 `props` 和 `children` 的异同。

#### patchProps

其中包含了两个函数一个是 `patchProps` 一个是 `patchChildren`

对于 `patchProps`，回顾一下 `props` 的内容,他是一个对象里面有很多属性。

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

所以我们对于新旧节点的 `props`，需要取出对应的 `value` 值，对比是否相同，如果相同我们才去进行重新赋值。并且我们还要遍历旧属性，移除旧属性中有的，新属性中没有的。遍历新属性，添加旧属性没有的新属性有的。

```javascript
function patchProps(oldProps, newProps, el) {
  if (oldProps === newProps) {
    return;
  }
  // 防止传过来的props是空 注意这里没有用到es6赋默认值的写法是因为他有可能传递的是null，es6默认值只能处理undefined的情况
  oldProps = oldProps || {};
  newProps = newProps || {};

  // 移除旧属性有的，新属性没有的
  for (const key in oldProps) {
    // 当前属性是 'key' 则跳过
    if (key === "key") {
      continue;
    }

    if (newProps[key] == null) {
      patchDomProp(oldProps[key], null, key, el);
    }
  }

  // 添加旧属性没有的，新属性有的
  for (const key in newProps) {
    if (key === "key") {
      continue;
    }

    if (oldProps[key] !== newProps[key]) {
      patchDomProp(oldProps[key], newProps[key], key, el);
    }
  }
}
```

##### patchDomProp

`patchDomProp` 这一步操作和我们之前写的 `mountProps` 有点类似。不过有几个细节要注意：

如果 `next` 是 `false` 或者是 `null` 的话，他就会变成字符串，而不是去掉，我们希望的是去掉。所以要写`el.className = next || ''`

如果新旧属性中的 `style` 有不一致的，我们添加新的 `styleName`，移除不需要的 `styleName`。

```javascript
// next为空直接移除
if (next == null) {
  el.removeAttribute("style");
} else {
  // 我们添加新的 styleName
  for (const styleName in next) {
    el.style[styleName] = next[styleName];
  }
  // 移除不需要的 `styleName`。
  if (prev) {
    for (const styleName in prev) {
      if (next[styleName] == null) {
        el.style[styleName] = "";
      }
    }
  }
}
```

如果事件中存在旧事件，移除旧事件，如果存在新事件，添加新事件。

```javascript
if (/^on[^a-z]/.test(key)) {
  const eventName = key.slice(2).toLowerCase();
  // 移除旧事件
  if (prev) {
    el.removeEventListener(eventName, prev);
  }
  // 添加新事件
  if (next) {
    el.addEventListener(eventName, next);
  }
}
```

完整代码

```javascript
switch (key) {
  // 如果是class 直接赋className
  case "class":
    el.className = next;
    break;
  // 如果是style 遍历赋值value值
  case "style":
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
    break;
  // 如果是事件，正则匹配on开头，并将后面的转为小写单词 然后添加事件
  // 如果是别的属性，分类判断，不能统一设置attribute
  default:
    if (/^on[^a-z]/.test(key)) {
      const eventName = key.slice(2).toLowerCase();
      if (prev) {
        el.removeEventListener(eventName, prev);
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
```

注意此时我们已经可以利用 `patchProps` 取代 `mountProps` 了

```javascript
function mountElement(vnode, container) {
  // 取出元素 挂载元素 挂载props children
  const { type, props } = vnode;
  const el = document.createElement(type);
  // 将props挂载到el上
  // mountProps(props, el);
  if (props) {
    patchProps(null, props, el);
  }
  // 把节点挂载到el上
  mountChildren(vnode, el);
  container.appendChild(el);
  // 保存el
  vnode.el = el;
}
```

#### patchChildren

我们重新修改一下 `mountChildren`，让他的职责更加单一

```javascript
function mountElement(vnode, container) {
  // 取出元素 挂载元素 挂载props children
  const { type, props, shapeFlag, children } = vnode;
  const el = document.createElement(type);
  // 将props挂载到el上
  // mountProps(props, el);
  patchProps(null, props, el);
  // 把节点挂载到el上
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, el);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el);
  }
  container.appendChild(el);
  // 保存el
  vnode.el = el;
}

function mountChildren(children, container) {
  // 递归调用挂载
  children.forEach((child) => {
    patch(null, child, container);
  });
}
```

然后开始写 `patchChildren`，这一部分中，我们需要对九种情况进行判断
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/patchChildren.jpg)

简单写一下模板大致如下:

```javascript
function patchChildren(prevVNode, vnode, container) {
  const { shapeFlag: prevShapeFlag, children: c1 } = prevVNode;
  const { shapeFlag, children: c2 } = vnode;
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = c2;
    } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1);
      container.textContent = c2;
    } else {
      container.textContent = c2;
    }
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = "";
      mountChildren(c2, container);
    } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      patchArrayChildren(c1, c2, container);
    } else {
      mountChildren(c2, container);
    }
  } else {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = "";
    } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1);
    }
  }
}
```

此时剩下的 `unmountChildren` 和 `patchArrayChildren` 两个函数暂未实现，但是我们发现可以对这个模板做一个合并

```javascript
if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    unmountChildren(c1);
  }
  if (c1 !== c2) {
    container.textContent = c2;
  }
}
```

下面一段是 vue 源码的合并结构，虽然简介但是还是分情况比较好理解

```javascript
if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    unmountChildren(c1);
  }
  if (c2 !== c1) {
    container.textContent = c2;
  }
} else {
  // c2 is array or null

  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // c1 was array

    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // c2 is array
      // patchArrayChildren()
    } else {
      // c2 is null
      unmountChildren(c1);
    }
  } else {
    // c1 was text or null

    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = "";
    }
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(c2, container, anchor);
    }
  }
}
```

之后我们编写 `unmountChildren`，其实他也就是遍历 `children` 然后卸载

```javascript
function unmountChildren(children) {
  children.forEach((child) => {
    unmount(child);
  });
}
```

然后就到了 `patchArrayChildren`，这个部分

##### patchArrayChildren

举个例子，我们看他如何实现

```javascript
const n1 = h("ul", null, [
  h("li", null, "a"),
  h("li", null, "b"),
  h("li", null, "c"),
]);

const n2 = h("ul", null, [
  h("li", null, "d"),
  h("li", null, "e"),
  h("li", null, "f"),
]);
```

> c1: a b c
> c2: d e f

> c1: a b c
> c2: d e f g h

> c1: a b c g h
> c2: d e f

对比新旧孩子，如果长度相同则执行 `patch` 对比，如果新孩子比旧孩子长则挂载新孩子多出来的部分，如果旧孩子比新孩子长则删除旧孩子多出来的部分

```javascript
function patchArrayChildren(c1, c2, container) {
  const oldLength = c1.length;
  const newLength = c2.length;
  const commonLength = Math.min(oldLength, newLength);
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container);
  }
  if (oldLength > newLength) {
    unmountChildren(c1.slice(commonLength));
  } else if (oldLength < newLength) {
    mountChildren(c2.slice(commonLength), container);
  }
}
```

接下来就是处理 `processFragment` 了

### processFragment

旧节点存在的时候对比新旧的孩子，不存在时候直接挂载新节点的孩子。

```javascript
function processFragment(prevVNode, vnode, container) {
  if (prevVNode) {
    patchChildren(prevVNode, vnode, container);
  } else {
    mountChildren(vnode.children, container);
  }
}
```

先来个例子

```javascript
import { render, Fragment, h } from "./runtime";

render(
  h("ul", null, [
    h("li", null, "first"),
    h(Fragment, null, []),
    h("li", null, "last"),
  ]),
  document.body
);
setTimeout(() => {
  render(
    h("ul", null, [
      h("li", null, "first"),
      h(Fragment, null, [h("li", null, "middle")]),
      h("li", null, "last"),
    ]),
    document.body
  );
}, 2000);
```

我们跑这个例子之前，知道这个 `Fragment` 节点应该是 2s 加入到 first 和 last 中间的，而实际的结果却是他到了最后面。

我们先分析一下原因：首先 `patch` 新旧节点，它们类型是相同的，是 `Fragment`，则进入 `processFragment`。此时旧节点不存在，执行 `mountChildren`，然后执行 `patch`，传的值是`(null, child, container)`，到 `patch`，此时孩子是一个元素节点，所以执行 `processElement`。之后 `mountElement`。

这一步就是问题所在了，`mountElement` 中，我们的 el 是直接挂载到 `container` 中的，也就是`container.appendChild(el);`代码。所以他被加到了最后面

为了解决这个问题我们要使用 `anchor` 属性。

#### Anchor

`anchor` 属性和 el 类似，因为 `Fragment` 节点之前挂载到的是容器，所以我们不知道应该在何处插入或者删除我们的 `Fragment` 节点，就要使用 el 和 `anchor` 生成节点然后就可以在这两个节点中间插入 `Fragment`。

所以我们要在 `vnode` 返回值里面添加 `anchor`

```javascript
return {
  type,
  props,
  children,
  shapeFlag,
  el: null,
  anchor: null,
};
```

然后重新写一下 `processFragment`

```javascript
function processFragment(prevVNode, vnode, container) {
  // 如果旧节点的el存在就复用，anchor也是一样
  const fragmentStartAnchor = (vnode.el = prevVNode
    ? prevVNode.el
    : document.createTextNode(""));
  const fragmentEndAnchor = (vnode.anchor = prevVNode
    ? prevVNode.anchor
    : document.createTextNode(""));

  if (prevVNode) {
    patchChildren(prevVNode, vnode, container);
  } else {
    container.appendChild(fragmentStartAnchor);
    container.appendChild(fragmentEndAnchor);
    // 传递anchor
    mountChildren(vnode.children, container, fragmentEndAnchor);
  }
}
```

这样的话，就需要在后续的地方增加 `anchor` 属性了

```javascript
function mountChildren(children, container,anchor) {
  // 递归调用挂载
  children.forEach((child) => {
    patch(null, child, container,anchor);
  });
}
function patch(prevVNode, vnode, container,anchor) {
  if (prevVNode && !isSameVNode(prevVNode,vnode)) {
    unmount(prevVNode);
    prevVNode = null;
  }
  const {
    shapeFlag
  } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(prevVNode, vnode, container,anchor);
  } else if (shapeFlag & ShapeFlags.TEXT) {
    processText(prevVNode, vnode, container,anchor);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    processFragment(prevVNode, vnode, container,anchor);
  } else {
    processElement(prevVNode, vnode, container,anchor);
  }
}
function processElement(prevVNode, vnode, container,anchor) {
  if (prevVNode) {
    patchElement(prevVNode, vnode);
  } else {
    mountElement(vnode, container,anchor);
  }
}
function mountElement(vnode, container,anchor) {
  // 取出元素 挂载元素 挂载props children
  const {
    type,
    props,
    shapeFlag,
    children
  } = vnode;
  const el = document.createElement(type);
  // 将props挂载到el上
  // mountProps(props, el);
  patchProps(null, props, el);
  // 把节点挂载到el上
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, el);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el);
  }
  // container.appendChild(el);
  container.insertBefore(el,anchor);
  // 保存el
  vnode.el = el;
}
function processText(prevVNode, vnode, container,anchor) {
  if (prevVNode) {
    vnode.el = prevVNode.el;
    prevVNode.el.textContent = vnode.children;
  } else {
    mountTextNode(vnode, container,anchor);
  }
}
function mountTextNode(vnode, container,anchor) {
  const textNode = document.createTextNode(vnode.children);
  // container.appendChild(textNode);
  container.insertBefore(textNode,anchor);
  vnode.el = textNode;
}
function processFragment(prevVNode, vnode, container,anchor) {
  const fragmentStartAnchor = vnode.el = prevVNode ? prevVNode.el : document.createTextNode('');
  const fragmentEndAnchor = vnode.anchor = prevVNode ? prevVNode.anchor : document.createTextNode('');

  if (prevVNode) {
    // 用fragmentEndAnchor作为他的anchor
    patchChildren(prevVNode, vnode, container,fragmentEndAnchor);
  } else {
    // 此处也要insertuu
    container.insertBefore(fragmentStartAnchor,anchor)
    container.insertBefore(fragmentEndAnchor,anchor)
    mountChildren(vnode.children, container,fragmentEndAnchor);
  }
}
...
```

总之在需要 `anchor` 的节点都需要添加 `anchor` 属性，并且最后的时候需要替换 `appendChild` 为 `insertBefore`

之后我们编写遗留的 `unmountFragment`，这个函数本身我们可以用 `unmountChildren` 的形式来写，但是现在由于添加了 el 和 `anchor` 两个文本节点，所以我们要换种方式了。

思路大概就是将他们循环删除

```javascript
function unmountFragment(vnode) {
  let { el: cur, anchor: end } = vnode;
  const { parentNode } = cur;
  while (cur != end) {
    let next = cur.nextSibling;
    parentNode.removeChild(cur);
    cur = next;
  }
  parentNode.removeChild(end);
}
```

此时回去测试我们的用例，发现可以成功 `patch` 了。

最后还有一个小问题，就是关于 `patchArrayChildren` 里面的。我们看这么个例子

> h1, h1, h1
> h1, h2, h1

例如，对上面这个例子进行 `patchChildren` 第一次 `patch` 时，`n2.el = n1.el`，没有创建元素，`anchor` 没有用。 第二次 `patch` 时，先删除了 n1，对 n2 进行创建，执行 `insertBefore`，`anchor` 就需要设置为 `n1` 的下一个兄弟节点。

```javascript
function patch(prevVNode, vnode, container,anchor) {
  if (prevVNode && !isSameVNode(prevVNode,vnode)) {
    anchor = prevVNode.el.nextSibling;
    unmount(prevVNode);
    prevVNode = null;
  }
  ...
}
```

而如果是

> n1, "" n1 "",
> n1 n1, n2, n1

如果 `n1` 是 `Fragment`，那么 `anchor` 应该设置为 `n1` 的 `anchor` 的下一个兄弟节点。

所以不妨将两个情况合并为以下的代码

```javascript
anchor = (prevVNode.anchor || prevVNode.el).nextSibling;
```

# 总结
在本节里，我们学习了patch算法简单的对新旧节点进行比对，然后根据对应的情况去挂载新节点或删除旧节点，后面又重新编写了render方法来对我们之前的操作做一些补充和修改。下节将进行核心diff算法的学习。