---
title: 从零开始的mini-vue⑥--component篇
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/component.jpg
abbrlink: 1033180007
date: 2022-06-12 10:21:17
---

# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是 Component 篇，是关于 Vue3 中组件的深入讨论。
{% endnote %}
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/componentImage.png)

# 组件是什么

{% note primary flat %}
从开发者的视角来看，组件分为状态组件和函数组件，vue 其实也有函数式组件，但它和状态组件，从实现上来讲几乎没有多大区别，因此我们只考虑状态组件，以下所讲的组件都是状态组件
{% endnote %}

React 的组件示例

```javascript
class Counter extends React.Component {
  state = {
    count: 0,
  };
  add = () => {
    this.setState({
      count: this.state.count + 1,
    });
  };
  render() {
    const { count } = this.state;
    return (
      <>
        <div>{count}</div>
        <button onClick={this.add}>add</button>
      </>
    );
  }
}
```

Vue3 的组件示例（optional）（渲染函数）

```javascript
createApp({
  data() {
    return {
      count: 0,
    };
  },
  methods: {
    add() {
      this.count++;
    },
  },
  render(ctx) {
    return [
      h("div", null, ctx.count),
      h(
        "button",
        {
          onClick: ctx.add,
        },
        "add"
      ),
    ];
  },
}).mount("#app");
```

Vue3 的组件示例（composition）（渲染函数）

```javascript
createApp({
  setup() {
    const count = ref(0);
    const add = () => count.value++;
    return {
      count,
      add,
    };
  },
  render(ctx) {
    return [
      h("div", null, ctx.count),
      h(
        "button",
        {
          onClick: ctx.add,
        },
        "add"
      ),
    ];
  },
}).mount("#app");
```

所以从实现来看都有共同点：

1. 都有 instance 实例，以承载内部的状态，方法等
2. 都有一个 render 函数
3. 都通过 render 产出 vnode
4. 都有一套更新策略，以重新执行 render 函数
5. 在此基础上附加各种能力，如生命周期，通信机制，slot，provide，inject 等等

不过我们不打算实现 optional API 的写法，只实现 composition API。也不打算实现 slot，provide，inject 等等

所以根据此基础我们先来改造一开始没用做完的 processComponent

```javascript
function processComponent(prevVNode, vnode, container, anchor) {
  // TODO processComponent
  if (prevVNode) {
    // TODO updateComponent
  } else {
    mountComponent(vnode, container, anchor);
  }
}
```

我们将 mountComponent 放在`component.js`中并引入。

不过在编写 mountComponent 之前，我们看一个例子：

# prop 和 attr

```javascript
const Comp = {
  props: ["foo"],
  render(ctx) {
    return h("div", { class: "a", id: ctx.bar }, ctx.foo);
  },
};

const vnodeProps = {
  foo: "foo",
  bar: "bar",
};

const vnode = h(Comp, vnodeProps);
render(vnode, root); // 渲染为<div class="a" bar="bar">foo</div>
```

这个例子只 prop 了一个 foo，没有接收 bar。所以对应也渲染了 foo 出来，没有渲染 id 为 bar。但是为什么又有一个 `bar="bar"`属性呢？这个是因为 vue3 会默认的将没有 prop 进来的参数自动作为 attribute 添加到根节点上。

所以我们的实例要有 props 和 attrs 两个参数

```javascript
export function mountComponent(vnode, container, anchor) {
  const { type: Component } = vnode;
  // 一个组件必然有一个实例
  const instance = {
    props: null,
    attrs: null,
  };
  // 初始化props
  initProps(instance, vnode);
}
```

## initProps

这一步操作主要是为了分离 props 和 attrs，setup 的 props 中存在的就分配给 props，不存在的就分配给 attrs。然后再把 props 变成响应式放出去使用

```javascript
function initProps(instance, vnode) {
  // 我们知道type在vnode里面
  // 起别名免得命名冲突 此时这两个就对应了例子中的Comp和vnodeProps
  const { type: Component, props: vnodeProps } = vnode;
  const props = (instance.props = {});
  const attrs = (instance.attrs = {});
  for (const key in vnodeProps) {
    // 因为prop有很多种类型，我们把它当作只能接收数组类型来简单处理
    // 又因为这个props不一定声明，所以用可选链
    if (Component.props?.includes(key)) {
      props[key] = vnodeProps[key];
    } else {
      attrs[key] = vnodeProps[key];
    }
  }
  // 因为props的数据也是响应式的，但是它不能被修改，这里就先用reactive来简单替代
  instance.props = reactive(instance.props);
}
```

## setup

再次回到 mountComponent,我们接下来要去出发 setup 将我们的 props 和 attrs 传进去。根据 vue3 官网我们知道 setup 接收两个参数
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220612151936.png)

其中 props 我们已经写了，context 是一个对象，包含着 attrs，slot，emit，我们只简单实现 attrs，所以也就将 attrs 传进去即可。另外由于 setup 最终会把响应式数据 return 出去，所以我们还需要保存下这个结果

```javascript
const { type: Component } = vnode;
// 一个组件必然有一个实例
const instance = {
  props: null,
  attrs: null,
  // 将结果保存起来
  setupState: null,
};
// 初始化props
initProps(instance, vnode);
// 因为setup也可能不存在，所以可选链
instance.setupState = Component.setup?.(instance.props, {
  attrs: instance.attrs,
});
```

接下来我们就继续执行 mountComponent 函数

## ctx

render 接收一个 ctx，通过观察发现 ctx 包含了 props 或者 setupState

```javascript
const instance = {
  props: null,
  attrs: null,
  // 将结果保存起来
  setupState: null,
  // 观测实例发现ctx可以取到setupState和props
  ctx: null,
};
// 注意vue源码里面是采用代理从props里面找，找不到再找setupState，这里偷懒直接合并
instance.ctx = {
  ...instance.props,
  ...instance.setupState,
};
```

## 封装 mount

然后我们将执行 render 函数的操作封装成一个方法

```javascript
const instance = {
  ...
  // 将执行render的操作封装成一个函数
  mount: null,
};
// 这里就不用可选链了,因为render对于组件来说必须存在的
instance.mount = ()=>{
  Component.render(instance.ctx);
}
```

### normalizeVNode

不过我们还要对 mount 返回的结果进行一个预处理

如果它只是一个 h 函数好说,但是如果它是一个数组的情况,就不是一个标准的 vnode,而且我们如果想对只返回一个字符串等操作做处理,那么我们就需要一个辅助函数 normalizeVNode,我们将他放到`vnode.js`里面做处理

```javascript
export function normalizeVNode(result) {
  // 如果是个数组我们就用Fragment把他包装一下
  if (isArray(result)) {
    return h(Fragment, null, result);
  }
  if (isObject(result)) {
    return result;
  }
  // string||number
  return h(Text, null, result.toString());
}
```

再次回到 mountComponent

我们将组件产物的 vnode 命名为 subTree

### subTree

```javascript
instance.mount = () => {
  const subTree = normalizeVNode(Component.render(instance.ctx));
  // 直接patch 但是注意这里的引入方式,可以直接传入也可以导出然后使用
  patch(null, subTree, container, anchor);
};
instance.mount();
```

# 案例 1

之后我们跑一下这段代码

```javascript
import { render, h } from "./runtime";
const Comp = {
  props: ["foo"],
  render(ctx) {
    return h("div", { class: "a", id: ctx.bar }, ctx.foo);
  },
};

const vnodeProps = {
  foo: "foo",
  bar: "bar",
};

const vnode = h(Comp, vnodeProps);
render(vnode, document.body); // 渲染为<div class="a" bar="bar">foo</div>
```

第一次跑的时候会发现它少了一个 bar 属性，前面也提到了 vue3 会默认的将没有 prop 进来的参数自动作为 attribute 添加到根节点上。所以这个 bar 是一定存在的，至于为什么跑了这段代码他没出现，原因是我们没有处理 attr 的继承

## fallThrough

这个方法用于处理 attr 的继承，因为我们的这个 props 最后是会在 patchDomProp 中进行处理的。所以我们现在要把 bar 传过去的方法就是将他和我们现在的 props 合并(虽然 vue3 不是这样做的，从简吧)

具体做法是如果存在 attr 属性，就将组件的节点所在的 props 和 instance 的 attrs 合并.

```javascript
function fallThrough(instance, subTree) {
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs,
    };
  }
}
```

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220612163006.png)

可以看到最后结果和我们预想的一致

# 案例 2

```javascript
import { render, h } from "./runtime";
import { ref } from "./reactiveDemo/ref";
const Comp = {
  setup() {
    const count = ref(0);
    const add = () => {
      count.value++;
      console.log(count.value);
    };
    return {
      count,
      add,
    };
  },
  render(ctx) {
    return [
      h("div", null, ctx.count),
      h(
        "button",
        {
          onClick: ctx.add,
        },
        "add"
      ),
    ];
  },
};

const vnode = h(Comp);
render(vnode, document.body);
```

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220612164141.png)

在案例二中我们发现跑出来的结果并没有 count，这个是因为真正的 vue 里面处理掉了这个 value 值，不需要 value 值就可以访问基础类型响应式数据，而我们图方便就不这样做了，选择直接改为`h("div", null, ctx.count.value)`重新跑

我们发现 dom 已经渲染出来了

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220612164130.png)

但是不论我们如何点击都没有改变值，现在我们输出一下 count 值试一试

```javascript
const add = () => {
  count.value++;
  console.log(count.value);
};
```

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220612164409.png)

我们发现结果已经加了 但是 dom 并没有更新，原因很简单，因为我们只 mount 了一次，没有写 update 操作

# update

既然是更新，就需要拿到上一次的结果进行 patch，所以我们要将 subTree 存起来。

```javascript
instance.update = () => {
  const prev = instance.subTree;
  const subTree = (instance.subTree = normalizeVNode(
    Component.render(instance.ctx)
  ));
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs,
    };
  }
  // 需要上一次的subTree来更新，所以要把subTree保存起来。
  patch(prev, subTree, container, anchor);
};
```

那么还有一个问题，就是怎么触发更新。

在我们之前的响应式学习中，我们知道响应式是由 reactive 建立，由 effect 触发的，只要改变了响应式数据，那么就会在 proxy 里面触发 trigger 方法，对依赖进行查找并执行相应的 effect。

那么对于这个 update 其实也很简单，只要用 effect 把 update 包裹起来即可实现更新。

```javascript
instance.update = effect(() => {
  const prev = instance.subTree;
  const subTree = (instance.subTree = normalizeVNode(
    Component.render(instance.ctx)
  ));
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs,
    };
  }
  // 需要上一次的subTree来更新，所以要把subTree保存起来。
  patch(prev, subTree, container, anchor);
});
```

## 合并 mount 和 update

这里又会出现一个问题，就是我们在写 effect 的时候默认是给他执行一次的，除了配置项 lazy 之外，所以为了解决这个问题，我们可以将 mount 和 update 合并

为了区分它是不是第一次 mount，需要一个变量 isMounted

```javascript
const instance = {
  props: null,
  attrs: null,
  // 将结果保存起来
  setupState: null,
  // 观测实例发现ctx可以取到setupState和props
  ctx: null,
  // 将执行render的操作封装成一个函数
  update: null,
  subTree: null,
  isMounted: false,
};
instance.update = effect(() => {
  if (!instance.isMounted) {
    const subTree = (instance.subTree = normalizeVNode(
      Component.render(instance.ctx)
    ));
    // 此处的fallThrough就是之前的遍历
    fallThrough(instance, subTree);
    // 直接patch 但是注意这里的引入方式
    patch(null, subTree, container, anchor);
    vnode.el = subTree.el;
    instance.isMounted = true;
  } else {
    const prev = instance.subTree;
    const subTree = (instance.subTree = normalizeVNode(
      Component.render(instance.ctx)
    ));
    fallThrough(instance, subTree);
    // 需要上一次的subTree来更新，所以要把subTree保存起来。
    patch(prev, subTree, container, anchor);
    vnode.el = subTree.el;
  }
});
```

至此就完成了组件的主动更新

# 被动更新

见例子

```javascript
const Child = {
  props: ["foo"],
  render(ctx) {
    return h("div", { class: "a", id: ctx.bar }, ctx.foo);
  },
};

const Parent = {
  setup() {
    const vnodeProps = reactive({
      foo: "foo",
      bar: "bar",
    });
    return { vnodeProps };
  },
  render(ctx) {
    return h(Child, ctx.vnodeProps);
  },
};

render(h(Parent), root);
```

这个例子中，父组件发生了一次更新，是主动更新，但是父组件的渲染的时候，这个 child 是已经存在的组件，如果子组件对应的 props 也发生变化了，就会触发 updateComponent。导致了子组件的更新，也就是被动更新。

# updateComponent

先不考虑子组件的 props 发生变化的情况，我们来处理这个 updateComponent

它接收两个参数，一个是 prevVNode 一个是 vnode，由于是更新，所以我们要尽可能考虑能复用原先实例 instance 中的 update 方法。为了解决这个问题，我们可以将实例 instance 挂载到 vnode 上面，

## 挂载实例到 vnode

```javascript
return {
  type,
  props,
  children,
  shapeFlag,
  el: null,
  anchor: null,
  key: props && props.key,
  component: null, //专门用于存储组件的实例
};
...
const instance = (vnode.component = {
  props: null,
  attrs: null,
  setupState: null,
  ctx: null,
  update: null,
  subTree: null,
  isMounted: false,
});
// 回到updateComponent
function updateComponent(prevVNode,vnode){
  vnode.component = prevVNode.component;
  vnode.component.update();
}
```

## next 传递节点

这就到了实例的 instance 里面，但此时执行的还是原先的 prevVNode，我们还需要传递 vnode 新节点过去

这里就再给实例添加一个属性 next 初始值设置为 null，然后在 updateComponent 里面传递

```javascript
const instance = (vnode.component = {
  props: null,
  attrs: null,
  // 将结果保存起来
  setupState: null,
  // 观测实例发现ctx可以取到setupState和props
  ctx: null,
  // 将执行render的操作封装成一个函数
  update: null,
  subTree: null,
  isMounted: false,
  // 存储新的vnode
  next: null,
});
...
function updateComponent(prevVNode, vnode) {
  vnode.component = prevVNode.component;
  vnode.component.next = vnode;
  vnode.component.update();
}
```

## 重新初始化 next

现在如果 next 存在就是被动更新。我们复用 vnode，将节点传进来 并将 next 置为 null 防止下次主动更新触发被动更新出错

```javascript
if (instance.next) {
  // 被动更新
  // 复用vnode，将节点传进来 并将next置为null防止下次主动更新触发被动更新出错
  vnode = instance.next;
  instance.next = null;
}
```

## 获取最新 props

回顾一下我们的案例，主要是父组件的 props 改变导致了子组件的被动更新。所以其原因还是在 props，我们这里也要去获取最新的 props 值

```javascript
if (instance.next) {
  // 被动更新
  // 复用vnode，将节点传进来 并将next置为null防止下次主动更新触发被动更新出错
  vnode = instance.next;
  instance.next = null;
  initProps(instance, vnode);
  instance.ctx = {
    ...instance.props,
    ...instance.setupState,
  };
}
```

由于我们的 context 是合并来的并不是像源码一样代理来的，所以要手动合并一次

# shouldComponentUpdate

我们最开始遗留的问题，就是没考虑子组件的 props 是否改变，改变了才应该去更新。

这个方法就是 react 里面的方法，react 将这个方法暴露出来给用户让他决定是否更新，vue 就将其内置。主要的操作这里就省略了。

# unmountComponent

直接把 vnode 里面挂载的 component 中的 subTree 卸载即可

```javascript
function unmountComponent(vnode) {
  unmount(vnode.component.subTree);
}
```

当然真实的卸载组件流程没那么简单，他还要去处理destroy和beforeDestroy的情况

# 总结
component篇是之前遗留下来的一个章节，我们从一个例子入手了解组件的script部分是由setup和render组成，setup负责接收props和context，其中context对象内部又有attrs，slot，inject等内容，且由于vue的特性是，将组件没有props的内容当作attrs传进去，为了实现分离的特性，我们尝试写了initProps函数，之后我们调用了组件的setup函数传入props和attrs，并将它的结果保存在了setupState里面，因为setup的数据最后会return出去。

render部分则有一个参数ctx，包含了props或者setupState，它要找到对应的依赖，vue中是使用代理的方式，从props开始找，找不到再去setupState里面找。另外值得一提的是可以没有setup，但是必须有render。然后，由于render中的h函数有几种情况：数组，对象，单个字符串三种形式，不能按照同一个情况处理。所以编写了normalizeVNode方法，在数组的时候用Fragment包裹起来，对象就直接返回，字符串就用文本包裹起来。

组件挂载生成的节点叫做subTree。

先前遗留的attrs继承问题，用fallThrough方法来解决。vue中应该是通过代理的方式。

之后介绍了组件的更新，分为主动更新和被动更新，主动更新是拿到之前的subTree然后对比更新，被动更新是因为父组件重新render的时候，子组件的props改变了，导致子组件被动更新。最后是卸载。

下一节将讲述scheduler部分。

