---
title: 从零开始的mini-vue①--reactive篇
abbrlink: 3451170570
date: 2022-05-30 10:33:04
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/reactive.jpg
---

# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是 reactive 篇，是关于 Vue3 中响应式的篇章，包含了`reactive`,`ref`,`computed`的实现
{% endnote %}
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/reactivedaotu.png)
![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/computedandref.png)

# 项目构建

项目使用 webpack 构建，demo 的代码放在`index.js`之中，将其打包成为`mini-vue.js`,之后`index.html`引入，控制台查看 demo 输出。

# reactive

Vue3 中的`reactive`用于处理对象数据，将引用类型的数据转化为响应式。其实它是由两个部分组成的，见例子。我们知道它由 `reactive` 和 `effect` 组成

```javascript
const observed = reactive({
  count: 0,
});
effect(() => {
  console.log("observed.count is:", observed.count);
});
```

我们把这个 effect 叫做副作用函数，副作用函数的执行会影响其他变量或者函数的执行。这里它是作用是收集依赖，在依赖发生改变的时候触发更新。

它们两个是怎么产生联系的呢?核心是进行依赖收集 track 和触发依赖更新 trigger

依赖收集就是保存依赖和副作用之间的关系.

触发依赖更新就是当依赖变更的时候,找到并执行依赖它的副作用

我们知道了上述的操作，将它们分为两个部分进行编写，一是`reactive.js` 二是`effect.js`

## reactive 部分

刚才提及到，reactive 处理的是对象类型的数据，所以我们要编写一个方法判断对象

所以我们新建`utils`文件夹，写入`index.js`,用于编写我们的工具类方法

判断对象类型的数据的方法,需要注意的是由于`null`也会被判断为 object，所以要多加判断

```javascript
export funtcion isObject(target){
  return typeof target === 'object' && target !== null
}
```

接下来我们要考虑怎么去将数据变为响应式。

学过 vue3 基础的都知道，vue3 使用的是 Proxy 来对响应式数据进行 track 和 trigger

proxy 接收两个参数，一个是 target 一个是 handler，前者是拦截的对象，后者是分为了 get 和 set 两步操作。

同时 get 接收三个参数，对象，需要拦截的属性 key，接收者 receiver

这个 receiver 指向原始读操作所在的对象，一般指的是 Proxy 实例

```javascript
const proxy = new Proxy(
  {},
  {
    get: function (target, property, receiver) {
      return receiver;
    },
  }
);

const d = Object.create(proxy);
d.a === d; // true
//d对象本身没有a属性，所以读取d.a的时候，会去d的原型proxy对象找。这时，receiver就指向d，代表原始的读操作所在的那个对象。
```

set 接收四个参数，对象，需要拦截的属性，改变的 value 值，接收者 receiver。最后返回一个布尔值

我们还需要反射对象 Reflect，我们通过它可以获取对象上的某个指定属性的方法(get)，也可以去修改对象属性上的值(set)。

```javascript
import { isObject } from "../utils";
import { track, trigger } from "./effect";

export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      track(target, key);
      return res;
    },
    set(target, key, value, receiver) {
      const res = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return res;
    },
  });
  return proxy;
}
```

接着我们入手`effect.js`

## effect 部分

我们在这个部分需要对副作用函数进行处理和剖析，以及对我们的 track 和 trigger 进行编写

首先我们需要拿到并执行这个副作用函数

```javascript
export function effect(fn) {
  const effectFn = () => {
    try {
      return fn();
    } finally {
      //todo
    }
  };
  effectFn();
  return effectFn;
}
```

因为是用户写的 effect，可能会报错，所以要用 try 来包裹住,且我们的 track 要收集我们的依赖，就要知道依赖有没有被执行，也就是有没有调用 effect 中的方法，所以我们要设计一个标识记录该方法。这里就用到全局变量`activeEffect`,去缓存我们的 effect，然后在执行完之后给它还原回去。

```javascript
let activeEffect;
export function effect(fn) {
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      return fn();
    } finally {
      activeEffect = undefined;
    }
  };
  effectFn();
  return effectFn;
}
```

现在我们要来写 track 和 trigger 部分，但我们得先考虑一下，我们依赖的数据结构应该怎么设计

先了解一下这样的一个执行过程：

副作用执行=>副作用依赖的响应式对象改变=>响应式对象改变=>响应式对象的属性改变

且响应式对象的属性可以由多个副作用依赖

```javascript
{
  响应式对象1:{
    属性1:[副作用1，副作用2，副作用3...],
    属性2:[副作用1，副作用2，副作用3...],
  },
  响应式对象2:{

  }
  ...
}
```

那我们就知道得先存储响应式对象，这里就使用`WeakMap`作为它的数据结构，这样的好处是里面的响应式对象在不被使用的时候会被垃圾回收。命名为`targetMap`

再考虑响应式对象的属性，我们将他存放在一个`map`中，命名为`depsMap`

接着是它的副作用，副作用存放在一个`set`中，因为可能有多个副作用依赖同样的属性，命名为`deps`

这样，我们的结构就是如下

```javascript
targetMap:{
  响应式对象(target):{
    depsMap:{
      属性(key):{
        deps:{
          副作用(activeEffect)
        }
      }
    }
  }
}
```

写完依赖的数据结构之后，就可以开始写 track 了

我们现在再次了解一下 track 的作用:添加依赖，也就是要找到层级结构中的依赖，对此，我们进行下面写法。

### track 部分

```javascript
const targetMap = new WeakMap();
// track的作用是收集依赖
export function track(target, key) {
  // 如果不是正在执行的依赖 直接返回
  if (!activeEffect) {
    return;
  }
  // 构建depsMap
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  // 构建deps
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 添加依赖
  deps.add(activeEffect);
}
```

### trigger 部分

对于 trigger 部分，其实就是 track 的逆运算

```javascript
// trigger用于触发更新
export function trigger(target, key) {
  // 如果它有副作用,才执行
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = depsMap.get(key);
  if (!deps) {
    return;
  }
  deps.forEach((effectFn) => {
    effectFn();
  });
}
```

至此一个最简单的响应式已经设计好了,接下来我们通过一些特例,来处理特殊情况以及优化

# 特例处理与优化

{% note primary flat %}
下面有六个特例，对应处理 reactive 的六种情况
{% endnote %}

1. `reactive(reactive(obj))`
2. `let a = reactive(obj), b = reactive(obj)`
3. `hasChanged`
4. 深层对象代理
5. 数组
6. 嵌套 effect

## 嵌套 reactive

`reactive(reactive(obj))`

对于第一种情况，是同一个对象被多次响应式处理了。正常的情况应该是只处理一次。

我们可以给响应式对象添加一个`_isReactive`属性，依此来判断.

注意这里用了`!!`将结果转为 boolean

```javascript
export function isReactive(target) {
  return !!(target && target._isReactive);
}
```

完整代码

```javascript
import { isObject } from "../utils";
import { track, trigger } from "./effect";

export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  //判断是否已经是响应式对象
  if (isReactive(target)) {
    return target;
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      //判断key是否为__isReactive
      if (key === "__isReactive") {
        return true;
      }
      track(target, key);
      return res;
    },
    set(target, key, value, receiver) {
      const res = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return res;
    },
  });
  return proxy;
}
export function isReactive(target) {
  return !!(target && target.__isReactive);
}
```

## 多次对同个对象进行响应式处理

{% note primary flat %}
`let a = reactive(obj), b = reactive(obj)`

这个可以说是和上面的特例优点类似，但是实际上的处理却不太一样。
{% endnote %}

对于第一个特例，我们是通过判断标识`__isReactive`来判断它是否被代理过，然后如果已经存在这个属性，则将其拦截为 true。

对于第二个特例，我们要通过一个数据结构来存储我们的响应式对象，当目标对象下次被响应式处理的时候，判断数据结构中是否有该响应式对象，有则直接返回该响应式对象。

<!-- 所以这两个处理主要的区别在于，是否返回同样的响应式，对于第一种，多次嵌套，它返回的是嵌套内容，对于第二种，它返回的是处理过的响应式对象。 -->

```javascript
import { isObject } from "../utils";
import { track, trigger } from "./effect";
// 创建proxyMap
const proxyMap = new WeakMap();
export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  if (isReactive(target)) {
    return target;
  }
  // 有则直接返回该响应式对象
  if (proxyMap.get(target)) {
    return target;
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      if (key === "__isReative") {
        return true;
      }
      track(target, key);
      return res;
    },
    set(target, key, value, receiver) {
      const res = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return res;
    },
  });
  // 设置
  proxyMap.set(target, proxy);
  return proxy;
}
export function isReactive(target) {
  return !!(target && target.__isReative);
}
```

## 响应式内容是否改变(懒处理不触发更新)

`hasChanged`是代表着响应式对象是否被改变的操作。在 vue3 中，如果响应式的数据和上一次的没有改变，则不触发更新

那么很快就知道入手点在 proxy 的 set 中了。不过在此之前我们得编写`hasChanged`函数,它需要对我们此次的值和上一次的值比较。

不过光是对比，很容易就遗留一个特殊情况，就是`NaN`和`NaN`的情况，看起来是一样的值，实际上的比较是 false 的，所以要对这个特殊值进行处理。

```javascript
export function hasChanged(oldValue, value) {
  return oldValue !== value && !(Number.isNaN(oldValue) && Number.isNaN(value));
}
```

接着我们开始处理 set 了，我们就还要搞清楚`oldValue`和`value`是怎么处理的。对于前者，它就是我们现在响应式对象中的属性值，`target[key]`，value 则是本次传入的值。

```javascript
import { hasChanged, isObject } from "../utils";
import { track, trigger } from "./effect";

const proxyMap = new WeakMap();
export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  if (isReactive(target)) {
    return target;
  }
  if (proxyMap.get(target)) {
    return target;
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      if (key === "__isReative") {
        return true;
      }
      track(target, key);
      return res;
    },
    set(target, key, value, receiver) {
      const res = Reflect.set(target, key, value, receiver);
      // 处理hasChanged
      let oldValue = target[key];
      if (hasChanged(oldValue, value)) {
        trigger(target, key);
      }
      return res;
    },
  });
  proxyMap.set(target, proxy);
  return proxy;
}
export function isReactive(target) {
  return !!(target && target.__isReative);
}
```

## 深层对象代理

我们的响应式对象可能是多层嵌套的，首先这个在 vue2 中，它对于深层对象的处理方式是暴力遍历然后为每个对象赋上响应式。但在 vue3 中，对于这些深层对象是进行一个懒处理。也就是它没有对每个对象进行响应式处理，只对当前层次的对象进行响应式处理。

```javascript
const proxy = new Proxy(target, {
  get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver);
    if (key === "__isReative") {
      return true;
    }
    track(target, key);
    return res;
  },
  set(target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver);
    let oldValue = target[key];
    if (hasChanged(oldValue, value)) {
      trigger(target, key);
    }
    // 如果是对象继续响应式处理，如果不是，就只处理当前层次
    return isObject(res) ? reactive(res) : res;
  },
});
proxyMap.set(target, proxy);
return proxy;
```

例子:

```js
const observed1 = reactive({
  count1: 0,
  count2: 10,
  obj: {
    obj: {},
  },
});

const observed2 = reactive({
  count: 100,
});

effect(() => {
  console.log("sum is:", observed1.count1 + observed1.count2 + observed2.count);
});

effect(() => {
  console.log("sum is:", observed1.count1 + observed1.count2 + observed2.count);
});
```

## 数组处理

在 vue2 中，我们知道它是重写了数据的几个 api，然后拦截了数组进行处理，且因为 vue2 对`defineProperty`处理，性能的原因，我们修改数组下标和长度是没办法被检测的，但在 vue3 中 proxy 解决了这个问题。

在这一部分，对于数组的处理主要是避免 length 多次被触发，只有在值真正被改变了才去 trigger 这个 length

```javascript
set(target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver);
    let oldLength = target.length;
    let oldValue = target[key];
    if(hasChanged(oldValue,value)){
        if(isArray(target)&&hasChanged(oldLength,target.length)){
            trigger(target,'length');
        }
        trigger(target, key);
    }
    return isObject(res)?reactive(res):res;
}
```

例子

```javascript
const observed = (window.observed = reactiv([1, 2, 3]));
effect(() => {
  console.log("index 4 is:", observed[4]);
});
effect(() => {
  console.log("length is:", observed.length);
});
```

## 嵌套 effect

说完了这些，剩下一个嵌套 effect 的部分，见例子

```javascript
const observed = (window.observed = reactive({
  count1: 0,
  count2: 10,
}));
effect(() => {
  effect(() => {
    console.log("count2 is:", observed.count2);
  });
  console.log("count1 is:", observed.count1);
});
```

我们可以来测试一下目前写的例子，会发现我们触发`count2`是正常的，触发`count1`是不正常的,没有打印出`count2`。

换句话说，就是内层依赖正常触发更新，但是外层依赖没有正确触发。这是为什么呢？这是因为，我们在执行副作用函数的时候，先执行了外层，之后再执行内层，此时外层的 effect 已经丢失了。

```javascript
let activeEffect;
export function effect(fn) {
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      return fn();
    } finally {
      activeEffect = undefined;
    }
  };
  effectFn();
  return effectFn;
}
```

所以我们要换个角度来说，就是要用数据结构去保存我们的`activeEffect`然后再结束的时候去弹出末尾的`activeEffect`并还原`activeEffect`为新的末尾项。

于是可以想到栈结构

```javascript
let activeEffect;
const effectStack = [];
export function effect(fn) {
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      effectStack.push(activeEffect);
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };
  effectFn();
  return effectFn;
}
```

这样就解决了嵌套 effect 的问题

## 完整 reactive

完整代码

```javascript
import { isObject, hasChanged, isArray } from "../utils";
import { track, trigger } from "./effect";
// 存储proxy对象
const proxyMap = new WeakMap();
export function reactive(target) {
  // 类型判断是否需要做响应式代理
  if (!isObject(target)) {
    return target;
  }
  // 只能代理一次
  if (isReactive(target)) {
    return target;
  }
  // 如果已经有这个代理对象 直接返回
  if (proxyMap.get(target)) {
    return target;
  }
  // proxy
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      if (key === "__isReactive") {
        return true;
      }
      track(target, key);
      // 不需要对每层对象进行劫持，只对需要的对象进行。
      return isObject(res) ? reactive(res) : res;
    },
    set(target, key, value, receiver) {
      let oldLength = target.length;
      const oldValue = target[key];
      const res = Reflect.set(target, key, value, receiver);
      if (hasChanged(oldValue, value)) {
        if (isArray(target) && hasChanged(oldLength, target.length)) {
          trigger(target, "length");
        }
        trigger(target, key);
      }
      return res;
    },
  });
  proxyMap.set(target, proxy);
  return proxy;
}
export function isReactive(target) {
  return !!(target && target.__isReactive);
}
```

完整 effect

```javascript
// 记录当前正在执行的副作用函数
let activeEffect;
// 使用一个栈记录当前正在执行的副作用
const effectStack = [];
export function effect(fn) {
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
      activeEffect = effectStack[effectStack.length - 1];
    }
  };
  return effectFn;
}

// 收集依赖
// 存储我们的依赖
const targetMap = new WeakMap();
export function track(target, key) {
  // target是响应式对象 key是对象的属性
  if (!activeEffect) {
    return;
  }
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
}
// 触发更新
export function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = depsMap.get(key);
  if (!deps) {
    return;
  }
  deps.forEach((effectFn) => {
    effectFn();
  });
}
```

{% note primary flat %}
至此，我们的响应式就都已经处理完了，下面进入`ref`章节
{% endnote %}

# ref

`ref`是 vue3 的一个新 api，目的是为了处理基本数据类型的响应式，访问`ref`处理过的数据需要使用`.value`

有了前面`reactive`的基础，下面我们要实现`ref`api 就容易多了，例子如下

```javascript
const foo = ref(1);
effect(() => {
  console.log("foo: ", foo.value);
});
```

首先`ref`返回的是一个`RefImpl`对象,这个对象接收的是`value`，拥有`get`和`set`两个方法，这之中它也是使用到了`track`和`trigger`去跟踪和更新值

其次它只对基础类型进行处理，其他情况交给`reactive`去做

```javascript
import { isObject } from "../utils";
import { track, trigger } from "./effect";
import { reactive } from "./reactive";

export function ref(value) {
  // 返回RefImpl对象
  return new RefImpl(value);
}

class RefImpl {
  constructor(value) {
    this._value = convert(value);
  }
  get value() {
    track(this, "value");
    return this._value;
  }
  set value(newValue) {
    this._value = newValue;
    trigger(this, "value");
  }
}

// 针对不同类型的数据 使用reative或者ref
export function convert(value) {
  return isObject(value) ? reactive(value) : value;
}
```

## 两点优化

到了这一步其实已经做好了一个`ref`api，但是我们还需要对以下两点优化:

1. 已经 ref 过的数据不需要再进行响应式处理
2. 如果前一次的值和后一次的值一样，不触发更新

对于第一点，我们设置一个`isRef`函数即可。处理的方式和之前`isReactive`类似

```javascript
export function isRef(value) {
  return !!(value && value.__isRef);
}
```

对于第二点，我们也是照样使用`hasChanged`

```javascript
set value(newValue) {
    if (hasChanged(newValue, this._value)) {
        this._value = convert(newValue);
        // trigger后置 因为值改变了才切换
        trigger(this, 'value');
    }
}
```

## 完整 ref

完整代码

```javascript
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
    return new RefImpl(value);·
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
```

{% note primary flat %}
那么至此对`ref`的处理也结束了，下面轮到`computed`
{% endnote %}

# computed
在这个模块开始我们不再详细的一步步写方法,以分析代码的方式走会比较容易理解.

在 vue3 中计算属性被归为了一个 api，因为不再像 vue2 一样，将`method`和`computed`分开，而是都组合在了一起，有点像又回到了一开始 js 编程的时候了。

例子

```javascript
let num = ref(1);
let sum = computed(() => {
  return num * 2;
});
```

## computed 机制

写这个 `computed` 之前,我们要明白 `computed` 的机制
使用了什么?

1. `computed` 使用了和 `effect` 相同的一套机制,但不同在于 `computed` 不会立刻触发
2. `computed` 使用了 `track` 和 `trigger` 收集依赖和触发更新

做了什么?

1. 调用了 `computed`,才返回更新值
2. `computed` 中的依赖更新,computed 才能更新

那么对于第一点,`computed` 不会立刻触发,那么触发的权力就是交给了调用 `computed` 的变量,这里拿 `sum` 作为例子.

本来我们的 `effect`,是在函数内部直接调用 `effectFn` 这个方法,返回触发的依赖,现在我们不需要直接调用 `effectFn`,我们需要将调用 `effectFn` 的权力交给我们的 `computed`,让他去调用然后获取更新值.所以我们需要一个变量去标识这个情况.

## lazy 懒处理 effectFn

也就是要在 `effect` 中增加一个 `option` 对象,传入的变量是 `lazy`,`lazy` 为真的时候,直接返回 `effectFn` 方法(`computed` 使用),`lazy` 为假或者不存在的时候,直接触发.

```javascript
//本来effect会直接执行,现在传入配置项让他根据配置项执行
// 增加option选项
export function effect(fn, option = {}) {
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      effectStack.push(activeEffect);
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };
  // lazy为false的时候执行,否则就直接返回effectFn给computed自行操作
  if (!option.lazy) {
    effectFn();
  }
  return effectFn;
}
```

## dirty 标识内部依赖是否更新

对于第二点,首先,`computed` 设计了一个 `dirty` 变量,用于标识内部依赖是否更新,默认为 `true`,所以我们第一次调用的时候他会拿到 `effect` 返回的 `effectFn` 并触发给`_value` 去缓存.

```javascript
class ComputedImpl {
  constructor(getter) {
    // 缓存它的值
    this._value = undefined;
    // 标识依赖是否更新
    this._dirty = true;
    // 区别在于computed不会立刻执行 effect会
    // 所以要拓展一下effect
    this.effect = effect(getter, {
      lazy: true,
    });
  }
  get value() {
    // 如果依赖更新了就要重新计算
    if (this._dirty) {
      this._value = this.effect();
      this._dirty = false;
      track(this, "value");
    }
    return this._value;
  }
  set value(newValue) {
    // todo
  }
}
```

## value 缓存依赖数据

如果下次依赖没有更新我们直接返回`_value` 缓存的值.

```javascript
get value() {
    if (this._dirty) {
        this._value = this.effect();
        this._dirty = false;
    }
    // 直接走_value
    return this._value;
}
```

但我们下次内部依赖更新了之后怎么继续获得 `effectFn` 呢?

## scheduler 调度函数

这就要使用到调度函数,他的作用就是,当 `computed` 内部的依赖发生更新的时候,去通知 `computed` 改变 `dirty`,在下次调用 `sum` 的时候触发更新

```javascript
this.effect = effect(getter, {
  lazy: true,
  // 还要将dirty变为true 所以要用一个调度机制
  // 让他去触发更新的时候不是立即去执行getter,而是去执行调度程序
  scheduler: () => {
    if (!this._dirty) {
      this._dirty = true;
    }
  },
});
```

`effect` 挂载这个 `scheduler` 并优先触发 `scheduler`

```javascript
export function effect(fn,options={}) {
    ...
    if(!options.lazy){
        effectFn();
    }
    // 挂载在副作用函数上
    effectFn.scheduler = options.scheduler;
    return effectFn;
}

// 触发更新
export function trigger(target,key) {
    ...
    deps.forEach(effectFn => {
        // 如果它有调度程序 优先执行 否则才去执行副作用函数本身
        if(effectFn.scheduler){
            effectFn.scheduler(effectFn)
        }else{
            effectFn();
        }
    });
}
```

## 解决嵌套 effect

这下一个完整的 `computed` 已经做好了,但还是有一些不足的地方.比如

```javascript
const sumRes = computed(() => obj.foo + obj.bar);
effect(() => {
  // 在该副作用函数中读取 sumRes.value
  console.log(sumRes.value);
});

// 修改obj.foo的值
obj.foo++;
```

我们原意是修改 `obj` 的 `foo` 然后副作用函数重新执行,但做到这里,会发现修改 `foo` 的值并不会触发副作用函数的渲染.

回想一下我们的依赖数据结构,响应式对象的属性可以被多个副作用依赖,那么这个问题就很简单了,就是 `effect` 嵌套的问题,我们 `computed` 只收集了内部的 `effect` 作为依赖,并没有外层的这个 `effect`,自然就不触发更新了

解决办法也很简单,就是通过手动触发的方式,在我们计算属性所依赖的响应式数据发生变化的时候手动调用 `trigger` 触发更新,在每次读取结束就手动 `track` 响应式数据.

```javascript
constructor(getter, setter) {
  ...
    this.effect = effect(getter, {
        lazy: true,
        // 还要将dirty变为true 所以要用一个调度机制
        // 让他去触发更新的时候不是立即去执行getter,而是去执行调度程序
        scheduler: () => {
            if (!this._dirty) {
                this._dirty = true;
                // 手动trigger
                trigger(this, 'value')
            }
        }
    });
}
get value() {
    // 如果依赖更新了就要重新计算
    if (this._dirty) {
        this._value = this.effect();
        this._dirty = false;
        // 手动track
        track(this, 'value')
    }
    return this._value;
}
```

因此综上所述,`computed` 比较关键的几个变量,`_value`,`lazy`,`_dirty` 和 `scheduler`

## 完整 computed

完整的 `computed`
```javascript
import { isFunction } from "../utils";
import { effect, track, trigger } from "./effect";

export function computed(getterOrOption) {
  let getter, setter;
  // 判断是否是函数
  if (isFunction(getterOrOption)) {
    getter = getterOrOption;
    setter = () => {
      console.warn("computed is readonly");
    };
  } else {
    getter = getterOrOption.get;
    setter = getterOrOption.set;
  }
  return new ComputedImpl(getter, setter);
}
class ComputedImpl {
  constructor(getter, setter) {
    // 保存setter
    this._setter = setter;
    // 缓存它的值
    this._value = undefined;
    // 标识依赖是否更新
    this._dirty = true;
    // 区别在于computed不会立刻执行 effect会
    // 所以要拓展一下effect
    this.effect = effect(getter, {
      lazy: true,
      // 还要将dirty变为true 所以要用一个调度机制
      // 让他去触发更新的时候不是立即去执行getter,而是去执行调度程序
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true;
          trigger(this, "value");
        }
      },
    });
  }
  get value() {
    // 如果依赖更新了就要重新计算
    if (this._dirty) {
      this._value = this.effect();
      this._dirty = false;
      track(this, "value");
    }
    return this._value;
  }
  set value(newValue) {
    // todo
    this._setter(newValue);
  }
}
```

{% note primary flat %}
那么至此reactive篇幅的全部内容都已经讲完，接下来会进入patch篇章研究vue是怎么设计并挂载节点到虚拟dom的
{% endnote %}

