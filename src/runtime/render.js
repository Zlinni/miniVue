import {
  ShapeFlags
} from "./vnode";
import {
  patchProps
} from "./patchProps";
import {
  mountComponent
} from "./component"

// 这里的vnode对应图的nextVnode，然后每次结束就保存在container._vnode中，所以一开始可以取他为prevVnode
export function render(vnode, container) {
  const prevVNode = container._vnode;
  if (!vnode) {
    // 如果prevVNode存在才去卸载
    if (prevVNode) {
      unmount(prevVNode);
    }
  } else {
    patch(prevVNode, vnode, container);
  }
  container._vnode = vnode;
}
// 在unmount中还需要判断类型。组件和fragment
function unmount(vnode) {
  const {
    shapeFlag,
    el
  } = vnode;
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

function unmountComponent(vnode) {
  unmount(vnode.component.subTree);
}

function processComponent(prevVNode, vnode, container, anchor) {
  if (prevVNode) {
    // shouldComponentUpdate
    updateComponent(prevVNode,vnode);
  } else {
    mountComponent(vnode, container, anchor,patch);
  }
}
function updateComponent(prevVNode,vnode){
  vnode.component = prevVNode.component;
  vnode.component.next = vnode;
  vnode.component.update();
}
function unmountFragment(vnode) {
  let {
    el: cur,
    anchor: end
  } = vnode;
  const {
    parentNode
  } = cur;
  while (cur != end) {
    let next = cur.nextSibling;
    parentNode.removeChild(cur);
    cur = next;
  }
  parentNode.removeChild(end);
}

function patch(prevVNode, vnode, container, anchor) {
  if (prevVNode && !isSameVNode(prevVNode, vnode)) {
    anchor = (prevVNode.anchor || prevVNode.el).nextSibling;
    unmount(prevVNode);
    prevVNode = null;
  }
  const {
    shapeFlag
  } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(prevVNode, vnode, container, anchor);
  } else if (shapeFlag & ShapeFlags.TEXT) {
    processText(prevVNode, vnode, container, anchor);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    processFragment(prevVNode, vnode, container, anchor);
  } else {
    processElement(prevVNode, vnode, container, anchor);
  }
}

function isSameVNode(prevVNode, vnode) {
  return prevVNode.type === vnode.type;
}

function processText(prevVNode, vnode, container, anchor) {
  if (prevVNode) {
    vnode.el = prevVNode.el;
    prevVNode.el.textContent = vnode.children;
  } else {
    mountTextNode(vnode, container, anchor);
  }
}

function processFragment(prevVNode, vnode, container, anchor) {
  const fragmentStartAnchor = vnode.el = prevVNode ? prevVNode.el : document.createTextNode('');
  const fragmentEndAnchor = vnode.anchor = prevVNode ? prevVNode.anchor : document.createTextNode('');

  if (prevVNode) {
    patchChildren(prevVNode, vnode, container, fragmentEndAnchor);
  } else {
    container.insertBefore(fragmentStartAnchor, anchor)
    container.insertBefore(fragmentEndAnchor, anchor)
    mountChildren(vnode.children, container, fragmentEndAnchor);
  }
}

function processElement(prevVNode, vnode, container, anchor) {
  if (prevVNode) {
    patchElement(prevVNode, vnode);
  } else {
    mountElement(vnode, container, anchor);
  }
}

function mountTextNode(vnode, container, anchor) {
  const textNode = document.createTextNode(vnode.children);
  // container.appendChild(textNode);
  container.insertBefore(textNode, anchor);
  vnode.el = textNode;
}

function mountElement(vnode, container, anchor) {
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
  if (props) {
    patchProps(null, props, el);
  }
  // 把节点挂载到el上
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, el);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el);
  }
  // container.appendChild(el);
  container.insertBefore(el, anchor);
  // 保存el
  vnode.el = el;
}

function mountChildren(children, container, anchor) {
  // 递归调用挂载
  children.forEach((child) => {
    patch(null, child, container, anchor);
  });
}

function patchElement(prevVNode, vnode) {
  vnode.el = prevVNode.el;
  patchProps(prevVNode.props, vnode.props, vnode.el);
  patchChildren(prevVNode, vnode, vnode.el);
}

function patchChildren(prevVNode, vnode, container, anchor) {
  const {
    shapeFlag: prevShapeFlag,
    children: c1
  } = prevVNode;
  const {
    shapeFlag,
    children: c2
  } = vnode;
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1);
    }
    if (c1 !== c2) {
      container.textContent = c2;
    }
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = "";
      mountChildren(c2, container, anchor);
    } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 只要第一个元素有key就当作有key
      if (c1[0] && c1[0].key != null && c2[0] && c2[0].key != null) {
        patchkeyedChildren(c1, c2, container, anchor);
      } else {
        patchUnkeyedChildren(c1, c2, container, anchor);
      }
    } else {
      mountChildren(c2, container, anchor);
    }
  } else {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = "";
    } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1);
    }
  }
}

function unmountChildren(children) {
  children.forEach((child) => {
    unmount(child)
  })
}

function patchUnkeyedChildren(c1, c2, container, anchor) {
  const oldLength = c1.length;
  const newLength = c2.length;
  const commonLength = Math.min(oldLength, newLength);
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container, anchor);
  }
  if (oldLength > newLength) {
    unmountChildren(c1.slice(commonLength));
  } else if (oldLength < newLength) {
    mountChildren(c2.slice(commonLength), container, anchor);
  }
}

//#region 
// react diff
// function patchkeyedChildren(c1, c2, container, anchor) {
//   const map = new Map();
//   c1.forEach((prev, j) => {
//     map.set(prev.key, {
//       prev,
//       j
//     });
//   })
//   // 记录当前next在c1中找到的最大值
//   let maxNewIndexSoFar = 0;
//   for (let i = 0; i < c2.length; i++) {
//     // 找c2
//     const next = c2[i];
//     const curAnchor = i === 0 ? c1[0].el : c2[i - 1].el.nextSibling;
//     if (map.has(next.key)) {
//       const {prev,j} = map.get(next.key);
//       patch(prev, next, container, anchor);
//       if (j < maxNewIndexSoFar) {
//         container.insertBefore(next.el, curAnchor);
//       } else {
//         // update
//         maxNewIndexSoFar = j;
//       }
//       // 每次匹配完就删除
//       map.delete(next.key);
//     } else {
//       patch(null, next, container, curAnchor)
//     }
//   }
//   // 最后多余的节点就卸载
//   map.forEach(({prev})=>{
//     unmount(prev)
//   })
// }
//#endregion

// vue3 diff

function patchkeyedChildren(c1, c2, container, anchor) {
  let i = 0;
  let e1 = c1.length - 1;
  let e2 = c2.length - 1;
  // 从左到右依次比对
  while (i <= e1 && i <= e2 && c1[i].key === c2[i].key) {
    patch(c1[i], c2[i], container, anchor);
    i++;
  }
  // 从右至左依次比对
  while (i <= e1 && i <= e2 && c1[e1].key === c2[e2].key) {
    patch(c1[e1], c2[e2], container, anchor);
    e1--;
    e2--;
  }
  // c1: a b c
  // c2: a d b c
  // i = 1;
  // e1 = 0;
  // e2 = 1;
  // 说明旧节点比对完毕 直接mount新节点
  if (i > e1) {
    // 作为此区间的所有节点都mount
    for (let j = i; j <= e2; j++) {
      // 找到下一个节点
      const nextPos = e2 + 1;
      // 因为此时这个节点可能为末尾节点，所以得存在才取
      // 否则就取原来的anchor
      const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
      // 执行插入
      patch(null, c2[j], container, curAnchor);
    }
  } else if (i > e2) {
    // 说明新的节点被比对完毕，要去卸载旧的节点
    for (let j = i; j <= e1; j++) {
      unmount(c1[j]);
    }
  } else {
    // 若以上都不满足则采用传统的diff算法，但不真的添加和移动，只做标记和删除
    const map = new Map();
    //  c1也可能被截断了 所以是
    for (let j = i; j <= e1; j++) {
      const prev = c1[j];
      map.set(prev.key, {
        prev,
        j
      });
    }
    // c1.forEach((prev, j) => {
    //   map.set(prev.key, {
    //     prev,
    //     j
    //   });
    // })
    // 记录当前next在c1中找到的最大值
    let maxNewIndexSoFar = 0;
    // 移动判断标识
    let move = false;
    const source = new Array(e2 - i + 1).fill(-1);
    const toMounted = [];
    // 有可能被截断了 所以是source的长度
    for (let k = 0; k < source.length; k++) {
      // 找c2
      const next = c2[k + i];
      // const curAnchor = i === 0 ? c1[0].el : c2[i - 1].el.nextSibling;
      if (map.has(next.key)) {
        const {
          prev,
          j
        } = map.get(next.key);
        patch(prev, next, container, anchor);
        if (j < maxNewIndexSoFar) {
          // 代表需要移动
          move = true;
        } else {
          // update
          maxNewIndexSoFar = j;
        }
        // 得到source数组
        source[k] = j;
        // 每次匹配完就删除
        map.delete(next.key);
      } else {
        toMounted.push(k + i);
        // patch(null, next, container, curAnchor)
      }
    }
    // 最后多余的节点就卸载
    map.forEach(({
      prev
    }) => {
      unmount(prev)
    })
    if (move) {
      const seq = getSequence(source);
      // 从末尾向前遍历
      let j = seq.length - 1;
      for (let k = source.length - 1; k >= 0; k--) {
        if (seq[j] == k) {
          // 不用移动
          // 此时k和最长上升子序列的值一样,直接j--让他进入下一轮的比较
          j--;
        } else {
          // 挂载节点的下标就是k，因为起点变了所以要加i
          const pos = k + i;
          // anchor就是当前节点的下一位
          const nextPos = pos + 1;
          const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
          if (source[k] === -1) {
            // mount
            patch(null, c2[pos], container, curAnchor)
          } else {
            // 移动
            container.insertBefore(c2[pos].el, curAnchor);
          }
        }
      }
    } else if (toMounted.length) {
      for (let k = toMounted.length - 1; k >= 0; k--) {
        const pos = toMounted[k];
        const nextPos = pos + 1;
        const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
        patch(null, c2[pos], container, curAnchor);
      }
    }
  }
}

function getSequence(nums) {
  const arr = [nums[0]];
  const pos = [0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === -1) continue;
    if (nums[i] <= arr[arr.length - 1]) {
      let l = 0,
        r = arr.length - 1;
      while (l <= r) {
        let mid = ~~((l + r) / 2);
        if (nums[i] > arr[mid]) {
          l = mid + 1;
        } else if (nums[i] < arr[mid]) {
          r = mid - 1;
        } else {
          l = mid;
          break;
        }
      }
      arr[l] = nums[i];
      pos.push(l);
    } else {
      arr.push(nums[i]);
      pos.push(arr.length - 1);
    }
  }
  let cur = arr.length - 1;
  for (let i = pos.length - 1; i >= 0 && cur >= 0; i--) {
    if (cur === pos[i]) {
      arr[cur--] = i;
    }
  }
  return arr;
};