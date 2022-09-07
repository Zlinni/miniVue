/*
 * @Author: Zlinni 984328216@qq.com
 * @Date: 2022-06-12 14:26:08
 * @LastEditors: Zlinni 984328216@qq.com
 * @LastEditTime: 2022-06-13 10:46:46
 * @FilePath: \mini-vue\zMini-vue\src\runtime\component.js
 * @Description:
 *
 * Copyright (c) 2022 by Zlinni 984328216@qq.com, All Rights Reserved.
 */
import {
  queueJob
} from "./scheduler"
import {
  effect
} from "../reactive/effect";
import {
  reactive
} from "../reactive/reactive";
import {
  normalizeVNode
} from "./vnode"

function updateProps(instance, vnode) {
  // 我们知道type在vnode里面
  // 起别名免得命名冲突 此时这两个就对应了例子中的Comp和vnodeProps
  const {
    type: Component,
    props: vnodeProps
  } = vnode;
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

function fallThrough(instance, subTree) {
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs
    }
  }
}
export function mountComponent(vnode, container, anchor, patch) {
  const {
    type: Component
  } = vnode;
  // 一个组件必然有一个实例
  const instance = vnode.component = {
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
    next: null
  };
  // 初始化props
  updateProps(instance, vnode);
  // 因为setup也可能不存在，所以可选链
  instance.setupState = Component.setup?.(instance.props, {
    attrs: instance.attrs,
  });
  // 注意vue源码里面是采用代理从props里面找，找不到再找setupState，这里偷懒直接合并
  instance.ctx = {
    ...instance.props,
    ...instance.setupState,
  };
  // 这里就不用可选链了,因为render对于组件来说是必须存在的
  // instance.mount = () => {
  //   const subTree = instance.subTree = normalizeVNode(Component.render(instance.ctx));
  //   if (Object.keys(instance.attrs).length) {
  //     subTree.props = {
  //       ...subTree.props,
  //       ...instance.attrs
  //     }
  //   }
  //   // 直接patch 但是注意这里的引入方式
  //   patch(null, subTree, container, anchor);

  // };
  // instance.mount();
  instance.update = effect(
    () => {
    if (!instance.isMounted) {
      const subTree = instance.subTree = normalizeVNode(Component.render(instance.ctx));
      fallThrough(instance, subTree)
      // 直接patch 但是注意这里的引入方式
      patch(null, subTree, container, anchor);
      vnode.el = subTree.el;
      instance.isMounted = true;
    } else {
      if (instance.next) {
        // 被动更新
        // 复用vnode，将节点传进来 并将next置为null防止下次主动更新触发被动更新出错
        vnode = instance.next;
        instance.next = null;
        updateProps(instance, vnode);
        instance.ctx = {
          ...instance.props,
          ...instance.setupState
        }
      }
      const prev = instance.subTree;
      const subTree = instance.subTree = normalizeVNode(Component.render(instance.ctx));
      fallThrough(instance, subTree)
      // 需要上一次的subTree来更新，所以要把subTree保存起来。
      patch(prev, subTree, container, anchor);
      vnode.el = subTree.el;
    }
  }, {
    scheduler: queueJob,
  })
}