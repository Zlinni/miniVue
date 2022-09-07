---
title: 从零开始的mini-vue⑦--scheduler篇
tags:
  - Vue
categories:
  - Vue系列
cover: ./img/vue系列/scheduler.jpg
abbrlink: 3541433463
date: 2022-06-13 08:44:49
---

# 前言

{% note primary flat %}
mini-Vue 是精简版本的 Vue3，包含了 vue3 源码中的核心内容，附加上 demo 的具体实现。
本篇是 scheduler 篇，是关于 Vue3 中调度机制的深入讨论。
{% endnote %}

# 为什么需要 scheduler

在我们上节组件的实践中，我们跑了一个这样的例子

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

如果我们将例子中的 add 函数修改成如下

```javascript
const add = () => {
  count.value++;
  count.value++;
  count.value++;
  console.log(count.value);
};
...
render(ctx) {
   console.log('render');
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
```

我们会发现它是可以运行，一次加 3，但是右侧控制台中会发现这样的情况

![](https://cdn.jsdelivr.net/gh/Zlinni/Pic/img/20220613085131.png)

说明了我们每执行一次 add 操作，渲染函数就执行了三次。很明显这样是不对的，我们期望它每次执行 add 就只执行一次，回想一下之前 reactive 篇中的 effect 和 computed，我们用到了 scheduler 机制去帮助我们在 trigger 中优先执行 scheduler，所以我们也可以用同样的机制，优先执行完 add 操作再执行 render

# 使用调度机制

只需要在 update 里面加一个 scheduler 的配置项即可

```javascript
instance.update = effect(
  () => {
    // 省略
  },
  {
    scheduler: queueJob,
  }
);
```

# queueJob

接下来我们编写一个 queueJob 函数，它接收 job 作为参数，其实这个 job 就是我们的 effectFn，我们还需要一个任务栈用于放 job，并且还要对 job 进行去重(？)之后放入队列进行任务的执行

```javascript
const queue = [];
export function queueJob(job) {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job);
    // 清空队列的操作
    queueFlush();
  }
}
```

# queueFlush

这一步主要是看任务是否正在执行，如果有正在执行的任务就等待任务执行结束，如果没有就用异步任务执行 job

```javascript
function queueFlush() {
  // 任务是否正在执行 不在的话才能进入promise 且要等每次promise执行完才能进入下一个任务
  if (!isFlushing) {
    isFlushing = true;
    Promise.resolve().then(flushJobs);
  }
}
```

# flushJobs

我们的任务执行完才清空队列进行下一次任务,且由于 job 是用户代码可能会出错，所以要用 try 包裹起来。

```javascript
function flushJobs() {
  // 因为是用户代码可能会出错
  try {
    // 注意不能用len = queue.length 因为它可能在执行的时候继续添加
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    isFlushing = false;
    queue.length = 0;
  }
}
```

然后实践一下就会发现，要直接获取 dom 的数据还是不行或者获取，这里就需要 settimeout 或者 vue 的 nextTick

所以我们要实现一个 nextTick

# nextTick

对于 nextTick 有两种情况，1 是使用的时候还存在正在执行的 promise，则直接返回当前正在执行的 promise 成功的回调，2 是当前的任务都已经执行完了，那么就返回一个新的 promise 成功执行的回调。

```javascript
// 代表正在执行的promise
let currentFlushPromise = null;
// 封装一下Promise.resolve()
const resolvedPromise = Promise.resolve();
export function nextTick(fn){
    // 如果有在执行的promise则返回当前在执行的promise成功回调的结果，如果没有则返回一个新的promise的成功回调结果
    const p = currentFlushPromise || resolvedPromise;
    return p.then(fn);
}
...
function queueFlush() {
    // 任务是否正在执行 不在的话才能进入promise 且要等每次promise执行完才能进入下一个任务
    if (!isFlushing) {
        isFlushing = true;
        currentFlushPromise = resolvedPromise.then(flushJobs)
    }
}
// 清空队列了
function flushJobs() {
    // 因为是用户代码可能会出错
    try {
        ...
    } finally {
        isFlushing = false;
        queue.length = 0;
        // 注意清空currentFlushPromise
        currentFlushPromise = null;
    }
}
```

由于我们还会用到 es6 的 await 语法，比如`await nextTick()`这个时候是不传参的，所以针对这种写法我们也要注意

```javascript
export function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise;
  // 如果fn存在就p.then否则就把p传回去
  return fn ? p.then(fn) : p;
}
```

至此我们已经写好了完整的 scheduler

# scheduler 完整代码

```javascript
const queue = [];
let isFlushing = false;
let currentFlushPromise = null;
const resolvedPromise = Promise.resolve();
export function nextTick(fn) {
  // 如果有在执行的promise则返回当前在执行的promise成功回调的结果，如果没有则返回一个新的promise的成功回调结果
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(fn) : p;
}
/**
 * @description:
 * @param {effectFn} job
 * @return {*}
 */
export function queueJob(job) {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job);
    // 清空队列的操作
    queueFlush();
  }
}

function queueFlush() {
  // 任务是否正在执行 不在的话才能进入promise 且要等每次promise执行完才能进入下一个任务
  if (!isFlushing) {
    isFlushing = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
// 清空队列了
function flushJobs() {
  // 因为是用户代码可能会出错
  try {
    // 注意不能用len = queue.length 因为它可能在执行的时候继续添加
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    isFlushing = false;
    queue.length = 0;
    currentFlushPromise = null;
  }
}
```

# createApp

接下来我们写 minivue 的 createApp，我们一般都是 createApp 包裹住一个组件，然后`.mount(document.body)`这样写，不需要 render 和 h 函数生成 vnode

```javascript
/*
 * @Author: Zlinni 984328216@qq.com
 * @Date: 2022-05-22 19:49:21
 * @LastEditors: Zlinni 984328216@qq.com
 * @LastEditTime: 2022-06-13 19:24:24
 * @FilePath: \mini-vue\zMini-vue\src\index.js
 * @Description:
 *
 * Copyright (c) 2022 by Zlinni 984328216@qq.com, All Rights Reserved.
 */
import { render, h, createApp } from "./runtime";
import { ref } from "./reactive/ref";
createApp({
  setup() {
    const count = ref(0);
    const add = () => {
      count.value++;
      count.value++;
      count.value++;
    };
    return {
      count,
      add,
    };
  },
  render(ctx) {
    console.log("render");
    return [
      h("div", null, ctx.count.value),
      h(
        "button",
        {
          onClick: ctx.add,
        },
        "add"
      ),
    ];
  },
}).mount(document.body);
```

首先我们创建一个`createApp.js`，这个 createApp 接受一个参数，是组件，返回一个组件实例，我们还需要将他用 mount 挂载起来，其中对于 mount 来说，可以接受一个 dom 也可以接收字符串，比如我们在创建 vue 实例的时候经常会写的`mount(#app)`

```javascript
import { isString } from "../utils";
import { render } from "./render";
import { h } from "./vnode";

/**
 * @description:
 * @param {组件} rootComponent
 * @return {组件的实例}
 */
export function createApp(rootComponent) {
  const app = {
    mount(rootContainer) {
      // 如果它是字符串就把他转换成DOM对象
      if (isString(rootContainer)) {
        rootContainer = document.querySelector(rootContainer);
      }
      render(h(rootComponent), rootContainer);
    },
  };
  return app;
}
```

这样就实现了这个 createApp，但是 vue 为什么要单独写一个 createApp 呢。实际上，它是为了后面更好的拓展 Vue 下面的其他方法，比如我们用过的 `use()`,`mixin()`等方法

# 总结

本节中我们学习了 vue 的 scheduler 调度机制，从之前 effect 和 computed 的案例开始说起，沿用 scheduler 的优先执行机制(异步任务)来帮助我们优化组件的更新过程，其中对于任务队列(queueJob)，我们只在队列为空或者不存在相同的任务的时候才将任务放进任务栈，然后去执行任务(queueFlush),这个过程中我们要把当前执行的任务保存起来，到真正执行环节(flushJobs)的时候，因为这些任务是用户代码需要包裹起来，然后将它们逐个从任务栈中取出来执行。执行结束之后改变标志位并清空当前执行任务的标志。

我们还学到了nextTick，其实nextTick就和我们的调度机制息息相关，我们拿到了scheduler中正在执行的任务，就将nextTick的事件放到它的成功回调后，当然还要考虑一种情况如果任务都执行完了，就将事件放在新的promise的成功回调中。不过最后我们还考虑到了es6的await使用nextTick的情况，我们就把nextTick的返回值稍作修改，当有fn传进来就返回任务的成功回调，否则就返回整个任务promise。

下一节我们将学习vue的模板编译。
